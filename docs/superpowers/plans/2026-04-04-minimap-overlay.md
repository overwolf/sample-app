# Minimap Overlay Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen transparent overlay that positions ward markers directly on the player's League of Legends minimap, with auto-detection from League config and manual calibration.

**Architecture:** The in-game window becomes a full-screen clickthrough overlay. `minimap-config` detects minimap bounds (from League config or manual calibration). `minimap-overlay` renders ward markers at normalized-to-screen coordinates using DOM diffing. `calibration-ui` provides drag/resize interaction for manual alignment.

**Tech Stack:** TypeScript, Overwolf API (`overwolf.games`, `overwolf.windows`, `overwolf.io`), DOM manipulation

**Spec:** `docs/superpowers/specs/2026-04-04-minimap-overlay-design.md`

---

## File Structure

```
src/
├── types.ts                        # Modified: add MinimapBounds, MinimapConfig interfaces, document WardSpot coords
├── features/
│   ├── minimap-config.ts           # New: minimap detection, config persistence, bounds calculation
│   ├── minimap-overlay.ts          # Rewrite: DOM diffing, screen-position rendering
│   ├── calibration-ui.ts           # New: drag/resize calibration box, clickthrough toggle
│   ├── ward-data.ts                # Unchanged
│   └── game-state.ts               # Unchanged
├── in_game/
│   ├── in_game.ts                  # Modified: wire minimap-config, calibrate button, resolution listener
│   └── in_game.html                # Modified: add calibrate button, remove header for overlay mode
├── desktop/
│   ├── desktop.ts                  # Modified: add settings panel logic
│   └── desktop.html                # Modified: add settings panel UI
public/
├── manifest.json                   # Modified: full-screen clickthrough overlay
├── css/
│   ├── in_game.css                 # Modified: overlay styles, calibration styles, ward markers
│   └── desktop.css                 # Modified: settings panel styles
```

---

### Task 1: Update manifest.json for full-screen transparent overlay

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: Update in_game window config**

Replace the `"in_game"` window block in `public/manifest.json` with:

```json
"in_game": {
  "file": "in_game.html",
  "in_game_only": true,
  "focus_game_takeover": "ReleaseOnHidden",
  "focus_game_takeover_release_hotkey": "ward_optimizer_showhide",
  "transparent": true,
  "clickthrough": true,
  "topmost": true,
  "resizable": false,
  "override_on_update": true,
  "grab_keyboard_focus": false,
  "grab_focus_on_desktop": false
}
```

Key changes: removed `size`/`min_size` (fills screen), added `clickthrough: true`, `topmost: true`, set `resizable: false`, added `grab_keyboard_focus: false`.

- [ ] **Step 2: Commit**

```bash
git add public/manifest.json
git commit -m "chore: configure in_game window as full-screen clickthrough overlay"
```

---

### Task 2: Update types.ts — add MinimapBounds and MinimapConfig, document coordinates

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Replace types.ts**

```typescript
export type GamePhase = 'early' | 'mid' | 'late';
export type TeamSide = 'blue' | 'red';

export interface WardSpot {
  /** Normalized X coordinate on the minimap (0.0 = left edge, 1.0 = right edge) */
  x: number;
  /** Normalized Y coordinate on the minimap (0.0 = top edge, 1.0 = bottom edge) */
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

/** Minimap position and size in screen pixels */
export interface MinimapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Persisted minimap configuration */
export interface MinimapConfig {
  mode: 'auto' | 'manual';
  manualBounds: (MinimapBounds & { gameWidth: number; gameHeight: number }) | null;
  sideOverride: 'left' | 'right' | null;
  hudScaleOverride: number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add MinimapBounds and MinimapConfig types, document WardSpot coordinates"
```

---

### Task 3: Create minimap-config.ts — minimap detection and config persistence

**Files:**
- Create: `src/features/minimap-config.ts`

- [ ] **Step 1: Create minimap-config.ts**

