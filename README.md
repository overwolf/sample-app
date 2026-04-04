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
