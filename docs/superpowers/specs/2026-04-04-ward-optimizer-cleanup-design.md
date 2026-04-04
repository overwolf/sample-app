# Ward Optimizer — Sample App Cleanup & Scaffold

## Summary

Clean the Overwolf TypeScript sample app into a base for a League of Legends Ward Optimizer. The app suggests optimal ward placements based on basic match context (game phase, team side). Display is a minimap-adjacent overlay highlighting recommended positions.

## Approach

**Approach B: Promote TypeScript to root.** Move `ts/` contents to the project root, delete `native/`, then clean and scaffold.

## Project Structure (After Cleanup)

```
ward-optimizer/
├── public/
│   ├── manifest.json          # Overwolf manifest — League only, Ward Optimizer branding
│   ├── css/
│   │   ├── general.css
│   │   ├── header.css
│   │   ├── desktop.css
│   │   └── in_game.css        # Renamed from ingame.css for consistency
│   └── icons/
├── src/
│   ├── AppWindow.ts           # Base window class (kept from sample)
│   ├── consts.ts              # League-only config
│   ├── background/
│   │   ├── background.ts      # Orchestrator (cleaned)
│   │   └── background.html
│   ├── desktop/
│   │   ├── desktop.ts         # Desktop window (cleaned)
│   │   └── desktop.html
│   ├── in_game/
│   │   ├── in_game.ts         # In-game window (gutted, hosts overlay)
│   │   └── in_game.html
│   └── features/              # Ward Optimizer scaffolding
│       ├── ward-data.ts       # Ward spot definitions
│       ├── game-state.ts      # Reads game phase/time/side from GEP
│       └── minimap-overlay.ts # Renders ward suggestions near minimap
├── webpack.config.js
├── tsconfig.json
├── package.json
└── README.md
```

### Removed

- `native/` folder (entire JavaScript version)
- Multi-game support (all games except League of Legends)
- Sample event logging UI and logic
- `modal.css`

### Added

- `src/features/` directory with 3 placeholder modules

## Manifest & Configuration

### manifest.json

- **Name:** Ward Optimizer
- **Description:** Suggests optimal ward placements for League of Legends
- **Version:** 1.0.0
- **Supported game:** League of Legends only (ID `5426`)
- **Permissions:** `Hotkeys`, `GameInfo`
- **Hotkey:** `ward_optimizer_showhide` bound to `Ctrl+F`
- **Windows:** background, desktop, in_game (same 3-window architecture)

### consts.ts

- Single game: League of Legends (ID `5426`)
- Features: `match_info` (provides game phase, game time)
- Window names and hotkey ID renamed to Ward Optimizer

### package.json

- Name: `ward-optimizer`
- Version: `1.0.0`
- Dependencies unchanged (Overwolf API, webpack stack)

## Scaffold Modules

### Types

```typescript
type GamePhase = 'early' | 'mid' | 'late';
type TeamSide = 'blue' | 'red';

interface WardSpot {
  x: number;
  y: number;
  phase: GamePhase;
  side: TeamSide | 'both';
  label: string;
}

interface GameState {
  phase: GamePhase;
  side: TeamSide;
  matchActive: boolean;
  gameTime: number;
}
```

### ward-data.ts

- Exports ward spot definitions as structured data
- Each spot has coordinates, applicable game phase, team side, and a label
- Public interface: `getWardSuggestions(phase: GamePhase, side: TeamSide): WardSpot[]`
- Starts with empty/minimal data — populated during implementation

### game-state.ts

- Listens to `match_info` events from League's GEP via Overwolf API
- Derives game phase from game time (early/mid/late thresholds)
- Exposes team side and match status
- Public interface: callback pattern `onGameStateChanged(callback: (state: GameState) => void)`

### minimap-overlay.ts

- Placeholder class for rendering ward markers relative to the minimap
- Public interface: `show(spots: WardSpot[])`, `hide()`, `update(spots: WardSpot[])`
- Actual rendering logic deferred to implementation

## Existing File Changes

### in_game.ts

- Remove all event logging logic (colored log, auto-scroll, event highlighting)
- Keep: extends `AppWindow`, hotkey toggle setup
- Add: instantiate feature modules, wire game state changes to ward suggestion updates

### in_game.html

- Strip event log UI
- Keep window header (drag, minimize, close)
- Add placeholder container for minimap overlay

### desktop.html

- Replace sample welcome text with Ward Optimizer branding
- Keep header controls

### desktop.ts

- Stays minimal — just instantiates `AppWindow`

### background.ts

- Keep orchestrator logic (game launch detection, window switching)
- Update window name references
- Remove multi-game feature registration — hardcode League features

### CSS

- Remove `modal.css`
- Keep `general.css`, `header.css`, `desktop.css`, `in_game.css`
- Remove sample-specific styles (event log colors, etc.)
- Update any sample branding colors/styles

### HTML templates

- Update all page titles to "Ward Optimizer"

## Future Scope (Not in this spec)

- Ward timer tracking
- Enemy ward position tracking
- Post-game warding analysis
- Champion/role-aware suggestions
- Full game state awareness (kills, objectives, gold)
