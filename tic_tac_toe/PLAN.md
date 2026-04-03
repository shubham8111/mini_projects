# Tic Tac Toe — Vanishing Marks Edition

## Concept
A twist on classic tic-tac-toe: each player can have **at most 4 marks** on the board. When a player places their **5th mark**, their **oldest mark disappears**. This creates a dynamic, strategic game where the board is never full and positions shift constantly.

---

## Game Rules
1. Standard 3×3 grid, two players (X and O) take turns
2. Each player can have a **maximum of 4 marks** on the board at any time
3. When placing a 5th mark, the **oldest (first-placed) mark of that player is removed**
4. The removed cell becomes empty and available for either player
5. Win condition: 3 in a row (horizontal, vertical, or diagonal) — checked **after** the vanish
6. The game can also end in a **draw** if players agree or after a set number of total moves (optional)
7. A mark that is about to vanish should be visually indicated (fading/pulsing) so players can strategize

---

## UI/UX Design

### Visual Theme
- Clean, modern dark theme with glassmorphism elements
- Smooth animations for mark placement, vanishing, and win celebration
- Color scheme: Dark background (#0f0f1a), neon accent colors for X (cyan #00d4ff) and O (magenta #ff006e)
- Subtle grid glow effect

### Layout (Mobile-First)
```
┌─────────────────────────┐
│       TIC TAC TOE       │  ← Title with glow effect
│   Vanishing Marks Ed.   │
├─────────────────────────┤
│                         │
│  Player X (4 marks)     │  ← Turn indicator + mark count
│                         │
│  ┌─────┬─────┬─────┐   │
│  │     │     │     │   │
│  │  X  │     │  O  │   │  ← 3×3 grid with large tap targets
│  │     │     │     │   │
│  ├─────┼─────┼─────┤   │
│  │     │     │     │   │
│  │     │  X̤  │     │   │  ← X̤ = fading mark (about to vanish)
│  │     │     │     │   │
│  ├─────┼─────┼─────┤   │
│  │     │     │     │   │
│  │  O  │     │  X  │   │
│  │     │     │     │   │
│  └─────┴─────┴─────┘   │
│                         │
│  Player O: 2 marks      │  ← Other player info
│  Move #: 7              │  ← Total move counter
│                         │
│      [ New Game ]       │  ← Reset button
│                         │
└─────────────────────────┘
```

### Animations
- **Mark placement:** Scale-in with slight bounce (CSS `@keyframes`)
- **Vanishing mark:** Pulse/fade warning for 1 turn before removal, then shrink + fade out on removal
- **Win state:** Winning line glows and pulses, confetti or particle burst effect, overlay with winner announcement
- **Turn transition:** Smooth color shift on the turn indicator

### Visual Indicators
- **Active player:** Highlighted name/icon with glow matching their color
- **Mark age:** Oldest mark has a subtle pulsing border (warning it will vanish next)
- **Mark count:** Badge showing N/4 marks for each player
- **Vanishing preview:** When a player has 4 marks, their oldest mark pulses to signal it will vanish on next move

---

## Technical Architecture

### File Structure
```
tic_tac_toe/
├── index.html              # Single-page app
├── css/
│   └── styles.css          # All styles, animations, responsive design
├── js/
│   ├── game-logic.js       # Pure game logic (no DOM) — shared core
│   └── ui.js               # DOM manipulation, animations, event handlers
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker for offline
├── package.json            # Capacitor + test deps
├── capacitor.config.json   # Android config
├── test.js                 # Comprehensive test suite
├── dist/                   # Built assets for Capacitor
├── android/                # Generated Android project
└── README.md               # Project docs
```

### Core Logic Module (`js/game-logic.js`)
Pure JavaScript, zero DOM dependencies — this is the shared core for web and Android.

```
GameState {
  board: Array(9)           // null, 'X', or 'O'
  currentPlayer: 'X' | 'O'
  moveHistory: {            // Tracks order of moves per player
    X: [cellIndex, ...],    // Queue (FIFO) — max length 4
    O: [cellIndex, ...]
  }
  moveCount: number         // Total moves made
  winner: null | 'X' | 'O'
  winLine: null | [i, j, k] // Indices of winning cells
  gameOver: boolean
}

Functions:
  createGame() → GameState
  makeMove(state, cellIndex) → { newState, vanishedCell }
    - Validates move (cell empty, game not over)
    - If player has 4 marks, removes oldest from board
    - Places new mark
    - Checks for winner
    - Switches current player
    - Returns new state + which cell vanished (if any)
  checkWinner(board) → { winner, winLine } | null
  getMarkAge(state, player) → Map<cellIndex, age>
    - Returns how "old" each mark is (1=newest, 4=oldest/about-to-vanish)
  resetGame() → GameState
```

### UI Module (`js/ui.js`)
Handles all DOM interaction, rendering, and animations.

```
Key responsibilities:
  - Render board state
  - Handle cell click events
  - Animate mark placement (scale-in bounce)
  - Animate mark vanishing (pulse → shrink → fade)
  - Show "about to vanish" indicator on oldest mark
  - Update turn indicator and mark counts
  - Win celebration (line glow + overlay)
  - New game button
  - Sound effects (optional, subtle click/whoosh)
```

### Build Steps

#### Phase 1: Core Logic — COMPLETED
1. Implement `GameState` object structure — DONE
2. Implement `createGame()` — DONE
3. Implement `makeMove()` — DONE
4. Implement `checkWinner()` — DONE
5. Implement `getMarkAge()` — DONE
6. Write comprehensive tests for all logic — DONE

#### Phase 2: Web UI — COMPLETED
7. Build HTML structure — DONE
8. Build CSS — DONE
9. Wire up click handlers — DONE
10. Add placement animations — DONE
11. Add vanishing animations — DONE
12. Add win celebration — DONE
13. Add turn indicator and mark count display — DONE
14. Add "about to vanish" pulse on oldest mark — DONE
15. Mobile optimization — DONE

#### Phase 3: PWA — COMPLETED
16. Create `manifest.json` with app icons — DONE
17. Create `sw.js` for offline caching — DONE
18. Add meta tags for iOS/Android install prompts — DONE

#### Phase 4: Android (Capacitor) — COMPLETED
19. Set up `package.json` with Capacitor dependencies — DONE
20. Create `capacitor.config.json` — DONE
21. Copy web assets to `dist/` — DONE
22. Run `npx cap init` and `npx cap add android` — DONE
23. Sync and build: `npx cap sync android` — DONE

#### Phase 5: Polish — COMPLETED
24. Add sound effects (subtle, optional) — SKIP (can be added later)
25. Add haptic feedback — SKIP (requires Capacitor plugin)
26. Final responsive testing — DONE
27. Update root `README.md` — DONE

---

## Test Plan (`test.js`)

### Game Logic Tests
- Initial state: empty board, X goes first, no winner
- Basic move: mark placed, turn switches
- Invalid move: occupied cell rejected
- Invalid move: game-over state rejected
- Move history tracks correctly per player
- **Vanishing mechanic:**
  - 4th mark: no vanishing
  - 5th mark: oldest mark removed, cell becomes empty
  - 6th mark: second-oldest removed, etc.
  - Vanished cell is available for either player
- **Win detection:**
  - All 8 win lines (3 rows, 3 cols, 2 diags)
  - Win detected after vanish resolves
  - No false win from vanished marks
- Mark age calculation correct
- Game reset returns clean state

### UI Tests (with jsdom)
- Board renders 9 cells
- Click on cell triggers move
- Click on occupied cell does nothing
- Turn indicator updates
- Mark count displays correctly
- Oldest mark has vanish-warning class
- Win overlay appears on win
- New game button resets everything
