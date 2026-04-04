# Post-Game Summary — Design Spec

## Summary

After a match ends, display a warding performance summary on the desktop window. Collects ward score, KDA, objectives, and vision data during the game via the Live Client Data API. Generates personalized warding tips. Stores last 10 games with a ward score trend chart.

## Data Collection

During the game, `GameSummary` accumulates stats from the Live Client Data API:

```typescript
interface GameTip {
  text: string;
  type: 'positive' | 'improvement';
}

interface GameSummary {
  matchId: string;
  champion: string;
  role: PlayerRole;
  side: TeamSide;
  win: boolean;
  duration: number;

  kills: number;
  deaths: number;
  assists: number;

  wardScore: number;
  teamAvgWardScore: number;
  wardScoreTimeline: { time: number; score: number }[];

  dragonsKilled: number;
  enemyDragonsKilled: number;
  baronsKilled: number;
  heraldsKilled: number;
  grubsKilled: number;

  earlyGameWardScore: number;
  midGameWardScore: number;
  lateGameWardScore: number;

  tips: GameTip[];
  timestamp: number;
}
```

Ward score snapshots taken every 60 seconds from the `allPlayers` scores data. Phase ward scores derived from timeline (early < 14min, mid 14-25min, late > 25min).

## Game End Detection

Two triggers (whichever fires first):
- Live Client API stops responding after being connected (fetch fails 3 consecutive times)
- GEP `match_end` / `matchEnd` event fires

On game end:
1. Build final `GameSummary` from accumulated data
2. Generate personalized tips
3. Save to `localStorage`

## Data Transfer

Both in-game and desktop windows share `localStorage`:
- `ward_optimizer_last_game` — most recent `GameSummary` JSON
- `ward_optimizer_game_history` — array of last 10 `GameSummary` objects (newest first)

Desktop window polls `localStorage` every 2 seconds for changes via `setInterval`.

## Personalized Tips

Rule-based, 2-3 tips per game. At least one positive tip if applicable.

| Condition | Tip | Type |
|-----------|-----|------|
| wardScore < teamAvgWardScore | "Your ward score was below your team's average. Try to ward more often." | improvement |
| earlyGameWardScore < 5 | "Low early game vision. Place your trinket ward by 1:30 to spot invades." | improvement |
| dragonsKilled < enemyDragonsKilled | "Your team lost dragon control. Ward dragon pit 60s before it spawns." | improvement |
| role is support && wardScore < duration/60 * 1.5 | "As support, aim for 1.5 ward score per minute." | improvement |
| baronsKilled == 0 && duration > 25min | "No baron taken. Prioritize baron vision in late game." | improvement |
| lateGameWardScore == 0 | "You stopped warding in late game. Late vision around baron is critical." | improvement |
| wardScore > teamAvgWardScore * 1.3 | "Great warding! Your vision was above your team's average." | positive |
| wardScore > duration/60 * 1.5 | "Excellent ward score for this game length." | positive |

## Desktop UI

### Tab Navigation

Three tabs at the top of the desktop content area:
- **Home** — existing landing page (hero, settings, tips)
- **Last Game** — post-game summary
- **History** — game list + trend chart

Tabs styled in League theme (gold text, active tab underline).

### Last Game View

- **Header row:** Champion name, role icon, W/L badge, game duration
- **Stats row:** KDA, Ward Score (highlighted), Team Avg Ward Score
- **Ward timeline:** Horizontal bar chart — one bar per minute, height proportional to ward score at that point. Gold bars, dark background.
- **Objectives row:** Dragons, Barons, Heralds, Grubs killed (with icons/numbers)
- **Tips section:** 2-3 tips in hextech card style. Green left border for positive, gold for improvement.

### History View

- **Game list:** 10 rows — champion, role, ward score, W/L, date. Clickable to view that game's summary.
- **Trend chart:** Simple line chart of ward score across games. CSS-rendered (no chart library). Gold line on dark background.

### Styling

All League theme — hextech cards, gold accents, `#010A13` background, `#C89B3C` gold, `#0AC8B9` teal highlights.

## Files

### New files
- `src/features/game-summary.ts` — Collects stats during game, builds GameSummary, generates tips, manages localStorage history

### Modified files
- `src/types.ts` — Add GameSummary, GameTip interfaces
- `src/in_game/in_game.ts` — Start/stop summary collection, detect game end, save summary
- `src/desktop/desktop.ts` — Add tab navigation, load/display game data, render views
- `src/desktop/desktop.html` — Add tab nav and view containers
- `public/css/desktop.css` — Summary view styles, chart styles, tab styles