```typescript
import { MinimapBounds, MinimapConfig } from '../types';

const STORAGE_KEY = 'ward_optimizer_minimap_config';

// Base minimap size at 1080p with default HUD/minimap scale
const BASE_MINIMAP_SIZE_1080P = 260;
const MINIMAP_PADDING = 5;

const DEFAULT_CONFIG: MinimapConfig = {
  mode: 'auto',
  manualBounds: null,
  sideOverride: null,
  hudScaleOverride: null
};

export class MinimapConfigManager {
  private _config: MinimapConfig;
  private _gameWidth: number = 1920;
  private _gameHeight: number = 1080;

  constructor() {
    this._config = this.loadConfig();
  }

  /** Initialize with current game resolution */
  public async init(): Promise<void> {
    try {
      const info = await this.getGameInfo();
      if (info && info.width && info.height) {
        this._gameWidth = info.width;
        this._gameHeight = info.height;
      }
    } catch (e) {
      console.warn('Could not get game resolution, using defaults', e);
    }
  }

  /** Get current minimap bounds in screen pixels */
  public getMinimapBounds(): MinimapBounds {
    if (this._config.mode === 'manual' && this._config.manualBounds) {
      // Check if resolution changed since calibration
      if (this._config.manualBounds.gameWidth === this._gameWidth &&
          this._config.manualBounds.gameHeight === this._gameHeight) {
        return {
          x: this._config.manualBounds.x,
          y: this._config.manualBounds.y,
          width: this._config.manualBounds.width,
          height: this._config.manualBounds.height
        };
      }
      // Resolution changed — fall through to auto
      console.warn('Resolution changed since calibration, falling back to auto-detect');
    }

    return this.calculateAutoBounds();
  }

  /** Calculate minimap bounds from game resolution and config/overrides */
  private calculateAutoBounds(): MinimapBounds {
    const hudScale = this._config.hudScaleOverride ?? 1.0;
    const minimapScale = 1.0; // Default, could be read from League config in future
    const isLeftSide = this._config.sideOverride === 'left';

    const scaleFactor = this._gameHeight / 1080;
    const size = Math.round(BASE_MINIMAP_SIZE_1080P * hudScale * minimapScale * scaleFactor);

    const x = isLeftSide
      ? MINIMAP_PADDING
      : this._gameWidth - size - MINIMAP_PADDING;
    const y = this._gameHeight - size - MINIMAP_PADDING;

    return { x, y, width: size, height: size };
  }

  /** Update game resolution (call on resolution change) */
  public updateResolution(width: number, height: number): void {
    this._gameWidth = width;
    this._gameHeight = height;
  }

  public getGameResolution(): { width: number; height: number } {
    return { width: this._gameWidth, height: this._gameHeight };
  }

  /** Save manual calibration bounds */
  public saveManualBounds(bounds: MinimapBounds): void {
    this._config.mode = 'manual';
    this._config.manualBounds = {
      ...bounds,
      gameWidth: this._gameWidth,
      gameHeight: this._gameHeight
    };
    this.saveConfig();
  }

  /** Reset to auto-detection mode */
  public resetToAuto(): void {
    this._config.mode = 'auto';
    this._config.manualBounds = null;
    this.saveConfig();
  }

  /** Set minimap side override */
  public setSideOverride(side: 'left' | 'right' | null): void {
    this._config.sideOverride = side;
    this.saveConfig();
  }

  /** Set HUD scale override */
  public setHudScaleOverride(scale: number | null): void {
    this._config.hudScaleOverride = scale;
    this.saveConfig();
  }

  public getConfig(): MinimapConfig {
    return { ...this._config };
  }

  public isManualMode(): boolean {
    return this._config.mode === 'manual' && this._config.manualBounds !== null;
  }

  private loadConfig(): MinimapConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Could not load minimap config', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config));
    } catch (e) {
      console.warn('Could not save minimap config', e);
    }
  }

  private getGameInfo(): Promise<overwolf.games.RunningGameInfo> {
    return new Promise((resolve, reject) => {
      overwolf.games.getRunningGameInfo((info) => {
        if (info) {
          resolve(info);
        } else {
          reject(new Error('No running game info'));
        }
      });
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/minimap-config.ts
git commit -m "feat: add minimap-config module for bounds detection and persistence"
```

---

### Task 4: Rewrite minimap-overlay.ts — DOM diffing and screen-position rendering

**Files:**
- Modify: `src/features/minimap-overlay.ts`

