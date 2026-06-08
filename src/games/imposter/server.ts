import { Namespace, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  PublicPlayer,
  PlayerColor,
  PLAYER_COLOR_PALETTE,
  RoomSettings,
  GameStateName,
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  MAX_NAME_LENGTH,
  MAX_GUESS_LENGTH,
  MAX_ROOMS,
} from './shared/types';

import { WORD_LIST } from './shared/words';
import posthog from '../../posthog';

interface Player {
  id: string; // socket.id
  playerId: string;
  name: string;
  score: number;
  vote: string | null;
  isImposter: boolean;
  color: PlayerColor;
  disconnectedAt?: number;
}

interface Room {
  code: string;
  hostId: string;
  players: Player[];
  state: GameStateName;
  round: number;
  word: string | null;
  hint: string | null;
  imposterId: string | null;
  imposterIds: string[];
  settings: RoomSettings;
  lastCaught: boolean;
  lastActivityAt: number;
}

interface SocketData {
  roomCode?: string;
  eventTimestamps: number[];
}

type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const EVENT_WINDOW_MS = 1000;
const EVENT_LIMIT_PER_WINDOW = 15;
const DISCONNECT_GRACE_MS = 2 * 60 * 1000;

export function setupImposter(rawNs: Namespace): void {
  const ns = rawNs as Namespace<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >;

  const rooms = new Map<string, Room>();

  function safePlayer(p: Player): PublicPlayer {
    return { id: p.id, name: p.name, score: p.score, color: p.color };
  }

  function touch(room: Room) {
    room.lastActivityAt = Date.now();
  }

  function normalizeSettings(input?: Partial<RoomSettings>): RoomSettings {
    return {
      numImposters: Math.max(1, Math.min(3, Number(input?.numImposters) || 1)),
    };
  }

  function emitRoomState(room: Room) {
    ns.to(room.code).emit('game-state', {
      state: room.state,
      round: room.round,
      hostId: room.hostId,
      players: room.players.map(safePlayer),
      settings: room.settings,
    });
  }

  function checkRate(socket: GameSocket) {
    const now = Date.now();
    const arr = socket.data.eventTimestamps ?? [];
    const recent = arr.filter((t) => now - t < EVENT_WINDOW_MS);
    recent.push(now);
    socket.data.eventTimestamps = recent;

    if (recent.length > EVENT_LIMIT_PER_WINDOW) {
      socket.emit('error-msg', { message: 'Slow down.' });
      return false;
    }
    return true;
  }

  ns.on('connection', (socket: GameSocket) => {
    socket.data.eventTimestamps = [];

    // =========================
    // CREATE ROOM
    // =========================
    socket.on('create-room', ({ playerName, settings }) => {
      if (!checkRate(socket)) return;

      const code = Math.random().toString(36).substring(2, 7).toUpperCase();

      const room: Room = {
        code,
        hostId: socket.id,
        players: [
          {
            id: socket.id,
            playerId: crypto.randomUUID(),
            name: playerName,
            score: 0,
            vote: null,
            isImposter: false,
            color: PLAYER_COLOR_PALETTE[0]!,
          },
        ],
        state: 'lobby',
        round: 0,
        word: null,
        hint: null,
        imposterId: null,
        imposterIds: [],
        settings: normalizeSettings(settings),
        lastCaught: false,
        lastActivityAt: Date.now(),
      };

      rooms.set(code, room);
      socket.join(code);
      socket.data.roomCode = code;

      socket.emit('joined', {
        code,
        myId: socket.id,
        players: room.players.map(safePlayer),
        hostId: room.hostId,
        state: room.state,
        settings: room.settings,
      });

      emitRoomState(room);
    });

    // =========================
    // JOIN / RECONNECT
    // =========================
    socket.on('join-room', ({ code, playerName, playerId }: any) => {
      if (!checkRate(socket)) return;

      const room = rooms.get(code);
      if (!room) {
        socket.emit('error-msg', { message: 'Room not found.' });
        return;
      }

      // RECONNECT
      const existing = room.players.find((p) => p.playerId === playerId);

      if (existing) {
        existing.id = socket.id;
        existing.disconnectedAt = undefined;

        socket.join(code);
        socket.data.roomCode = code;

        socket.emit('joined', {
          code,
          myId: socket.id,
          players: room.players.map(safePlayer),
          hostId: room.hostId,
          state: room.state,
          settings: room.settings,
        });

        emitRoomState(room);
        return;
      }

      // NEW PLAYER
      if (room.state !== 'lobby') {
        socket.emit('error-msg', { message: 'Game in progress.' });
        return;
      }

      if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
        socket.emit('error-msg', { message: 'Room full.' });
        return;
      }

      room.players.push({
        id: socket.id,
        playerId,
        name: playerName,
        score: 0,
        vote: null,
        isImposter: false,
        color: PLAYER_COLOR_PALETTE[0]!,
      });

      socket.join(code);
      socket.data.roomCode = code;

      emitRoomState(room);
    });

    // =========================
    // DISCONNECT (GRACEFUL)
    // =========================
    socket.on('disconnect', () => {
      const code = socket.data.roomCode;
      if (!code) return;

      const room = rooms.get(code);
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;

      player.disconnectedAt = Date.now();

      setTimeout(() => {
        const room = rooms.get(code);
        if (!room) return;

        const still = room.players.find((p) => p.id === socket.id);
        if (!still) return;

        if (
          still.disconnectedAt &&
          Date.now() - still.disconnectedAt > DISCONNECT_GRACE_MS
        ) {
          room.players = room.players.filter((p) => p.id !== socket.id);

          if (room.players.length === 0) {
            rooms.delete(code);
            return;
          }

          if (room.hostId === socket.id) {
            room.hostId = room.players[0]!.id;
          }

          emitRoomState(room);
        }
      }, DISCONNECT_GRACE_MS);
    });

    // =========================
    // GAME ACTIONS (ALL SNAPSHOT BASED)
    // =========================

    socket.on('start-game', () => {
      const code = socket.data.roomCode;
      if (!code) return;

      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id) return;

      room.state = 'role_reveal';
      room.round = 0;

      emitRoomState(room);
    });

    socket.on('next-round', () => {
      const room = rooms.get(socket.data.roomCode!);
      if (!room || room.hostId !== socket.id) return;

      room.round++;
      room.state = room.round > 3 ? 'voting' : 'round';

      emitRoomState(room);
    });

    socket.on('submit-vote', ({ votedId }) => {
      const room = rooms.get(socket.data.roomCode!);
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;

      player.vote = votedId;

      emitRoomState(room);
    });

    socket.on('play-again', () => {
      const room = rooms.get(socket.data.roomCode!);
      if (!room || room.hostId !== socket.id) return;

      room.state = 'lobby';
      room.round = 0;
      room.players.forEach((p) => (p.vote = null));

      emitRoomState(room);
    });
  });
}