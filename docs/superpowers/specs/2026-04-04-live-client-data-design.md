# Live Client Data API Integration — Design Spec

## Summary

Integrate League's Live Client Data API (`https://127.0.0.1:2999`) to replace static phase-based ward suggestions with a dynamic scoring system. The `GameStateManager` becomes a unified state hub that merges data from both the Live Client Data API (polled every 3s) and Overwolf GEP events. Ward spots are scored against the rich game state, and the top `wardCount + 2` spots are displayed on the overlay. Defensive wards render as pink dots, others as cyan.

## Approach

Approach C from brainstorming: extend `GameStateManager` to consume both GEP and Live Client Data, producing a single rich `GameState`. Ward suggestions use a weighted condition scoring system instead of simple phase/side filtering.

## Rich Game State

The `GameState` type expands to include all signals needed for intelligent ward recommendations:

```typescript
interface GameState {
  // Core
  phase: GamePhase;
  side: TeamSide;
  matchActive: boolean;
  gameTime: number;

  // Team economy
  teamGold: number;
  enemyGold: number;
  goldAdvantage: number;       // positive = ahead, negative = behind
  teamKills: number;
  enemyKills: number;

  // Active player
  activePlayerChampion: string;
  activePlayerLevel: number;
  activePlayerDead: boolean;
  wardCount: number;           // stealth wards + control wards available

  // Objectives
  dragonsKilled: number;
  enemyDragonsKilled: number;
  grubsKilled: number;
  enemyGrubsKilled: number;
  heraldKilled: boolean;
  enemyHeraldKilled: boolean;
  baronAlive: boolean;
  dragonAlive: boolean;
  heraldAlive: boolean;
  grubsAlive: boolean;
  lastDragonKillTime: number;
  lastBaronKillTime: number;
  lastHeraldKillTime: number;
  lastGrubsKillTime: number;

  // Recent events
  recentEvents: GameEvent[];   // last 30 seconds of events
}
```

### Objective spawn rules

- **Dragon:** first spawns at 5:00, respawns 5 min after killed
- **Baron:** first spawns at 20:00, respawns 6 min after killed
- **Herald:** spawns at 14:00, can spawn twice. Despawns at 19:45 when baron spawns
- **Grubs:** spawn at 5:00, respawn once. Gone after 14:00 when herald spawns

### Ward count detection

The Live Client Data API provides the active player's items. Ward count is calculated from:
- Warding Totem trinket charges
- Control Wards in inventory
- Support item ward charges (if applicable)

## Live Client Data Polling Module

New file: `src/features/live-client.ts`

- Polls `https://127.0.0.1:2999/liveclientdata/allgamedata` every 3 seconds
- Uses `overwolf.web.sendHttpRequest` to bypass self-signed certificate issues
- Starts polling when match begins, stops when match ends
- Returns parsed JSON to a callback
- Handles connection failures silently (API unavailable for first ~15-30s of game)
- No retry storms — if a request fails, wait for next poll cycle

## Ward Suggestion Scoring Engine

### Ward definition structure

Each ward spot defines weighted conditions instead of a simple phase/side filter:

```typescript
type WardType = 'offensive' | 'defensive' | 'neutral';

interface WardCondition {
  signal: string;
  weight: number;
}

interface WardDefinition {
  x: number;
  y: number;
  label: string;
  side: TeamSide | 'both';
  type: WardType;
  conditions: WardCondition[];
}

interface ScoredWardSpot {
  x: number;
  y: number;
  label: string;
  type: WardType;
  score: number;
}
```

### Available signals

| Signal | True when |
|--------|-----------|
| `earlyGame` | gameTime < 14min |
| `midGame` | 14min < gameTime < 25min |
| `lateGame` | gameTime > 25min |
| `dragonSpawningSoon` | dragon respawns within 60s |
| `baronSpawningSoon` | baron respawns within 60s |
| `heraldAlive` | herald is on the map |
| `grubsAlive` | grubs are on the map |
| `teamAhead` | goldAdvantage > 2000 |
| `teamBehind` | goldAdvantage < -2000 |
| `teamEven` | goldAdvantage between -2000 and 2000 |
| `recentTeammateDeath` | a teammate died in last 30s |
| `recentEnemyKill` | team got a kill in last 30s |
| `activePlayerAlive` | player is not dead |
| `blueSide` | playing on blue side |
| `redSide` | playing on red side |

### Scoring

For each ward spot: `score = sum of weights where condition signal is true`. Ward spots with score 0 are excluded. Results sorted by score descending.

### Display count

Show the top `wardCount + 2` ward spots. The `+2` buffer gives the player more options than they have wards available.

## Rendering

- **Cyan dots** — neutral and offensive ward spots (current style)
- **Pink dots** — defensive ward spots (wards suggested when behind or protecting own jungle)
- Ward type (`offensive` / `defensive` / `neutral`) determines dot color
- Overlay only re-renders if the scored ward list actually changed (different spots or different order)

## File Structure

### New files

- `src/features/live-client.ts` — Polls Live Client Data API, returns raw JSON

### Modified files

- `src/types.ts` — Expanded `GameState`, add `GameEvent`, `WardCondition`, `WardDefinition`, `ScoredWardSpot`, `WardType`
- `src/features/game-state.ts` — Rewrite: consumes both GEP events and live client data, produces unified rich state, notifies on any change
- `src/features/ward-data.ts` — Rewrite: ward spots with weighted conditions, scoring engine, returns `ScoredWardSpot[]`
- `src/features/minimap-overlay.ts` — Accept `ScoredWardSpot[]`, render pink vs cyan based on ward type
- `src/in_game/in_game.ts` — Start/stop live client polling, pass data to game state manager, update overlay on every state change
- `public/css/in_game.css` — Add pink ward marker style
- `public/manifest.json` — May need additional permissions for HTTP requests

### Data flow

```
Live Client API (every 3s) ──→ GameStateManager ──→ ward scoring ──→ MinimapOverlay
GEP events (on trigger)    ──→      ↑                                      ↑
                                    │                                      │
                              Unified GameState       ScoredWardSpot[] (top wardCount+2)
```

## Limitations

- **No kill/death coordinates** — neither GEP nor Live Client Data API provides location data for kills/deaths. Kill events shift ward priority (offensive vs defensive) but can't target specific map areas.
- **API availability** — Live Client Data API only available ~15-30s into a game. Falls back to GEP-only state until API responds.
- **Self-signed cert** — handled via `overwolf.web.sendHttpRequest`

## Future scope (not in this spec)

- GEP event-driven rule engine (layer 2)
- Full rule engine with complex conditions (layer 3)
- Champion/role-aware ward suggestions
- Ward timer tracking
