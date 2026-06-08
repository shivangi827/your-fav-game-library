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
  settings: { numImposters: 1 },
  selectedVote: null,
  hasVoted: false,
  pendingAction: null,
  joinCode: null,
};

// =========================
// HELPERS
// =========================
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el as T;
}

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

function escHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function playerAvatar(p: { name: string; color: string }): string {
  return `<div class="player-avatar pcolor-${escHtml(p.color)}">${escHtml(
    p.name.charAt(0).toUpperCase()
  )}</div>`;
}

// =========================
// RENDER: LOBBY
// =========================
function renderLobby(): void {
  $('lobby-code').textContent = state.roomCode;

  $('lobby-player-list').innerHTML = state.players
    .map(
      (p) => `
      <li>
        ${playerAvatar(p)}
        <span>${escHtml(p.name)}</span>
        ${p.id === state.hostId ? '<span class="host-badge">HOST</span>' : ''}
        ${p.id === state.myId ? '<span class="you-tag">(you)</span>' : ''}
      </li>
    `
    )
    .join('');

  $('lobby-player-count').textContent = `${state.players.length}/8`;

  const isHost = state.myId === state.hostId;

  $('host-settings').classList.toggle('hidden', !isHost);
  $('host-start-area').classList.toggle('hidden', !isHost);
  $('guest-waiting').classList.toggle('hidden', isHost);
}

// =========================
// RENDER FROM SNAPSHOT ONLY
// =========================
socket.on('game-state', (data) => {
  state.gameState = data.state;
  state.hostId = data.hostId;
  state.players = data.players;
  state.settings = data.settings;

  const isHost = state.myId === state.hostId;

  switch (data.state) {
    case 'lobby':
      state.round = 0;
      state.myRole = null;
      state.myWord = null;
      state.myHint = null;
      renderLobby();
      showScreen('lobby');
      break;

    case 'role_reveal':
      showScreen('role');
      break;

    case 'round':
      state.round = data.round ?? state.round;
      showScreen('round');
      break;

    case 'voting':
      state.selectedVote = null;
      state.hasVoted = false;
      showScreen('voting');
      break;

    case 'reveal_votes':
      showScreen('reveal-votes');
      break;

    case 'imposter_guess':
      showScreen('imposter-guess');
      break;

    case 'results':
      showScreen('results');
      break;
  }
});

// =========================
// JOIN RESPONSE (only identity bootstrap)
// =========================
socket.on('joined', (data) => {
  state.myId = data.myId;
  state.roomCode = data.code;
  state.hostId = data.hostId;
  state.players = data.players;
  state.settings = data.settings;

  showScreen('lobby');
  renderLobby();
});

// =========================
// ROLE INFO (kept minimal)
// =========================
socket.on('your-role', (data) => {
  state.myRole = data.role;
  state.myWord = data.role === 'civilian' ? data.word : null;
  state.myHint = data.role === 'imposter' ? data.hint : null;
});

// =========================
// UI EVENTS (UNCHANGED LOGICALLY)
// =========================
$('btn-create').addEventListener('click', () => {
  state.pendingAction = 'create';
  showScreen('home');
});

$('btn-join').addEventListener('click', () => {
  const code = ($('input-join-code') as HTMLInputElement).value.trim();
  state.pendingAction = 'join';
  state.joinCode = code;
});

$('btn-name-confirm').addEventListener('click', () => {
  const name = ($('input-name') as HTMLInputElement).value.trim();
  state.myName = name;

  if (state.pendingAction === 'create') {
    socket.emit('create-room', {
      playerName: name,
      settings: state.settings,
    });
  }

  if (state.pendingAction === 'join') {
    const playerId =
      localStorage.getItem('playerId') ||
      crypto.randomUUID();

    localStorage.setItem('playerId', playerId);

    socket.emit('join-room', {
      code: state.joinCode!,
      playerName: name,
      playerId,
    });
  }
});

// =========================
// GAME ACTIONS
// =========================
$('btn-start-game').addEventListener('click', () => {
  socket.emit('start-game');
});

$('btn-round-done').addEventListener('click', () => {
  socket.emit('next-round');
});

$('btn-submit-vote').addEventListener('click', () => {
  const votedId = state.selectedVote;
  if (!votedId) return;
  socket.emit('submit-vote', { votedId });
});

$('btn-play-again').addEventListener('click', () => {
  socket.emit('play-again');
});

// =========================
// ERROR HANDLING
// =========================
socket.on('error-msg', (data) => {
  alert(data.message);
});

// =========================
// INITIAL SCREEN
// =========================
showScreen('home');