- [ ] **Step 1: Replace minimap-overlay.ts**

```typescript
import { WardSpot, MinimapBounds } from '../types';
import { MinimapConfigManager } from './minimap-config';

interface RenderedMarker {
  id: string;
  element: HTMLElement;
  spot: WardSpot;
}

function spotId(spot: WardSpot): string {
  return `${spot.x.toFixed(4)}_${spot.y.toFixed(4)}_${spot.label}`;
}

export class MinimapOverlay {
  private _container: HTMLElement | null = null;
  private _configManager: MinimapConfigManager;
  private _renderedMarkers: Map<string, RenderedMarker> = new Map();
  private _visible: boolean = true;

  constructor(configManager: MinimapConfigManager) {
    this._configManager = configManager;
  }

  public init(container: HTMLElement): void {
    this._container = container;
  }

  public show(spots: WardSpot[]): void {
    if (!this._container) return;
    this._visible = true;
    this._container.style.display = 'block';
    this.update(spots);
  }

  public hide(): void {
    if (!this._container) return;
    this._visible = false;
    this._container.style.display = 'none';
    this.clearAll();
  }

  /** Update displayed ward markers with DOM diffing */
  public update(spots: WardSpot[]): void {
    if (!this._visible || !this._container) return;

    const bounds = this._configManager.getMinimapBounds();
    const newSpotIds = new Set<string>();

    // Add or update markers
    for (const spot of spots) {
      const id = spotId(spot);
      newSpotIds.add(id);

      const existing = this._renderedMarkers.get(id);
      if (existing) {
        // Reposition existing marker
        this.positionMarker(existing.element, spot, bounds);
      } else {
        // Create new marker
        const element = this.createMarkerElement(spot, bounds);
        this._container.appendChild(element);
        this._renderedMarkers.set(id, { id, element, spot });
      }
    }

    // Remove markers no longer in the list
    for (const [id, marker] of this._renderedMarkers) {
      if (!newSpotIds.has(id)) {
        marker.element.remove();
        this._renderedMarkers.delete(id);
      }
    }
  }

  /** Reposition all markers (call after resolution/minimap config change) */
  public repositionAll(): void {
    if (!this._visible) return;
    const bounds = this._configManager.getMinimapBounds();
    for (const marker of this._renderedMarkers.values()) {
      this.positionMarker(marker.element, marker.spot, bounds);
    }
  }

  private createMarkerElement(spot: WardSpot, bounds: MinimapBounds): HTMLElement {
    const marker = document.createElement('div');
    marker.className = 'ward-marker';
    marker.setAttribute('data-label', spot.label);
    marker.title = spot.label;
    this.positionMarker(marker, spot, bounds);
    return marker;
  }

  private positionMarker(element: HTMLElement, spot: WardSpot, bounds: MinimapBounds): void {
    const screenX = bounds.x + (spot.x * bounds.width);
    const screenY = bounds.y + (spot.y * bounds.height);
    element.style.left = `${Math.round(screenX)}px`;
    element.style.top = `${Math.round(screenY)}px`;
  }

  private clearAll(): void {
    for (const marker of this._renderedMarkers.values()) {
      marker.element.remove();
    }
    this._renderedMarkers.clear();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/minimap-overlay.ts
git commit -m "feat: rewrite minimap-overlay with DOM diffing and screen-position rendering"
```

---

### Task 5: Create calibration-ui.ts — drag/resize calibration box

**Files:**
- Create: `src/features/calibration-ui.ts`

- [ ] **Step 1: Create calibration-ui.ts**

