/**
 * test.js — Comprehensive test suite for tic_tac_toe.
 * Covers core game logic (no DOM) and basic UI rendering via jsdom.
 * Run: node test.js
 */

const assert = require('assert');
const { JSDOM } = require('jsdom');

// ── Load game logic ───────────────────────────────────────────────────────────
const {
  createGame,
  makeMove,
  checkWinner,
  getMarkAge,
  getAboutToVanishCell,
  resetGame,
  MAX_MARKS,
} = require('./js/game-logic.js');

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    // Handle async tests
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      }).catch(e => {
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
        failed++;
      });
    }
    console.log(`  ✓ ${name}`);
    passed++;
    return Promise.resolve();
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
    return Promise.resolve();
  }
}

function group(name) {
  console.log(`\n${name}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Play a sequence of moves by index; returns final state. */
function playMoves(indices) {
  let state = createGame();
  for (const i of indices) {
    const result = makeMove(state, i);
    assert(result !== null, `Move to cell ${i} returned null (invalid). Board: ${JSON.stringify(state.board)}, gameOver: ${state.gameOver}`);
    state = result.newState;
  }
  return state;
}

/** Play a sequence and collect all { newState, vanishedCell } results. */
function playMovesTracked(indices) {
  let state = createGame();
  const results = [];
  for (const i of indices) {
    const r = makeMove(state, i);
    assert(r !== null, `Move to cell ${i} returned null (invalid). Board: ${JSON.stringify(state.board)}, gameOver: ${state.gameOver}`);
    results.push(r);
    state = r.newState;
  }
  return results;
}

/**
 * Safe 6-move sequence that fills 3 marks each for X and O without any win:
 *   X: cells 0, 3, 1
 *   O: cells 4, 7, 5
 * Interleaved: [0, 4, 3, 7, 1, 5]
 */
const SAFE_6 = [0, 4, 3, 7, 1, 5];
// After SAFE_6: X history=[0,3,1], O history=[4,7,5], free cells=[2,6,8]

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Initial state
// ══════════════════════════════════════════════════════════════════════════════
group('1. Initial state');

test('board is 9 nulls', () => {
  const s = createGame();
  assert.deepStrictEqual(s.board, Array(9).fill(null));
});

test('X goes first', () => {
  assert.strictEqual(createGame().currentPlayer, 'X');
});

test('no winner, not game over', () => {
  const s = createGame();
  assert.strictEqual(s.winner, null);
  assert.strictEqual(s.winLine, null);
  assert.strictEqual(s.gameOver, false);
});

test('move histories are empty', () => {
  const s = createGame();
  assert.deepStrictEqual(s.moveHistory, { X: [], O: [] });
});

test('moveCount is 0', () => {
  assert.strictEqual(createGame().moveCount, 0);
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Basic moves
// ══════════════════════════════════════════════════════════════════════════════
group('2. Basic moves');

test('placing a mark fills the cell', () => {
  const { newState } = makeMove(createGame(), 4);
  assert.strictEqual(newState.board[4], 'X');
});

test('turn switches after each move', () => {
  let s = createGame();
  s = makeMove(s, 0).newState;
  assert.strictEqual(s.currentPlayer, 'O');
  s = makeMove(s, 1).newState;
  assert.strictEqual(s.currentPlayer, 'X');
});

test('moveCount increments', () => {
  const r1 = makeMove(createGame(), 0);
  assert.strictEqual(r1.newState.moveCount, 1);
  const r2 = makeMove(r1.newState, 1);
  assert.strictEqual(r2.newState.moveCount, 2);
});

test('no vanishedCell on first 3 moves of each player', () => {
  // SAFE_6 gives 3 moves each without wins; none should vanish
  const results = playMovesTracked(SAFE_6);
  results.forEach((r, i) => {
    assert.strictEqual(r.vanishedCell, null, `Move ${i} should not vanish`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Invalid moves
// ══════════════════════════════════════════════════════════════════════════════
group('3. Invalid moves');

test('returns null for occupied cell', () => {
  const s = makeMove(createGame(), 4).newState;
  assert.strictEqual(makeMove(s, 4), null);
});

test('returns null when game is over', () => {
  // X wins: top row (X:0,1,2 with O elsewhere)
  const s = playMoves([0, 3, 1, 4, 2]);
  assert.strictEqual(s.gameOver, true);
  assert.strictEqual(makeMove(s, 8), null);
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Vanishing mechanic
// ══════════════════════════════════════════════════════════════════════════════
group('4. Vanishing mechanic');

test('3rd mark placed — no vanish (X)', () => {
  // SAFE_6: X's 3rd mark is at move index 4 (results[4])
  const results = playMovesTracked(SAFE_6);
  assert.strictEqual(results[4].vanishedCell, null);
  assert.strictEqual(results[4].newState.moveHistory.X.length, 3);
});

test('4th X mark triggers vanish of oldest X mark', () => {
  // After SAFE_6: X=[0,3,1], free=[2,6,8]
  // X places at 8 → oldest X (cell 0) vanishes → X=[3,1,8]
  const state = playMoves(SAFE_6);
  const r = makeMove(state, 8); // X's 4th mark
  assert.notStrictEqual(r, null);
  assert.strictEqual(r.vanishedCell, 0, 'Oldest X mark (cell 0) should vanish');
  assert.strictEqual(r.newState.board[0], null, 'Cell 0 should be empty after vanish');
  assert.strictEqual(r.newState.board[8], 'X', 'New X mark at cell 8');
  assert.strictEqual(r.newState.moveHistory.X.length, MAX_MARKS);
});

test('vanished cell becomes available for O placement', () => {
  // After X's 4th mark at cell 8, cell 0 is freed; it's now O's turn
  const stateAfter6 = playMoves(SAFE_6);
  const rxFourth = makeMove(stateAfter6, 8); // X 4th → cell 0 vanishes
  assert.strictEqual(rxFourth.vanishedCell, 0);
  // O should now be able to place at the freed cell 0
  const ro = makeMove(rxFourth.newState, 0);
  assert.notStrictEqual(ro, null, 'O should be able to place at formerly-X cell 0');
  assert.strictEqual(ro.newState.board[0], 'O');
});

test('move history queue length stays at MAX_MARKS after vanish', () => {
  const state = playMoves(SAFE_6);
  const r = makeMove(state, 8);
  assert.strictEqual(r.newState.moveHistory.X.length, MAX_MARKS);
  assert.strictEqual(r.newState.moveHistory.X[0], 3, 'Oldest remaining X mark should be cell 3');
});

test('X and O vanishing are independent', () => {
  // After SAFE_6: X=[0,3,1], O=[4,7,5], free=[2,6,8]
  const state = playMoves(SAFE_6);

  // X places 4th at 8 → X oldest (0) vanishes; O untouched
  const rx = makeMove(state, 8);
  assert.strictEqual(rx.vanishedCell, 0);
  assert.strictEqual(rx.newState.board[0], null);
  assert.strictEqual(rx.newState.board[4], 'O'); // O's marks untouched

  // O places 4th at now-freed cell 0 → O oldest (4) vanishes; X untouched
  const ro = makeMove(rx.newState, 0);
  assert.strictEqual(ro.vanishedCell, 4);
  assert.strictEqual(ro.newState.board[4], null);
  assert.strictEqual(ro.newState.board[3], 'X'); // X's remaining marks untouched
});

test('cannot place on cell being vacated by own vanish in same move', () => {
  // After SAFE_6: X's oldest is cell 0. X cannot place AT cell 0 (it's occupied by X).
  const state = playMoves(SAFE_6);
  assert.strictEqual(state.board[0], 'X');
  const r = makeMove(state, 0); // cell 0 is occupied
  assert.strictEqual(r, null, 'Cannot place on already-occupied cell (even if it would vanish)');
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Win detection
// ══════════════════════════════════════════════════════════════════════════════
group('5. Win detection');

const WIN_SCENARIOS = [
  { name: 'top row',   xMoves: [0,1,2], oMoves: [3,4] },
  { name: 'mid row',   xMoves: [3,4,5], oMoves: [0,1] },
  { name: 'bot row',   xMoves: [6,7,8], oMoves: [0,1] },
  { name: 'left col',  xMoves: [0,3,6], oMoves: [1,2] },
  { name: 'mid col',   xMoves: [1,4,7], oMoves: [0,2] },
  { name: 'right col', xMoves: [2,5,8], oMoves: [0,1] },
  { name: 'diag \\',   xMoves: [0,4,8], oMoves: [1,2] },
  { name: 'diag /',    xMoves: [2,4,6], oMoves: [0,1] },
];

WIN_SCENARIOS.forEach(({ name, xMoves, oMoves }) => {
  test(`X wins — ${name}`, () => {
    // Interleave: x0,o0,x1,o1,x2
    const seq = [];
    for (let i = 0; i < Math.max(xMoves.length, oMoves.length); i++) {
      if (i < xMoves.length) seq.push(xMoves[i]);
      if (i < oMoves.length) seq.push(oMoves[i]);
    }
    const s = playMoves(seq);
    assert.strictEqual(s.winner, 'X', `Expected X to win via ${name}`);
    assert.strictEqual(s.gameOver, true);
    assert.ok(s.winLine, 'winLine should be set');
  });
});

test('win detected BEFORE vanish (from 4th mark)', () => {
  // X needs [0, 4, 8] to win.
  // X currently has [0, 4, 3]. Oldest is 0.
  // X places 4th at 8. 
  // With the new logic, X should win with [0, 4, 8] BEFORE 0 vanishes.
  // Sequence: X:0, O:1, X:4, O:2, X:3, O:5, X:8
  const s = playMoves([0, 1, 4, 2, 3, 5, 8]);
  assert.strictEqual(s.winner, 'X');
  assert.ok(s.winLine.includes(0) && s.winLine.includes(4) && s.winLine.includes(8),
    'Win should be on diagonal [0,4,8]');
  assert.strictEqual(s.board[0], 'X', 'Oldest mark should NOT have vanished because X won');
});

test('no false win from vanished marks', () => {
  // This test is now slightly different because we check win before vanish.
  // But if the 4th mark doesn't complete a line, the oldest vanishes.
  // We want to ensure that if a line would be completed only if the oldest stayed, 
  // but it doesn't stay (no win), it's correct.
  // Actually, if we check win before vanish, then if 4 marks form a line, it's a win.
  // So the "false win" would be if we checked win AFTER vanish and missed a win.
  // The user wants: "evaluate for win before removing the block".
  
  // Let's test that if NO win is formed by 4 marks, the oldest vanishes.
  // X: [0, 2, 3]. O: [4, 5, 6].
  // X places 4th at 7. [0, 2, 3, 7] has no 3-in-a-row.
  // So 0 should vanish.
  const s = playMoves([0, 4, 2, 5, 3, 6, 7]);
  assert.strictEqual(s.winner, null);
  assert.strictEqual(s.board[0], null, 'Cell 0 should have vanished since no win was formed');
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6: getMarkAge and getAboutToVanishCell
// ══════════════════════════════════════════════════════════════════════════════
group('6. Mark age utilities');

test('getMarkAge returns correct ranks', () => {
  // After SAFE_6: X history=[0,3,1]
  // ranks: 0→3(oldest), 3→2, 1→1(newest)
  const s = playMoves(SAFE_6);
  const ages = getMarkAge(s, 'X');
  assert.strictEqual(ages.get(0), 3, 'cell 0 should be rank 3 (oldest)');
  assert.strictEqual(ages.get(3), 2);
  assert.strictEqual(ages.get(1), 1, 'cell 1 should be rank 1 (newest)');
});

test('getMarkAge O returns correct ranks', () => {
  // After SAFE_6: O history=[4,7,5]
  const s = playMoves(SAFE_6);
  const ages = getMarkAge(s, 'O');
  assert.strictEqual(ages.get(4), 3, 'cell 4 should be rank 3 (oldest)');
  assert.strictEqual(ages.get(5), 1, 'cell 5 should be rank 1 (newest)');
});

test('getAboutToVanishCell returns oldest when 3 marks', () => {
  const s = playMoves(SAFE_6);
  assert.strictEqual(getAboutToVanishCell(s, 'X'), 0, 'X oldest is cell 0');
  assert.strictEqual(getAboutToVanishCell(s, 'O'), 4, 'O oldest is cell 4');
});

test('getAboutToVanishCell returns null when fewer than 3 marks', () => {
  // 2 total moves: X has 1, O has 1
  const s = playMoves([0, 1]);
  assert.strictEqual(getAboutToVanishCell(s, 'X'), null);
  assert.strictEqual(getAboutToVanishCell(s, 'O'), null);
});

test('getAboutToVanishCell updates after vanish', () => {
  // After SAFE_6 + X places at 8: X=[3,1,8], oldest is now 3
  const state = playMoves(SAFE_6);
  const r = makeMove(state, 8);
  assert.strictEqual(getAboutToVanishCell(r.newState, 'X'), 3, 'Next oldest X should be cell 3');
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7: checkWinner standalone
// ══════════════════════════════════════════════════════════════════════════════
group('7. checkWinner (standalone)');

test('returns null on empty board', () => {
  assert.strictEqual(checkWinner(Array(9).fill(null)), null);
});

test('returns null on board with no winner', () => {
  const board = ['X','O','X', 'O','O','X', null,null,null];
  assert.strictEqual(checkWinner(board), null);
});

test('detects X on main diagonal', () => {
  const board = ['X',null,null, null,'X',null, null,null,'X'];
  const r = checkWinner(board);
  assert.strictEqual(r.winner, 'X');
  assert.deepStrictEqual(r.winLine, [0, 4, 8]);
});

test('detects O on middle column', () => {
  const board = [null,'O',null, null,'O',null, null,'O',null];
  const r = checkWinner(board);
  assert.strictEqual(r.winner, 'O');
  assert.deepStrictEqual(r.winLine, [1, 4, 7]);
});

test('detects O on anti-diagonal', () => {
  const board = [null,null,'O', null,'O',null, 'O',null,null];
  const r = checkWinner(board);
  assert.strictEqual(r.winner, 'O');
  assert.deepStrictEqual(r.winLine, [2, 4, 6]);
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Reset
// ══════════════════════════════════════════════════════════════════════════════
group('8. Reset');

test('resetGame returns clean initial state', () => {
  playMoves([0, 1, 2, 3, 4]); // play some moves (unused, just ensuring no side effects)
  const fresh = resetGame();
  assert.deepStrictEqual(fresh.board, Array(9).fill(null));
  assert.strictEqual(fresh.currentPlayer, 'X');
  assert.deepStrictEqual(fresh.moveHistory, { X: [], O: [] });
  assert.strictEqual(fresh.moveCount, 0);
  assert.strictEqual(fresh.winner, null);
  assert.strictEqual(fresh.gameOver, false);
});

test('createGame is pure — each call returns independent state', () => {
  const s1 = createGame();
  const s2 = createGame();
  makeMove(s1, 0);
  assert.strictEqual(s2.board[0], null, 'States must be independent');
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 9: UI rendering (jsdom)
// ══════════════════════════════════════════════════════════════════════════════
group('9. UI rendering (jsdom)');

async function setupDOM() {
  const fs   = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    beforeParse(window) {
      window.navigator.serviceWorker = { register: () => Promise.resolve() };
    },
  });

  const win = dom.window;
  const doc = win.document;

  // Eval scripts manually (jsdom can't load local files via HTTP)
  const logicSrc = fs.readFileSync(path.join(__dirname, 'js/game-logic.js'), 'utf8');
  win.eval(logicSrc);

  const uiSrc = fs.readFileSync(path.join(__dirname, 'js/ui.js'), 'utf8');
  win.eval(uiSrc);

  // Fire DOMContentLoaded so ui.js initialises
  doc.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));
  await new Promise(r => setTimeout(r, 30));

  return dom;
}

test('board renders 9 cells', async () => {
  const dom = await setupDOM();
  const cells = dom.window.document.querySelectorAll('.cell');
  assert.strictEqual(cells.length, 9);
});

test('Player X card is active at game start', async () => {
  const dom = await setupDOM();
  const xCard = dom.window.document.querySelector('.player-card.x-card');
  assert.ok(xCard.classList.contains('active'), 'X card should be active at start');
});

test('Player O card is NOT active at game start', async () => {
  const dom = await setupDOM();
  const oCard = dom.window.document.querySelector('.player-card.o-card');
  assert.ok(!oCard.classList.contains('active'), 'O card should not be active at start');
});

test('clicking empty cell adds player class to it', async () => {
  const dom = await setupDOM();
  const cell = dom.window.document.querySelector('.cell[data-index="4"]');
  cell.click();
  await new Promise(r => setTimeout(r, 50));
  assert.ok(cell.classList.contains('x') || cell.classList.contains('o'),
    'Cell should have player class after click');
});

test('clicking occupied cell does not change its state', async () => {
  const dom = await setupDOM();
  const cell = dom.window.document.querySelector('.cell[data-index="0"]');
  cell.click();
  await new Promise(r => setTimeout(r, 50));
  const firstClass = cell.classList.contains('x') ? 'x' : 'o';
  cell.click(); // second click — should be ignored
  await new Promise(r => setTimeout(r, 50));
  assert.ok(cell.classList.contains(firstClass), 'Occupied cell class should not change');
});

test('move counter increments in DOM', async () => {
  const dom = await setupDOM();
  const counterEl = dom.window.document.getElementById('move-count');
  assert.strictEqual(counterEl.textContent, '0');
  dom.window.document.querySelector('.cell[data-index="0"]').click();
  // Wait for the animation/async flow in ui.js (which has multiple delays)
  await new Promise(r => setTimeout(r, 800));
  assert.strictEqual(counterEl.textContent, '1');
});

// ══════════════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  await new Promise(r => setTimeout(r, 300)); // let async tests settle

  console.log('\n' + '─'.repeat(44));
  if (failed === 0) {
    console.log(`  All ${passed} tests passed`);
  } else {
    console.log(`  ${passed} passed,  ${failed} failed`);
  }
  console.log('─'.repeat(44));

  if (failed > 0) process.exit(1);
}

main();
