import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PublicPlayer,
  RoomSettings,
  GameStateName,
  VoteRecord,
} from '../shared/types';

const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  io('/imposter');

interface ClientState {
  myId: string | null;
  myName: string | null;
  roomCode: string | null;
  hostId: string | null;
  players: PublicPlayer[];
  gameState: GameStateName | null;
  myRole: 'civilian' | 'imposter' | null;
  myWord: string | null;
  myHint: string | null;
  round: number;
  settings: RoomSettings;
  selectedVote: string | null;
  hasVoted: boolean;
  pendingAction: 'create' | 'join' | null;
  joinCode: string | null;
}

const state: ClientState = {
  myId: null,
  myName: null,
  roomCode: null,
  hostId: null,
  players: [],
  gameState: null,
  myRole: null,
  myWord: null,
  myHint: null,
  round: 0,
  settings: {
    numImposters: 1,
    wordMode: 'global',
  },
  selectedVote: null,
  hasVoted: false,
  pendingAction: null,
  joinCode: null,
};

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el as T;
}

function escHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------------- UI HELPERS (UNCHANGED LOGIC) ---------------- */

function showScreen(name: string): void {
  document.querySelectorAll('.screen').forEach((s) => {
    s.classList.remove('active', 'visible');
    s.classList.add('hidden');
  });
  const el = document.getElementById(`screen-${name}`);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('active');
  }
}

/* ---------------- LOBBY RENDER ---------------- */

function renderLobby(): void {
  $('lobby-code').textContent = state.roomCode;

  const list = $('lobby-player-list');
  list.innerHTML = state.players
    .map(
      (p) => `
      <li>
        <span>${escHtml(p.name)}</span>
        ${p.id === state.hostId ? '<b>HOST</b>' : ''}
      </li>
    `
    )
    .join('');

  const isHost = state.myId === state.hostId;

  $('host-settings').classList.toggle('hidden', !isHost);
  $('host-start-area').classList.toggle('hidden', !isHost);
  $('guest-waiting').classList.toggle('hidden', isHost);

  if (isHost) {
    ($('setting-imposters') as HTMLSelectElement).value =
      String(state.settings.numImposters);

    ($('setting-word-mode') as HTMLSelectElement).value =
      state.settings.wordMode ?? 'global';
  }
}

/* ---------------- SOCKET EVENTS ---------------- */

socket.on('joined', (data) => {
  state.myId = data.myId;
  state.roomCode = data.code;
  state.hostId = data.hostId;
  state.players = data.players;
  state.settings = data.settings;

  showScreen('lobby');
  renderLobby();
});

socket.on('player-joined', (data) => {
  state.players = data.players;
  state.hostId = data.hostId;
  renderLobby();
});

socket.on('player-left', (data) => {
  state.players = data.players;
  state.hostId = data.hostId;
  renderLobby();
});

socket.on('settings-updated', (data) => {
  state.settings = data.settings;
  renderLobby();
});

/* ---------------- SETTINGS CONTROLS ---------------- */

$('setting-imposters').addEventListener('change', (e) => {
  const target = e.target as HTMLSelectElement;

  socket.emit('update-settings', {
    numImposters: parseInt(target.value, 10),
    wordMode: state.settings.wordMode,
  });
});

$('setting-word-mode').addEventListener('change', (e) => {
  const target = e.target as HTMLSelectElement;

  socket.emit('update-settings', {
    numImposters: state.settings.numImposters,
    wordMode: target.value as 'global' | 'india',
  });
});

/* ---------------- ACTIONS ---------------- */

$('btn-create').addEventListener('click', () => {
  state.pendingAction = 'create';
  showScreen('lobby');
});

$('btn-start-game').addEventListener('click', () => {
  socket.emit('start-game');
});

showScreen('home');