```typescript
import { MinimapBounds } from '../types';
import { MinimapConfigManager } from './minimap-config';

type CalibrationCallback = () => void;

export class CalibrationUI {
  private _configManager: MinimapConfigManager;
  private _container: HTMLElement;
  private _overlay: HTMLElement | null = null;
  private _box: HTMLElement | null = null;
  private _active: boolean = false;
  private _onComplete: CalibrationCallback | null = null;
  private _onCancel: CalibrationCallback | null = null;

  // Drag state
  private _dragging: boolean = false;
  private _resizing: boolean = false;
  private _dragStartX: number = 0;
  private _dragStartY: number = 0;
  private _boxStartX: number = 0;
  private _boxStartY: number = 0;
  private _boxStartW: number = 0;
  private _boxStartH: number = 0;

  // Bound event handlers (stored so we can remove them)
  private _boundMouseMove: (e: MouseEvent) => void;
  private _boundMouseUp: () => void;

  constructor(configManager: MinimapConfigManager, container: HTMLElement) {
    this._configManager = configManager;
    this._container = container;
    this._boundMouseMove = this.onMouseMove.bind(this);
    this._boundMouseUp = this.onMouseUp.bind(this);
  }

  public start(onComplete: CalibrationCallback, onCancel: CalibrationCallback): void {
    if (this._active) return;
    this._active = true;
    this._onComplete = onComplete;
    this._onCancel = onCancel;

    // Disable clickthrough
    this.setClickthrough(false);

    // Get current bounds as starting position
    const bounds = this._configManager.getMinimapBounds();

    // Create calibration overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'calibration-overlay';

    // Create the draggable/resizable box
    this._box = document.createElement('div');
    this._box.className = 'calibration-box';
    this._box.style.left = `${bounds.x}px`;
    this._box.style.top = `${bounds.y}px`;
    this._box.style.width = `${bounds.width}px`;
    this._box.style.height = `${bounds.height}px`;

    // Resize handle (bottom-right corner)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'calibration-resize-handle';
    resizeHandle.addEventListener('mousedown', this.onResizeStart.bind(this));
    this._box.appendChild(resizeHandle);

    // Instruction text
    const instructions = document.createElement('div');
    instructions.className = 'calibration-instructions';
    instructions.textContent = 'Drag to move, corner to resize';
    this._box.appendChild(instructions);

    // Buttons
    const btnContainer = document.createElement('div');
    btnContainer.className = 'calibration-buttons';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'calibration-btn calibration-btn-confirm';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', this.onConfirm.bind(this));

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'calibration-btn calibration-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', this.onCancelClick.bind(this));

    btnContainer.appendChild(confirmBtn);
    btnContainer.appendChild(cancelBtn);
    this._box.appendChild(btnContainer);

    // Drag on the box itself
    this._box.addEventListener('mousedown', this.onDragStart.bind(this));

    this._overlay.appendChild(this._box);
    this._container.appendChild(this._overlay);

    // Global mouse event listeners
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('mouseup', this._boundMouseUp);
  }

  public isActive(): boolean {
    return this._active;
  }

  private onDragStart(e: MouseEvent): void {
    // Don't start drag if clicking a button or resize handle
    if ((e.target as HTMLElement).closest('.calibration-btn, .calibration-resize-handle')) return;
    e.preventDefault();
    this._dragging = true;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._boxStartX = this._box!.offsetLeft;
    this._boxStartY = this._box!.offsetTop;
  }

  private onResizeStart(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this._resizing = true;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._boxStartW = this._box!.offsetWidth;
    this._boxStartH = this._box!.offsetHeight;
  }

  private onMouseMove(e: MouseEvent): void {
    if (this._dragging && this._box) {
      const dx = e.clientX - this._dragStartX;
      const dy = e.clientY - this._dragStartY;
      this._box.style.left = `${this._boxStartX + dx}px`;
      this._box.style.top = `${this._boxStartY + dy}px`;
    } else if (this._resizing && this._box) {
      const dx = e.clientX - this._dragStartX;
      const dy = e.clientY - this._dragStartY;
      // Keep square aspect ratio — use the larger delta
      const delta = Math.max(dx, dy);
      const newSize = Math.max(100, this._boxStartW + delta);
      this._box.style.width = `${newSize}px`;
      this._box.style.height = `${newSize}px`;
    }
  }

  private onMouseUp(): void {
    this._dragging = false;
    this._resizing = false;
  }

  private onConfirm(): void {
    if (!this._box) return;

    const bounds: MinimapBounds = {
      x: this._box.offsetLeft,
      y: this._box.offsetTop,
      width: this._box.offsetWidth,
      height: this._box.offsetHeight
    };

    this._configManager.saveManualBounds(bounds);
    this.cleanup();

    if (this._onComplete) this._onComplete();
  }

  private onCancelClick(): void {
    this.cleanup();
    if (this._onCancel) this._onCancel();
  }

  private cleanup(): void {
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mouseup', this._boundMouseUp);

    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    this._box = null;
    this._active = false;

    // Re-enable clickthrough
    this.setClickthrough(true);
  }

  private setClickthrough(enabled: boolean): void {
    const windowId = 'in_game';
    if (enabled) {
      overwolf.windows.setWindowStyle(windowId, overwolf.windows.enums.WindowStyle.InputPassThrough, () => {});
    } else {
      overwolf.windows.removeWindowStyle(windowId, overwolf.windows.enums.WindowStyle.InputPassThrough, () => {});
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/calibration-ui.ts
git commit -m "feat: add calibration-ui with drag/resize interaction"
```

