/**
 * game-logic.js — Pure game logic, zero DOM/browser dependencies.
 * Works in Node.js (for tests) and the browser (via script tag).
 *
 * GameState shape:
 * {
 *   board:         Array(9)         // null | 'X' | 'O'
 *   currentPlayer: 'X' | 'O'
 *   moveHistory:   { X: number[], O: number[] }  // FIFO queues, max length 4
 *   moveCount:     number
 *   winner:        null | 'X' | 'O'
 *   winLine:       null | [number, number, number]
 *   gameOver:      boolean
 * }
 */

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

const MAX_MARKS = 3;

function createGame() {
  return {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    moveHistory: { X: [], O: [] },
    moveCount: 0,
    winner: null,
    winLine: null,
    gameOver: false,
  };
}

/**
 * Attempt to place the current player's mark at cellIndex.
 * Returns { newState, vanishedCell } on success, or null if the move is invalid.
 * vanishedCell is the index of the removed mark, or null if no mark was removed.
 */
function makeMove(state, cellIndex) {
  if (state.gameOver) return null;
  if (state.board[cellIndex] !== null) return null;

  const player = state.currentPlayer;

  // Deep copy state
  const newState = {
    board: [...state.board],
    currentPlayer: player,
    moveHistory: {
      X: [...state.moveHistory.X],
      O: [...state.moveHistory.O],
    },
    moveCount: state.moveCount + 1,
    winner: null,
    winLine: null,
    gameOver: false,
  };

  // 1. Place new mark
  newState.moveHistory[player].push(cellIndex);
  newState.board[cellIndex] = player;

  // 2. Check for win immediately after placement (with potentially 4 marks)
  const result = checkWinner(newState.board);
  if (result) {
    newState.winner = result.winner;
    newState.winLine = result.winLine;
    newState.gameOver = true;
    // Turn still switches (for UI consistency), or we could keep it. 
    // Usually games keep current winner active or switch. 
    // Let's keep the logic switch turn.
    newState.currentPlayer = player === 'X' ? 'O' : 'X';
    return { newState, vanishedCell: null };
  }

  // 3. If no win, check if we need to vanish the oldest mark
  let vanishedCell = null;
  if (newState.moveHistory[player].length > MAX_MARKS) {
    vanishedCell = newState.moveHistory[player].shift();
    newState.board[vanishedCell] = null;
  }

  // Switch turn
  newState.currentPlayer = player === 'X' ? 'O' : 'X';

  return { newState, vanishedCell };
}

/**
 * Returns { winner, winLine } if there is a winner, otherwise null.
 */
function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winLine: [a, b, c] };
    }
  }
  return null;
}

/**
 * Returns a Map<cellIndex, ageRank> for a player's marks.
 * ageRank 1 = newest, MAX_MARKS = oldest (about to vanish on next move).
 * Only meaningful when the player has marks on the board.
 */
function getMarkAge(state, player) {
  const history = state.moveHistory[player];
  const ageMap = new Map();
  const len = history.length;
  history.forEach((cellIndex, i) => {
    // i=0 is oldest → highest rank; i=len-1 is newest → rank 1
    ageMap.set(cellIndex, len - i);
  });
  return ageMap;
}

/**
 * Returns the cell index of the mark that will vanish on the player's next move,
 * or null if the player has fewer than MAX_MARKS marks.
 */
function getAboutToVanishCell(state, player) {
  if (state.moveHistory[player].length === MAX_MARKS) {
    return state.moveHistory[player][0];
  }
  return null;
}

function resetGame() {
  return createGame();
}

// Export for Node.js (tests); in browser these are global via script tag
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createGame,
    makeMove,
    checkWinner,
    getMarkAge,
    getAboutToVanishCell,
    resetGame,
    WIN_LINES,
    MAX_MARKS,
  };
}
