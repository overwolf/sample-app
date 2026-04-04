# Ward Optimizer Cleanup & Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean the Overwolf TypeScript sample app into a League of Legends Ward Optimizer base — promote `ts/` to root, strip multi-game support, rebrand, and scaffold feature modules.

**Architecture:** 3-window Overwolf app (background orchestrator, desktop window, in-game overlay) targeting only League of Legends. New `src/features/` directory holds ward-data, game-state, and minimap-overlay placeholder modules with typed interfaces.

**Tech Stack:** TypeScript, Webpack 5, Overwolf API (`@overwolf/overwolf-api-ts`, `@overwolf/types`)

**Spec:** `docs/superpowers/specs/2026-04-04-ward-optimizer-cleanup-design.md`

---

## File Structure

After all tasks are complete:

```
(project root)/
├── public/
│   ├── manifest.json
│   ├── css/
│   │   ├── general.css
│   │   ├── header.css
│   │   ├── desktop.css
│   │   └── in_game.css
│   ├── icons/          (existing icons from ts/public/icons/)
│   └── img/            (existing images from ts/public/img/)
├── src/
│   ├── AppWindow.ts
│   ├── consts.ts
│   ├── types.ts
│   ├── background/
│   │   ├── background.ts
│   │   └── background.html
│   ├── desktop/
│   │   ├── desktop.ts
│   │   └── desktop.html
│   ├── in_game/
│   │   ├── in_game.ts
│   │   └── in_game.html
│   └── features/
│       ├── ward-data.ts
│       ├── game-state.ts
│       └── minimap-overlay.ts
├── webpack.config.js
├── overwolf.webpack.js
├── tsconfig.json
├── package.json
├── README.md
└── docs/
    └── superpowers/
        ├── specs/
        └── plans/
```

---

### Task 1: Promote TypeScript version to project root

**Files:**
- Move: `ts/*` -> project root
- Delete: `native/` directory
- Delete: `ts/` directory (after move)

- [ ] **Step 1: Copy ts/ contents to root**

```bash
cp -r ts/src .
cp -r ts/public .
cp ts/webpack.config.js .
cp ts/overwolf.webpack.js .
cp ts/tsconfig.json .
cp ts/package.json .
cp ts/package-lock.json . 2>/dev/null || true
cp ts/.gitignore . 2>/dev/null || true
```

- [ ] **Step 2: Delete native/ and ts/ directories**

```bash
rm -rf native/
rm -rf ts/
```

- [ ] **Step 3: Verify root structure**

```bash
ls -la src/ public/ webpack.config.js package.json tsconfig.json overwolf.webpack.js
```