---

### Task 6: Update in_game.html — full-screen overlay layout with calibrate button

**Files:**
- Modify: `src/in_game/in_game.html`

- [ ] **Step 1: Replace in_game.html**

The header becomes a small floating bar (only visible when clickthrough is disabled via hotkey). The overlay container fills the entire screen.

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
  <header id="header" class="app-header overlay-header">
    <h1>Ward Optimizer</h1>
    <button id="calibrateButton" class="header-btn">Calibrate</button>
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

  <div id="overlayContainer"></div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/in_game/in_game.html
git commit -m "chore: update in_game.html for full-screen overlay with calibrate button"
```

---

### Task 7: Update in_game.css — overlay and calibration styles

**Files:**
- Modify: `public/css/in_game.css`

- [ ] **Step 1: Replace in_game.css**

```css
/* Full-screen overlay body */
body {
  background: transparent;
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  font-size: 14px;
}

/* Floating header — hidden by default, shown during interaction */
.overlay-header {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  background-color: rgba(39, 39, 39, 0.9);
  border-radius: 0 0 8px 8px;
  padding: 4px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.overlay-header h1 {
  font-size: 12px;
}

/* Calibrate button in header */
.header-btn {
  background: #525252;
  color: #d5d5d5;
  border: none;
  border-radius: 3px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}

.header-btn:hover {
  background: #6a6a6a;
  color: #fff;
}

/* Full-screen overlay container */
#overlayContainer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

/* Ward markers */
.ward-marker {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: rgba(0, 222, 250, 0.5);
  border: 2px solid rgba(0, 222, 250, 0.9);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 100;
}

.ward-marker:hover {
  background-color: rgba(0, 222, 250, 0.8);
}

/* Calibration overlay */
.calibration-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.3);
  z-index: 5000;
}

/* Calibration box */
.calibration-box {
  position: absolute;
  border: 3px solid rgba(0, 222, 250, 0.8);
  background: rgba(0, 222, 250, 0.15);
  cursor: move;
  z-index: 5001;
}

.calibration-resize-handle {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 14px;
  height: 14px;
  background: rgba(0, 222, 250, 0.9);
  border-radius: 2px;
  cursor: nwse-resize;
}

.calibration-instructions {
  position: absolute;
  top: -28px;
  left: 0;
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.calibration-buttons {
  position: absolute;
  bottom: -40px;
  left: 0;
  display: flex;
  gap: 8px;
}

.calibration-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
}

.calibration-btn-confirm {
  background: rgba(0, 222, 250, 0.9);
  color: #000;
}

.calibration-btn-confirm:hover {
  background: rgba(0, 222, 250, 1);
}

.calibration-btn-cancel {
  background: #525252;
  color: #d5d5d5;
}

