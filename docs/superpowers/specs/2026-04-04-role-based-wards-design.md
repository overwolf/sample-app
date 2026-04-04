# Role-Based Ward Suggestions — Design Spec

## Summary

Add role awareness to the ward scoring engine. The active player's role (Support, Jungle, Mid, Top, ADC) is detected from the Live Client Data API and used as a scoring signal to prioritize ward spots relevant to each role.

## Approach

Extend the existing condition-based scoring system (Approach A). Add 5 role signals and role-based condition weights to existing ward definitions. No new files or architectural changes.

## Role Detection

Add `PlayerRole` type and `activePlayerRole` field to `GameState`:

```typescript
type PlayerRole = 'top' | 'jungle' | 'mid' | 'bottom' | 'support' | 'unknown';
```

`GameStateManager.updateFromLiveClient()` already finds the active player in `allPlayers` by champion name. Read the `position` field and map:

| API `position` | `PlayerRole` |
|----------------|-------------|
| `"TOP"` | `'top'` |
| `"JUNGLE"` | `'jungle'` |
| `"MIDDLE"` | `'mid'` |
| `"BOTTOM"` | `'bottom'` |
| `"UTILITY"` | `'support'` |
| anything else | `'unknown'` |

## Role Signals

Add 5 new signals to the ward scoring evaluators:

| Signal | True when |
|--------|-----------|
| `roleSupport` | activePlayerRole === 'support' |
| `roleJungle` | activePlayerRole === 'jungle' |
| `roleMid` | activePlayerRole === 'mid' |
| `roleTop` | activePlayerRole === 'top' |
| `roleADC` | activePlayerRole === 'bottom' |

## Ward Definition Role Weights

Each ward definition gets additional role condition weights. Weight reflects how important the ward is for that role.

### High priority (weight 20-25)

| Ward | Support | Jungle | Mid | Top | ADC |
|------|---------|--------|-----|-----|-----|
| Bot Tri-Brush | 25 | - | - | - | 20 |
| Bot River Bush | 25 | - | - | - | 20 |
| Dragon Pit | 20 | 20 | - | - | - |
| Dragon Entrance | 15 | 25 | - | - | - |
| Baron Pit | 20 | 20 | - | - | - |
| Herald Entrance | - | 25 | - | 20 | - |
| Grubs Area | - | 25 | - | 20 | - |
| Pixel Brush Bot | - | - | 25 | - | - |
| Pixel Brush Top | - | - | 25 | - | - |
| Mid River | - | - | 20 | - | - |
| Top River Bush | - | - | - | 25 | - |
| Top Tri-Brush | - | - | - | 20 | - |
| Enemy Raptors (blue) | - | 20 | - | - | - |
| Enemy Raptors (red) | - | 20 | - | - | - |

### Medium priority (weight 10-15)

| Ward | Support | Jungle | Mid | Top | ADC |
|------|---------|--------|-----|-----|-----|
| Enemy Red Buff | 10 | 15 | - | - | - |
| Enemy Blue Buff | 10 | 15 | - | - | - |
| Blue Jungle River | 15 | - | - | - | - |
| Red Jungle River | 15 | - | - | - | - |
| Dragon River | - | 10 | 10 | - | - |
| Baron River | - | 10 | 10 | - | - |
| Baron Brush | 10 | - | - | - | - |
| Dragon Entrance | 10 | - | - | - | 10 |

### No role bonus

- ADC gets no bonus on enemy deep wards (shouldn't ward deep alone)
- Top gets no bonus on bot-side wards in early game
- `'unknown'` role gets no role bonuses (falls back to phase/objective scoring only)

## Effect on Scoring

The role weight adds 10-25 points to a ward's score when the player is that role. Combined with existing phase, objective, and team-state signals, this shifts the top-5 displayed wards to match the role's warding priorities.

Example: Dragon Pit with `dragonSpawningSoon` (40) + `midGame` (15) + `roleSupport` (20) = 75 for a support, vs 55 for an ADC (no role bonus).

## Files Modified

- `src/types.ts` — Add `PlayerRole` type, add `activePlayerRole: PlayerRole` to `GameState`
- `src/features/game-state.ts` — Read `position` from active player in `allPlayers`, map to `PlayerRole`
- `src/features/ward-data.ts` — Add 5 role signal evaluators, add role condition weights to ward definitions

No changes to: minimap-overlay.ts, in_game.ts, live-client.ts, CSS, HTML.

## Future Scope

- Ward placement tracking (wardScore changes) to avoid suggesting spots already warded
- Champion-specific ward suggestions (beyond role)
