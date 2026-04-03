/**
 * ui.js — DOM layer. Calls into game-logic.js for all state transitions.
 * No game rules live here.
 */

// ── State ────────────────────────────────────────────────────────────────────
let gameState = createGame();
let isAnimating = false;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const boardEl       = document.getElementById('board');
const cells         = Array.from(boardEl.querySelectorAll('.cell'));
const moveCountEl   = document.getElementById('move-count');
const winOverlay    = document.getElementById('win-overlay');
const winSymbolEl   = document.getElementById('win-symbol');
const winTitleEl    = document.getElementById('win-title');
const confettiWrap  = document.getElementById('confetti-wrap');

const playerCards   = {
  X: document.querySelector('.player-card.x-card'),
  O: document.querySelector('.player-card.o-card'),
};
const pipSets = {
  X: document.querySelectorAll('.player-card.x-card .pip'),
  O: document.querySelectorAll('.player-card.o-card .pip'),
};

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderBoard(gameState);
  updateStatusUI(gameState);
  attachEventListeners();
});

// ── Event listeners ───────────────────────────────────────────────────────────
function attachEventListeners() {
  cells.forEach((cell, i) => {
    cell.addEventListener('click', () => handleCellClick(i));
  });

  document.querySelectorAll('.btn-new-game').forEach(btn => {
    btn.addEventListener('click', startNewGame);
  });
}

// ── Cell click handler ────────────────────────────────────────────────────────
async function handleCellClick(cellIndex) {
  if (isAnimating || gameState.gameOver) return;
  if (gameState.board[cellIndex] !== null) return;

  const player = gameState.currentPlayer;
  const result = makeMove(gameState, cellIndex);
  if (!result) return;

  const { newState, vanishedCell } = result;
  isAnimating = true;
  boardEl.classList.add('no-click');

  // 1. Visually place the new mark first
  const newCell = cells[cellIndex];
  newCell.classList.add(player.toLowerCase(), 'occupied', 'placing');
  await delay(360);
  newCell.classList.remove('placing');

  // 2. Animate the vanishing mark if any (only happens if no win)
  if (vanishedCell !== null) {
    const oldCell = cells[vanishedCell];
    oldCell.classList.add('vanishing');
    await delay(340);
  }

  // 3. Commit new state and re-render board
  gameState = newState;
  renderBoard(newState);

  // 4. Handle win
  if (newState.gameOver) {
    await delay(200);
    showWinOverlay(newState);
  }

  updateStatusUI(newState);
  boardEl.classList.remove('no-click');
  isAnimating = false;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderBoard(state) {
  // Which cells should show the "about to vanish" warning?
  const warnCells = new Set();
  for (const player of ['X', 'O']) {
    const cell = getAboutToVanishCell(state, player);
    if (cell !== null) warnCells.add(cell);
  }

  const winSet = state.winLine ? new Set(state.winLine) : new Set();

  cells.forEach((cell, i) => {
    const mark = state.board[i];

    // Reset classes except 'cell'
    cell.className = 'cell';

    // Player class
    if (mark === 'X') cell.classList.add('x', 'occupied');
    if (mark === 'O') cell.classList.add('o', 'occupied');

    // Warn-vanish indicator (only on occupied cells in the warn set)
    if (mark !== null && warnCells.has(i)) {
      cell.classList.add('warn-vanish');
    }

    // Win highlight
    if (winSet.has(i)) {
      cell.classList.add('win-cell');
    }
  });
}

// ── Status UI ─────────────────────────────────────────────────────────────────
function updateStatusUI(state) {
  // Move counter
  moveCountEl.textContent = state.moveCount;

  // Player cards — active state + pip fill
  for (const player of ['X', 'O']) {
    const card = playerCards[player];
    const pips = pipSets[player];
    const count = state.moveHistory[player].length;

    card.classList.toggle('active', !state.gameOver && state.currentPlayer === player);

    pips.forEach((pip, i) => {
      pip.classList.toggle('filled', i < count);
    });
  }
}

// ── Win overlay ───────────────────────────────────────────────────────────────
function showWinOverlay(state) {
  const w = state.winner;
  winSymbolEl.textContent = w;
  winSymbolEl.className = `win-symbol-big ${w.toLowerCase()}`;
  winTitleEl.textContent = `Player ${w} wins!`;
  winTitleEl.className = `win-title ${w.toLowerCase()}`;
  winOverlay.classList.add('visible');
  spawnConfetti(w);
}

function hideWinOverlay() {
  winOverlay.classList.remove('visible');
  clearConfetti();
}

// ── New game ──────────────────────────────────────────────────────────────────
function startNewGame() {
  hideWinOverlay();
  gameState = resetGame();
  isAnimating = false;
  boardEl.classList.remove('no-click');

  // Clear all cell classes/animations
  cells.forEach(cell => {
    cell.className = 'cell';
    const mark = cell.querySelector('.mark');
    if (mark) mark.style.animation = '';
  });

  renderBoard(gameState);
  updateStatusUI(gameState);
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function spawnConfetti(winner) {
  clearConfetti();
  const colors = winner === 'X'
    ? ['#00d4ff', '#4af0ff', '#a78bfa', '#ffffff']
    : ['#ff006e', '#ff4da6', '#a78bfa', '#ffffff'];

  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-p';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${4 + Math.random() * 8}px;
      height: ${4 + Math.random() * 8}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${1.4 + Math.random() * 1.6}s;
      animation-delay: ${Math.random() * 0.6}s;
      opacity: 0.9;
    `;
    confettiWrap.appendChild(p);
  }
}

function clearConfetti() {
  confettiWrap.innerHTML = '';
}

// ── Utility ───────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
