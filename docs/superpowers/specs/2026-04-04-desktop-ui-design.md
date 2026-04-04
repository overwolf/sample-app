# Desktop App UI Redesign — Design Spec

## Summary

Redesign the desktop window with a League of Legends-inspired visual theme. Dark blue-black background, gold hextech-style borders, League fonts (Beaufort/Spiegel), ward optimizer logo, connection status indicator, minimap settings panel, and rotating warding tips.

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#010A13` | Page background |
| Panel BG | `#0A1428` | Card/panel backgrounds |
| Gold | `#C89B3C` | Borders, accents, headings |
| Gold dim | `#785A28` | Subtle/inactive gold |
| Text primary | `#CDBE91` | Main body text |
| Text secondary | `#A09B8C` | Muted/description text |
| Status green | `#1ED760` | Connected indicator |
| Status red | `#E84057` | Disconnected indicator |
| Teal | `#0AC8B9` | Accent (ward marker reference) |

## Typography

- **Headings:** Beaufort for LoL Bold (fallback: Georgia, serif)
- **Body:** Spiegel (fallback: sans-serif)
- Font files in `public/css/fonts/` as woff2

## Layout

Window size: 1212x699. Four sections stacked vertically:

### 1. Header Bar (~30px)
- Background `#010A13` with 1px gold bottom border
- "Ward Optimizer" title in gold, left-aligned
- Window controls right-aligned (minimize, maximize, close)

### 2. Hero Section (~200px)
- Ward Optimizer SVG logo centered (simple ward icon in gold)
- "WARD OPTIMIZER" in large Beaufort heading
- Tagline: "Intelligent ward placement for League of Legends" in secondary text
- Status indicator pill below tagline:
  - Green pill: "Connected" when League client API responds
  - Red pill: "Not Connected" when API unavailable

### 3. Content Area (flex, fills remaining)
Two columns side by side in hextech card panels:

**Left column: Minimap Settings**
- Detection mode display (Auto / Manual)
- Reset to Auto-Detect button
- Minimap side selector (Auto / Right / Left)
- Hint about in-game calibration

**Right column: Warding Tips**
- Single tip visible at a time
- Fades to next tip every 10 seconds
- ~10 hardcoded tips about warding strategy
- Styled as a quote/callout with gold left border

### 4. Footer (~40px)
- Left: "Launch League of Legends to activate the overlay" in muted text
- Right: App version "v1.0.0"

## Panel Style (Hextech Card)

All content panels use:
- Background: `#0A1428`
- Border: 1px solid `#C89B3C`
- Border radius: 4px
- Padding: 20-24px
- Gold corner accents via CSS pseudo-elements (small L-shaped gold marks at corners)
- Subtle box-shadow: `0 0 10px rgba(200, 155, 60, 0.1)`

## Connection Status Detection

- On load and every 10 seconds, fetch `https://127.0.0.1:2999/liveclientdata/gamestats`
- If response OK: show green "Connected" pill
- If error/timeout: show red "Not Connected" pill
- Uses `fetch()` with catch for self-signed cert

## Warding Tips

Hardcoded array, displayed one at a time with CSS fade transition:

1. "Ward river brushes before objectives spawn"
2. "Place control wards in your own jungle when behind"
3. "Deep wards in enemy jungle reveal their jungler's pathing"
4. "Supports should aim for 1.5+ ward score per minute"
5. "Switch to Farsight Alteration after laning phase as a carry"
6. "Ward Baron 60 seconds before it spawns"
7. "Always have a control ward in your inventory"
8. "Ward the pixel brush in mid river to track roams"
9. "Place defensive wards when your team is behind in gold"
10. "Clearing enemy wards is just as important as placing your own"

## Assets

**New files:**
- `public/img/ward-logo.svg` — Ward icon SVG in gold
- `public/css/fonts/BeaufortforLOL-Bold.woff2` — League heading font
- `public/css/fonts/Spiegel-Regular.woff2` — League body font

**Modified files:**
- `src/desktop/desktop.html` — New layout
- `public/css/desktop.css` — Complete restyle
- `src/desktop/desktop.ts` — Status check polling, rotating tips logic

**Unchanged:** In-game files, feature modules, manifest, header.css, general.css