.calibration-btn-cancel:hover {
  background: #6a6a6a;
  color: #fff;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/css/in_game.css
git commit -m "feat: add overlay, ward marker, and calibration styles"
```

---

### Task 8: Rewrite in_game.ts — wire everything together

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
import { MinimapConfigManager } from "../features/minimap-config";
import { CalibrationUI } from "../features/calibration-ui";
import { getWardSuggestions } from "../features/ward-data";

import WindowState = overwolf.windows.WindowStateEx;

class InGame extends AppWindow {
  private static _instance: InGame;
  private _gameEventsListener: OWGamesEvents;
  private _gameState: GameStateManager;
  private _overlay: MinimapOverlay;
  private _minimapConfig: MinimapConfigManager;
  private _calibrationUI: CalibrationUI | null = null;

  private constructor() {
    super(kWindowNames.inGame);

    this._minimapConfig = new MinimapConfigManager();
    this._gameState = new GameStateManager();
    this._overlay = new MinimapOverlay(this._minimapConfig);

    const overlayContainer = document.getElementById('overlayContainer');
    if (overlayContainer) {
      this._overlay.init(overlayContainer);
      this._calibrationUI = new CalibrationUI(this._minimapConfig, overlayContainer);
    }

    // Wire game state changes to overlay updates
    this._gameState.onGameStateChanged((state) => {
      const spots = getWardSuggestions(state.phase, state.side);
      this._overlay.update(spots);
    });

    // Wire calibrate button
    const calibrateBtn = document.getElementById('calibrateButton');
    if (calibrateBtn) {
      calibrateBtn.addEventListener('click', () => this.startCalibration());
    }

    this.setToggleHotkeyBehavior();
    this.setToggleHotkeyText();
    this.listenForResolutionChanges();
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new InGame();
    }

    return this._instance;
  }

  public async run() {
    // Initialize minimap config with game resolution
    await this._minimapConfig.init();

    this._gameEventsListener = new OWGamesEvents(
      {
        onInfoUpdates: this.onInfoUpdates.bind(this),
        onNewEvents: this.onNewEvents.bind(this)
      },
      kLeagueFeatures
    );

    this._gameEventsListener.start();
  }

  private startCalibration(): void {
    if (this._calibrationUI && !this._calibrationUI.isActive()) {
      this._calibrationUI.start(
        () => {
          // On complete — reposition overlay markers with new bounds
          this._overlay.repositionAll();
        },
        () => {
          // On cancel — no action needed
        }
      );
    }
  }

  private listenForResolutionChanges(): void {
    overwolf.games.onGameInfoUpdated.addListener((event) => {
      if (event && event.gameInfo) {
        const info = event.gameInfo;
        if (info.width && info.height) {
          const currentRes = this._minimapConfig.getGameResolution();
          if (info.width !== currentRes.width || info.height !== currentRes.height) {
            this._minimapConfig.updateResolution(info.width, info.height);
            this._overlay.repositionAll();
          }
        }
      }
    });
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
git commit -m "feat: wire minimap config, calibration, and resolution listener into in_game"
```

---

### Task 9: Update desktop.html — add settings panel

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
        <h2>Minimap Settings</h2>
        <div class="settings-group">
          <label class="setting-label">
            Detection Mode:
            <span id="modeDisplay" class="setting-value">Auto</span>
          </label>
          <button id="resetAutoBtn" class="settings-btn">Reset to Auto-Detect</button>
        </div>
        <div class="settings-group">
          <label class="setting-label">
            Minimap Side:
            <select id="sideSelect" class="settings-select">
              <option value="">Auto (from config)</option>
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </label>
        </div>
        <div class="settings-group">
          <label class="setting-label">
            HUD Scale Override:
            <input id="hudScaleInput" type="range" min="0.1" max="1.5" step="0.05" value="1.0" class="settings-range" />
            <span id="hudScaleValue" class="setting-value">1.0</span>
          </label>
          <button id="resetHudScaleBtn" class="settings-btn">Reset</button>
        </div>
        <p class="settings-hint">
          You can also calibrate the minimap position in-game using the Calibrate button.
        </p>
      </div>
    </div>
  </main>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/desktop/desktop.html
git commit -m "feat: add minimap settings panel to desktop window"
```

---

### Task 10: Update desktop.ts — settings panel logic

**Files:**
- Modify: `src/desktop/desktop.ts`

- [ ] **Step 1: Replace desktop.ts**

```typescript
import { AppWindow } from "../AppWindow";
import { kWindowNames } from "../consts";
import { MinimapConfigManager } from "../features/minimap-config";

class Desktop extends AppWindow {
  private _minimapConfig: MinimapConfigManager;

  constructor() {
    super(kWindowNames.desktop);

    this._minimapConfig = new MinimapConfigManager();
    this.initSettingsPanel();
  }

  private initSettingsPanel(): void {
    const modeDisplay = document.getElementById('modeDisplay');
    const resetAutoBtn = document.getElementById('resetAutoBtn');
    const sideSelect = document.getElementById('sideSelect') as HTMLSelectElement;
    const hudScaleInput = document.getElementById('hudScaleInput') as HTMLInputElement;
    const hudScaleValue = document.getElementById('hudScaleValue');
    const resetHudScaleBtn = document.getElementById('resetHudScaleBtn');

    // Load current config state
    this.updateDisplay();

    // Reset to auto
    if (resetAutoBtn) {
      resetAutoBtn.addEventListener('click', () => {
        this._minimapConfig.resetToAuto();
        this.updateDisplay();
      });
    }

    // Side selector
    if (sideSelect) {
      const config = this._minimapConfig.getConfig();
      if (config.sideOverride) {
        sideSelect.value = config.sideOverride;
      }

      sideSelect.addEventListener('change', () => {
        const value = sideSelect.value;
        this._minimapConfig.setSideOverride(value === '' ? null : value as 'left' | 'right');
        this.updateDisplay();
      });
    }

    // HUD scale slider
    if (hudScaleInput && hudScaleValue) {
      const config = this._minimapConfig.getConfig();
      if (config.hudScaleOverride !== null) {
        hudScaleInput.value = String(config.hudScaleOverride);
        hudScaleValue.textContent = String(config.hudScaleOverride);
      }

      hudScaleInput.addEventListener('input', () => {
        const value = parseFloat(hudScaleInput.value);
        hudScaleValue.textContent = value.toFixed(2);
        this._minimapConfig.setHudScaleOverride(value);
      });
    }

    // Reset HUD scale
    if (resetHudScaleBtn) {
      resetHudScaleBtn.addEventListener('click', () => {
        this._minimapConfig.setHudScaleOverride(null);
        if (hudScaleInput) hudScaleInput.value = '1.0';
        if (hudScaleValue) hudScaleValue.textContent = '1.0';
      });
    }
  }

  private updateDisplay(): void {
    const modeDisplay = document.getElementById('modeDisplay');
    if (modeDisplay) {
      modeDisplay.textContent = this._minimapConfig.isManualMode() ? 'Manual (calibrated)' : 'Auto';
    }
  }
}

new Desktop();
```

- [ ] **Step 2: Commit**

```bash
git add src/desktop/desktop.ts
git commit -m "feat: add minimap settings panel logic to desktop window"
```

---

### Task 11: Update desktop.css — settings panel styles

**Files:**
- Modify: `public/css/desktop.css`

- [ ] **Step 1: Append settings panel styles to desktop.css**

Add at the end of `public/css/desktop.css`:

```css

/* Settings panel */
h2 {
  font-family: "Roboto Mono", sans-serif;
  font-size: 16px;
  color: #d5d5d5;
  margin-bottom: 20px;
}

.settings-group {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.setting-label {
  color: #d5d5d5;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-value {
  color: #00defa;
  font-weight: bold;
}

.settings-btn {
  background: #525252;
  color: #d5d5d5;
  border: none;
  border-radius: 3px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.settings-btn:hover {
  background: #6a6a6a;
  color: #fff;
}

.settings-select {
  background: #525252;
  color: #d5d5d5;
  border: 1px solid #6a6a6a;
  border-radius: 3px;
  padding: 4px 8px;
  font-size: 13px;
}

.settings-range {
  width: 150px;
  accent-color: #00defa;
}

.settings-hint {
  color: #6a6a6a;
  font-size: 12px;
  margin-top: 20px;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/css/desktop.css
git commit -m "feat: add settings panel styles to desktop.css"
```

---

### Task 12: Verify build

**Files:** None (verification only)

- [ ] **Step 1: Run webpack build**

```bash
npx webpack --mode=development
```

Expected: Build succeeds without errors.

- [ ] **Step 2: Verify dist output**

```bash
ls dist/js/ dist/*.html
```

Expected: `background.js`, `desktop.js`, `in_game.js`, HTML files present.

- [ ] **Step 3: Commit if any generated files changed**

```bash
git add -A && git diff --cached --quiet || git commit -m "chore: build verification"
```
