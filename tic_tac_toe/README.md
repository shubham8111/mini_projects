# Tic Tac Toe — Vanishing Marks Edition

A twist on classic Tic Tac Toe: each player can hold **at most 3 marks** on the board at any time. When a player places their **4th mark**, their **oldest mark disappears** — keeping the board dynamic and forcing constant re-evaluation of position.

---

## Game Rules

1. Standard 3×3 grid. Two players (X and O) alternate turns.
2. Each player can have a **maximum of 3 marks** on the board at once.
3. On a player's 4th placement, their **oldest mark is removed** and that cell becomes available again.
4. **Win condition:** 3 in a row (horizontal, vertical, or diagonal).
5. Win is checked **after the new mark is placed** — a move that simultaneously places a new mark and forms a 3-in-a-row wins, even if it would have triggered a vanish.
6. The mark that will vanish next **pulses** as a visual warning so both players can strategize around it.

---

## Features

- **Vanishing mechanic** — 3-mark limit keeps the board perpetually open; no stalemates
- **Pulse warning** — oldest mark pulses to signal it will disappear on the player's next move
- **Pip indicators** — player cards show how many marks each player currently has on the board (up to 3)
- **Win celebration** — winning line glows, confetti burst, and winner overlay
- **Move counter** — tracks total moves played in the current game
- **New Game button** — resets the board instantly; also available on the win overlay

---

## Visual Design

| Element | Detail |
|---|---|
| Theme | Dark glassmorphism (`#0f0f1a` background) |
| Player X color | Cyan (`#00d4ff`) |
| Player O color | Magenta (`#ff006e`) |
| Mark placement | Scale-in bounce animation |
| Mark vanishing | Pulse warning → shrink + fade out |
| Win line | Glow + pulse on the 3 winning cells |

Mobile-first layout; works at any screen size in portrait orientation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5, CSS3, JavaScript (no frameworks) |
| PWA | Web App Manifest + Service Worker (offline support) |
| Android | Capacitor 8 (wraps the web app into a native Android shell) |
| Tests | Node.js built-in test runner + jsdom |

---

## Project Structure

```
tic_tac_toe/
├── index.html              # Single-page app entry point
├── css/
│   └── styles.css          # All styles and animations
├── js/
│   ├── game-logic.js       # Pure game logic (no DOM) — shared core
│   └── ui.js               # DOM manipulation, animations, event handlers
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker for offline caching
├── package.json            # Capacitor + test dependencies
├── capacitor.config.json   # Android app config (com.stark.tictactoe)
├── test.js                 # Comprehensive test suite
├── dist/                   # Built web assets (used by Capacitor)
└── android/                # Capacitor-generated Android project
```

---

## Architecture

### `js/game-logic.js` — Pure Logic

Zero DOM dependencies. Safe to run in Node.js for tests.

```
GameState {
  board:         Array(9)          // null | 'X' | 'O'
  currentPlayer: 'X' | 'O'
  moveHistory:   { X: number[], O: number[] }  // FIFO queues, max 3
  moveCount:     number
  winner:        null | 'X' | 'O'
  winLine:       null | [i, j, k]
  gameOver:      boolean
}

createGame()                        → fresh GameState
makeMove(state, cellIndex)          → { newState, vanishedCell } | null
checkWinner(board)                  → { winner, winLine } | null
getMarkAge(state, player)           → Map<cellIndex, ageRank>
getAboutToVanishCell(state, player) → cellIndex | null
resetGame()                         → fresh GameState
```

### `js/ui.js` — DOM Layer

All rendering, animation, and event handling. Delegates every state change to `game-logic.js`.

---

## Running Locally

Open `index.html` directly in a browser — no build step required.

```bash
# Or serve with any static file server, e.g.:
npx serve .
```

---

## Running Tests

```bash
npm test
```

Tests cover: initial state, basic moves, invalid moves, the vanishing mechanic (3rd mark, 4th placement triggers vanish, subsequent vanishes), all 8 win lines, win detection after vanish, mark age calculation, and game reset.

---

## Android Build

```bash
npm run build    # copies web assets to dist/
npm run sync     # syncs to the Android project
npm run open     # opens Android Studio
```

App ID: `com.stark.tictactoe`