Expected: All files present at root level.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: promote ts/ to project root, remove native/"
```

---

### Task 2: Clean manifest.json — League-only, Ward Optimizer branding

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: Replace manifest.json with Ward Optimizer version**

```json
{
  "manifest_version": 1,
  "type": "WebApp",
  "meta": {
    "name": "Ward Optimizer",
    "author": "Ward Optimizer",
    "version": "1.0.0",
    "minimum-overwolf-version": "0.160.0",
    "description": "Suggests optimal ward placements for League of Legends",
    "dock_button_title": "Ward Optimizer",
    "icon": "icons/IconMouseOver.png",
    "icon_gray": "icons/IconMouseNormal.png",
    "launcher_icon": "icons/desktop-icon.ico",
    "window_icon": "icons/IconMouseOver.png"
  },
  "permissions": [
    "Hotkeys",
    "GameInfo"
  ],
  "data": {
    "start_window": "background",
    "hotkeys": {
      "ward_optimizer_showhide": {
        "title": "Show/Hide Ward Optimizer",
        "action-type": "toggle",
        "default": "Ctrl+F"
      }
    },
    "force_browser": "user",
    "windows": {
      "background": {
        "file": "background.html",
        "background_optimization": true,
        "is_background_page": true
      },
      "desktop": {
        "file": "desktop.html",
        "desktop_only": true,
        "native_window": true,
        "resizable": true,
        "transparent": true,
        "override_on_update": true,
        "size": {
          "width": 1212,
          "height": 699
        },
        "min_size": {
          "width": 1212,
          "height": 699
        }
      },
      "in_game": {
        "file": "in_game.html",
        "in_game_only": true,
        "focus_game_takeover": "ReleaseOnHidden",
        "focus_game_takeover_release_hotkey": "ward_optimizer_showhide",
        "resizable": true,
        "transparent": true,
        "override_on_update": true,
        "size": {
          "width": 1212,
          "height": 699
        },
        "min_size": {
          "width": 1212,
          "height": 699
        }
      }
    },
    "game_targeting": {
      "type": "dedicated",
      "game_ids": [5426]
    },
    "game_events": [5426],
    "launch_events": [
      {
        "event": "GameLaunch",
        "event_data": {
          "game_ids": [5426]
        },
        "start_minimized": true
      }
    ],
    "developer": {
      "enable_auto_refresh": true,
      "reload_delay": 1000,
      "filter": "*.*"
    }
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('public/manifest.json','utf8')); console.log('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add public/manifest.json
git commit -m "chore: rebrand manifest to Ward Optimizer, League-only"
```

---

### Task 3: Clean package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json**

```json
{
  "name": "ward-optimizer",
  "version": "1.0.0",
  "description": "Overwolf app that suggests optimal ward placements for League of Legends",
  "main": "index.js",
  "scripts": {
    "build": "webpack --mode=development --env makeOpk",
    "dev": "webpack --watch --mode=development",
    "watch": "webpack --watch --mode=development"
  },
  "keywords": ["overwolf", "league-of-legends", "ward", "optimizer"],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "@overwolf/overwolf-api-ts": "^1.3.0",
    "@overwolf/types": "^2.33.0",
    "clean-webpack-plugin": "^3.0.0",
    "copy-webpack-plugin": "^7.0.0",
    "html-webpack-plugin": "^5.2.0",
    "semver": "^7.3.4",
    "ts-loader": "^8.0.17",
    "typescript": "^4.2.2",
    "webpack": "^5.76.0",
    "webpack-cli": "^4.5.0",
    "zip-a-folder": "^0.0.12"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: rebrand package.json to ward-optimizer v1.0.0"
```

---

### Task 4: Clean consts.ts — League-only with Ward Optimizer naming

**Files:**
- Modify: `src/consts.ts`

- [ ] **Step 1: Replace consts.ts**

```typescript
// League of Legends game class ID
export const kLeagueClassId = 5426;

// Features we subscribe to from League's GEP
export const kLeagueFeatures = [
  'match_info'
];

// For backward compat with background.ts game listener
export const kGameClassIds = [kLeagueClassId];

export const kWindowNames = {
  inGame: 'in_game',
  desktop: 'desktop'
};

export const kHotkeys = {
  toggle: 'ward_optimizer_showhide'
};
```

- [ ] **Step 2: Commit**

```bash
git add src/consts.ts
git commit -m "chore: strip consts to League-only, Ward Optimizer hotkey"
```

---

### Task 5: Create shared types module

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export type GamePhase = 'early' | 'mid' | 'late';
export type TeamSide = 'blue' | 'red';

export interface WardSpot {
  x: number;
  y: number;
  phase: GamePhase;
  side: TeamSide | 'both';
  label: string;
}

export interface GameState {
  phase: GamePhase;
  side: TeamSide;
  matchActive: boolean;
  gameTime: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared Ward Optimizer types"
```

---

### Task 6: Scaffold ward-data.ts

**Files:**
- Create: `src/features/ward-data.ts`

- [ ] **Step 1: Create the features directory and ward-data.ts**

```typescript
import { GamePhase, TeamSide, WardSpot } from '../types';

// Ward spot definitions — populated during implementation
const wardSpots: WardSpot[] = [];

export function getWardSuggestions(phase: GamePhase, side: TeamSide): WardSpot[] {
  return wardSpots.filter(spot =>
    spot.phase === phase && (spot.side === side || spot.side === 'both')
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/ward-data.ts
git commit -m "feat: scaffold ward-data module with getWardSuggestions"
```

---

### Task 7: Scaffold game-state.ts

**Files:**
- Create: `src/features/game-state.ts`

- [ ] **Step 1: Create game-state.ts**

```typescript
import { GameState, GamePhase, TeamSide } from '../types';

type GameStateCallback = (state: GameState) => void;

// Thresholds in seconds for game phase derivation
const EARLY_GAME_END = 14 * 60;  // 14 minutes
const MID_GAME_END = 25 * 60;    // 25 minutes

function derivePhase(gameTimeSeconds: number): GamePhase {
  if (gameTimeSeconds < EARLY_GAME_END) return 'early';
  if (gameTimeSeconds < MID_GAME_END) return 'mid';
  return 'late';
}

export class GameStateManager {
  private _callback: GameStateCallback | null = null;
  private _state: GameState = {
    phase: 'early',
    side: 'blue',
    matchActive: false,
    gameTime: 0
  };

  public onGameStateChanged(callback: GameStateCallback): void {
    this._callback = callback;
  }

  public getState(): GameState {
    return { ...this._state };
  }

  // Called when match_info events arrive from GEP
  public updateFromMatchInfo(info: any): void {
    // TODO: parse match_info to extract game time and team side
    // For now, this is a placeholder that will be wired during implementation
    const previousPhase = this._state.phase;

    if (info.game_time !== undefined) {
      this._state.gameTime = info.game_time;
      this._state.phase = derivePhase(info.game_time);
    }

    if (info.team_side !== undefined) {
      this._state.side = info.team_side as TeamSide;
    }

    if (info.match_active !== undefined) {
      this._state.matchActive = info.match_active;
    }

    if (this._callback && this._state.phase !== previousPhase) {
      this._callback(this._state);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/game-state.ts
git commit -m "feat: scaffold game-state module with phase derivation"
```

---

### Task 8: Scaffold minimap-overlay.ts

**Files:**
- Create: `src/features/minimap-overlay.ts`

- [ ] **Step 1: Create minimap-overlay.ts**

```typescript
import { WardSpot } from '../types';

export class MinimapOverlay {
  private _container: HTMLElement | null = null;
  private _visible: boolean = false;

  public init(container: HTMLElement): void {
    this._container = container;
  }

  public show(spots: WardSpot[]): void {
    if (!this._container) return;
    this._visible = true;
    this._container.style.display = 'block';
    this.render(spots);
  }

  public hide(): void {
    if (!this._container) return;
    this._visible = false;
    this._container.style.display = 'none';
    this._container.innerHTML = '';
  }

  public update(spots: WardSpot[]): void {
    if (!this._visible || !this._container) return;
    this.render(spots);
  }

  private render(spots: WardSpot[]): void {
    if (!this._container) return;
    // TODO: render ward markers as positioned elements
    // Placeholder — clears and re-renders spot labels
    this._container.innerHTML = '';
    spots.forEach(spot => {
      const marker = document.createElement('div');
      marker.className = 'ward-marker';
      marker.textContent = spot.label;
      marker.style.position = 'absolute';
      marker.style.left = `${spot.x}px`;
      marker.style.top = `${spot.y}px`;
      this._container!.appendChild(marker);
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/minimap-overlay.ts
git commit -m "feat: scaffold minimap-overlay module"
```

---

### Task 9: Clean CSS — remove modal.css, rename ingame.css, strip sample styles

**Files:**
- Delete: `public/css/modal.css`
- Rename: `public/css/ingame.css` -> `public/css/in_game.css`
- Modify: `public/css/in_game.css` (strip event log styles)

**Note:** This must run before HTML template updates (Tasks 10-12) since the templates reference the new `in_game.css` filename.

- [ ] **Step 1: Delete modal.css**

```bash
rm public/css/modal.css
```

- [ ] **Step 2: Rename ingame.css to in_game.css**

```bash
mv public/css/ingame.css public/css/in_game.css
```

- [ ] **Step 3: Replace in_game.css with cleaned version**

Strip event log columns, data text styles, highlight colors, log copy button. Keep base layout.

```css
body {
  background-color: #333333;
  margin: 0px;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  min-height: 100vh;
  overflow: hidden;
}

main {
  display: flex;
  flex: 1;
  position: relative;
  padding: 0;
}

h1 {
  font-family: "Roboto Mono", sans-serif;
  font-style: normal;
  font-weight: normal;
  font-size: 18px;
  color: #d5d5d5;
}

#overlayContainer {
  width: 100%;
  height: 100%;
  position: relative;
}

.ward-marker {
  position: absolute;
  background-color: rgba(0, 222, 250, 0.7);
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  pointer-events: none;
}
```

- [ ] **Step 4: Commit**

```bash
git add -A public/css/
git commit -m "chore: clean CSS — remove modal, rename ingame, strip sample styles"
```

---

### Task 10: Clean in_game.ts — remove event logging, wire features

**Files:**
- Modify: `src/in_game/in_game.ts`

- [ ] **Step 1: Replace in_game.ts**

```typescript
import {
  OWGames,
  OWGamesEvents,
  OWHotkeys
} from "@overwolf/overwolf-api-ts";

import { AppWindow } from "../AppWindow";
import { kHotkeys, kWindowNames, kLeagueFeatures } from "../consts";
import { GameStateManager } from "../features/game-state";
import { MinimapOverlay } from "../features/minimap-overlay";
import { getWardSuggestions } from "../features/ward-data";

import WindowState = overwolf.windows.WindowStateEx;

class InGame extends AppWindow {
  private static _instance: InGame;
  private _gameEventsListener: OWGamesEvents;
  private _gameState: GameStateManager;
  private _overlay: MinimapOverlay;

  private constructor() {
    super(kWindowNames.inGame);

    this._gameState = new GameStateManager();
    this._overlay = new MinimapOverlay();

    const overlayContainer = document.getElementById('overlayContainer');
    if (overlayContainer) {
      this._overlay.init(overlayContainer);
    }

    this._gameState.onGameStateChanged((state) => {
      const spots = getWardSuggestions(state.phase, state.side);
      this._overlay.update(spots);
    });

    this.setToggleHotkeyBehavior();
    this.setToggleHotkeyText();
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new InGame();
    }

    return this._instance;
  }

  public async run() {
    this._gameEventsListener = new OWGamesEvents(
      {
        onInfoUpdates: this.onInfoUpdates.bind(this),
        onNewEvents: this.onNewEvents.bind(this)
      },
      kLeagueFeatures
    );

    this._gameEventsListener.start();
  }

  private onInfoUpdates(info) {
    this._gameState.updateFromMatchInfo(info);
  }

  private onNewEvents(e) {
    // Future: handle specific game events
  }

  private async setToggleHotkeyText() {
    const gameClassId = await this.getCurrentGameClassId();
    const hotkeyText = await OWHotkeys.getHotkeyText(kHotkeys.toggle, gameClassId);
    const hotkeyElem = document.getElementById('hotkey');
    if (hotkeyElem) {
      hotkeyElem.textContent = hotkeyText;
    }
  }

  private async setToggleHotkeyBehavior() {
    const toggleInGameWindow = async (
      hotkeyResult: overwolf.settings.hotkeys.OnPressedEvent
    ): Promise<void> => {
      const inGameState = await this.getWindowState();

      if (inGameState.window_state === WindowState.NORMAL ||
        inGameState.window_state === WindowState.MAXIMIZED) {
        this.currWindow.minimize();
      } else if (inGameState.window_state === WindowState.MINIMIZED ||
        inGameState.window_state === WindowState.CLOSED) {
        this.currWindow.restore();
      }
    }

    OWHotkeys.onHotkeyDown(kHotkeys.toggle, toggleInGameWindow);
  }

  private async getCurrentGameClassId(): Promise<number | null> {
    const info = await OWGames.getRunningGameInfo();
    return (info && info.isRunning && info.classId) ? info.classId : null;
  }
}

InGame.instance().run();
```

- [ ] **Step 2: Commit**

```bash
git add src/in_game/in_game.ts
git commit -m "feat: clean in_game.ts, wire ward optimizer features"
```

---

### Task 11: Clean in_game.html

**Files:**
- Modify: `src/in_game/in_game.html`

- [ ] **Step 1: Replace in_game.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="../../css/general.css" />
  <link rel="stylesheet" href="../../css/header.css" />
  <link rel="stylesheet" href="../../css/in_game.css" />
  <title>Ward Optimizer</title>
</head>
<body class="in-game">
  <header id="header" class="app-header">
    <h1>Ward Optimizer</h1>
    <h1 class="hotkey-text">
      Show/Hide:
      <kbd id="hotkey"></kbd>
    </h1>
    <div class="window-controls-group">
      <button id="minimizeButton" class="window-control window-control-minimize"></button>
      <button id="maximizeButton" class="window-control window-control-maximize"></button>
      <button id="closeButton" class="window-control window-control-close"></button>
    </div>
  </header>

  <main>
    <div id="overlayContainer" style="position: relative; width: 100%; height: 100%;"></div>
  </main>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/in_game/in_game.html
git commit -m "chore: clean in_game.html for Ward Optimizer overlay"
```

---

### Task 12: Clean desktop.html

**Files:**
- Modify: `src/desktop/desktop.html`

- [ ] **Step 1: Replace desktop.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="../../css/general.css" />
  <link rel="stylesheet" href="../../css/header.css" />
  <link rel="stylesheet" href="../../css/desktop.css" />
  <title>Ward Optimizer</title>
</head>
<body class="desktop">
  <header id="header" class="app-header">
    <h1>Ward Optimizer</h1>
    <div class="window-controls-group">
      <button id="minimizeButton" class="window-control window-control-minimize"></button>
      <button id="maximizeButton" class="window-control window-control-maximize"></button>
      <button id="closeButton" class="window-control window-control-close"></button>
    </div>
  </header>

  <main>
    <div class="desktopTop">
      <h1>Ward Optimizer</h1>
      <p>
        Suggests optimal ward placements for League of Legends<br />
        based on game phase and team side.
      </p>
    </div>
    <div class="desktopBottom">
      <div id="left">
        <h1>Launch League of Legends and the overlay will appear automatically!</h1>
      </div>
      <div id="middle">
        Ward Optimizer helps you:
        <br /><br />
        1. See recommended ward positions based on the current game phase (early, mid, late).
        <br /><br />
        2. Get team-side specific suggestions (blue side vs red side).
        <br /><br />
        3. Toggle the overlay with a hotkey while in-game.
      </div>
    </div>
  </main>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/desktop/desktop.html
git commit -m "chore: rebrand desktop.html to Ward Optimizer"
```

---

### Task 13: Clean background.ts — simplify for League-only

**Files:**
- Modify: `src/background/background.ts`

- [ ] **Step 1: Replace background.ts**

No functional changes needed — just update the import to use the simplified consts. The existing logic already works with `kGameClassIds` and `kWindowNames`.

```typescript
import {
  OWGames,
  OWGameListener,
  OWWindow
} from '@overwolf/overwolf-api-ts';

import { kWindowNames, kGameClassIds } from "../consts";

import RunningGameInfo = overwolf.games.RunningGameInfo;
import AppLaunchTriggeredEvent = overwolf.extensions.AppLaunchTriggeredEvent;

class BackgroundController {
  private static _instance: BackgroundController;
  private _windows: Record<string, OWWindow> = {};
  private _gameListener: OWGameListener;

  private constructor() {
    this._windows[kWindowNames.desktop] = new OWWindow(kWindowNames.desktop);
    this._windows[kWindowNames.inGame] = new OWWindow(kWindowNames.inGame);

    this._gameListener = new OWGameListener({
      onGameStarted: this.toggleWindows.bind(this),
      onGameEnded: this.toggleWindows.bind(this)
    });

    overwolf.extensions.onAppLaunchTriggered.addListener(
      e => this.onAppLaunchTriggered(e)
    );
  }

  public static instance(): BackgroundController {
    if (!BackgroundController._instance) {
      BackgroundController._instance = new BackgroundController();
    }

    return BackgroundController._instance;
  }

  public async run() {
    this._gameListener.start();

    const currWindowName = (await this.isSupportedGameRunning())
      ? kWindowNames.inGame
      : kWindowNames.desktop;

    this._windows[currWindowName].restore();
  }

  private async onAppLaunchTriggered(e: AppLaunchTriggeredEvent) {
    if (!e || e.origin.includes('gamelaunchevent')) {
      return;
    }

    if (await this.isSupportedGameRunning()) {
      this._windows[kWindowNames.desktop].close();
      this._windows[kWindowNames.inGame].restore();
    } else {
      this._windows[kWindowNames.desktop].restore();
      this._windows[kWindowNames.inGame].close();
    }
  }

  private toggleWindows(info: RunningGameInfo) {
    if (!info || !this.isSupportedGame(info)) {
      return;
    }

    if (info.isRunning) {
      this._windows[kWindowNames.desktop].close();
      this._windows[kWindowNames.inGame].restore();
    } else {
      this._windows[kWindowNames.desktop].restore();
      this._windows[kWindowNames.inGame].close();
    }
  }

  private async isSupportedGameRunning(): Promise<boolean> {
    const info = await OWGames.getRunningGameInfo();
    return info && info.isRunning && this.isSupportedGame(info);
  }

  private isSupportedGame(info: RunningGameInfo) {
    return kGameClassIds.includes(info.classId);
  }
}

BackgroundController.instance().run();
```

- [ ] **Step 2: Commit**

```bash
git add src/background/background.ts
git commit -m "chore: clean background.ts, remove sample comments"
```

---

### Task 14: Create README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Replace README.md**

```markdown
# Ward Optimizer

An Overwolf app that suggests optimal ward placements for League of Legends based on game phase and team side.

## Setup

```bash
npm install
```

## Development

Watch mode (rebuilds on file changes):

```bash
npm run dev
```

## Build

Build and package as .opk:

```bash
npm run build
```

The .opk file will be in `releases/`.

## Architecture

- **background** — Invisible window that orchestrates app lifecycle (detects League launch, manages windows)
- **desktop** — Shown when League is not running
- **in_game** — Shown during a League match, hosts the ward suggestion overlay

## Features (src/features/)

- **ward-data.ts** — Ward spot definitions and filtering by phase/side
- **game-state.ts** — Reads match context from Overwolf GEP events
- **minimap-overlay.ts** — Renders ward suggestion markers
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for Ward Optimizer"
```

---

### Task 15: Install dependencies and verify build

**Files:** None (verification only)

- [ ] **Step 1: Install npm dependencies**

```bash
npm install
```

Expected: Dependencies install without errors.

- [ ] **Step 2: Run webpack build**

```bash
npx webpack --mode=development
```

Expected: Build succeeds, `dist/` directory created with `js/background.js`, `js/desktop.js`, `js/in_game.js`, and HTML files.

- [ ] **Step 3: Verify dist output**

```bash
ls dist/js/ dist/*.html
```

Expected: `background.js`, `desktop.js`, `in_game.js`, `background.html`, `desktop.html`, `in_game.html`

- [ ] **Step 4: Commit any lockfile changes**

```bash
git add package-lock.json 2>/dev/null; git diff --cached --quiet || git commit -m "chore: update lockfile"
```
