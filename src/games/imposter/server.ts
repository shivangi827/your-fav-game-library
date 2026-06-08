import { Server, Socket, Namespace } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  PublicPlayer,
  RoomSettings,
  GameStateName,
  PlayerColor,
} from './shared/types';

import { getWordList, WordMode, WordEntry } from './shared/words';

interface Room {
  code: string;
  hostId: string;
  players: Map<string, PublicPlayer & { socketId: string }>;
  settings: RoomSettings & { wordMode: WordMode };
  state: GameStateName;
  word: string;
  hint: string;
}

const rooms = new Map<string, Room>();

const COLORS: PlayerColor[] = [
  'blue',
  'red',
  'orange',
  'purple',
  'pink',
  'green',
  'yellow',
  'teal',
];

function createRoomCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function pickWord(mode: WordMode): WordEntry {
  const list = getWordList(mode);
  return list[Math.floor(Math.random() * list.length)];
}

export function setupImposter(
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
  const namespace: Namespace<ClientToServerEvents, ServerToClientEvents> =
    io.of('/imposter');

  namespace.on('connection', (socket: Socket) => {
    let roomCode: string | null = null;

    /* ---------------- CREATE ROOM ---------------- */
    socket.on('create-room', ({ playerName, settings }) => {
      const code = createRoomCode();

      const room: Room = {
        code,
        hostId: socket.id,
        players: new Map(),
        settings: {
          numImposters: settings?.numImposters ?? 1,
          wordMode: settings?.wordMode ?? 'global',
        },
        state: 'lobby',
        word: '',
        hint: '',
      };

      const player: PublicPlayer & { socketId: string } = {
        id: socket.id,
        socketId: socket.id,
        name: playerName,
        score: 0,
        color: COLORS[0],
      };

      room.players.set(socket.id, player);
      rooms.set(code, room);

      roomCode = code;
      socket.join(code);

      socket.emit('joined', {
        code,
        myId: socket.id,
        players: [...room.players.values()],
        hostId: room.hostId,
        state: room.state,
        settings: room.settings,
      });
    });

    /* ---------------- JOIN ROOM ---------------- */
    socket.on('join-room', ({ code, playerName }) => {
      const room = rooms.get(code);
      if (!room) return;

      const player: PublicPlayer & { socketId: string } = {
        id: socket.id,
        socketId: socket.id,
        name: playerName,
        score: 0,
        color: COLORS[room.players.size % COLORS.length],
      };

      room.players.set(socket.id, player);

      roomCode = code;
      socket.join(code);

      namespace.to(code).emit('player-joined', {
        players: [...room.players.values()],
        hostId: room.hostId,
      });
    });

    /* ---------------- SETTINGS ---------------- */
    socket.on('update-settings', (newSettings) => {
      if (!roomCode) return;

      const room = rooms.get(roomCode);
      if (!room) return;

      room.settings = {
        ...room.settings,
        ...newSettings,
      };

      namespace.to(roomCode).emit('settings-updated', {
        settings: room.settings,
      });
    });

    /* ---------------- START GAME ---------------- */
    socket.on('start-game', () => {
      if (!roomCode) return;

      const room = rooms.get(roomCode);
      if (!room) return;

      const wordEntry = pickWord(room.settings.wordMode);

      room.word = wordEntry.word;
      room.hint = wordEntry.hint;
      room.state = 'role_reveal';

      namespace.to(roomCode).emit('game-state', {
        state: room.state,
        hostId: room.hostId,
        players: [...room.players.values()],
      });

      /* ---------------- ROLE DISTRIBUTION (FIXED UNION TYPE) ---------------- */
      room.players.forEach((player) => {
        const isImposter = player.id === socket.id;

        if (isImposter) {
          namespace.to(player.socketId).emit('your-role', {
            role: 'imposter',
            hint: room.hint,
          });
        } else {
          namespace.to(player.socketId).emit('your-role', {
            role: 'civilian',
            word: room.word,
          });
        }
      });
    });

    /* ---------------- DISCONNECT ---------------- */
    socket.on('disconnect', () => {
      if (!roomCode) return;

      const room = rooms.get(roomCode);
      if (!room) return;

      room.players.delete(socket.id);

      namespace.to(roomCode).emit('player-left', {
        players: [...room.players.values()],
        hostId: room.hostId,
      });
    });
  });
}