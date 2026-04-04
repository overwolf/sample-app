"""
Analyze ward placement data from Challenger-tier LoL games.
Uses streaming to avoid disk issues, correct dataset config.

Usage:
  pip install datasets pandas scikit-learn
  python scripts/analyze_wards.py
"""

import json
import sys
import pandas as pd
from sklearn.cluster import DBSCAN
import numpy as np

MAP_X_MIN, MAP_X_MAX = -120, 14870
MAP_Y_MIN, MAP_Y_MAX = -120, 14980
MAP_WIDTH = MAP_X_MAX - MAP_X_MIN
MAP_HEIGHT = MAP_Y_MAX - MAP_Y_MIN
EARLY_END_MS = 14 * 60 * 1000
MID_END_MS = 25 * 60 * 1000

def get_side(pid):
    return 'blue' if pid and pid <= 5 else 'red'

def get_phase(ts):
    if ts < EARLY_END_MS: return 'early'
    if ts < MID_END_MS: return 'mid'
    return 'late'

def normalize_coords(gx, gy):
    return (round((gx - MAP_X_MIN) / MAP_WIDTH, 3),
            round(1.0 - ((gy - MAP_Y_MIN) / MAP_HEIGHT), 3))

def main():
    import os
    # Set HF_TOKEN environment variable before running: set HF_TOKEN=hf_your_token
    from datasets import load_dataset

    all_wards = []
    count = 0
    TARGET = 1500

    splits = ['train_region_americas', 'train_region_europe', 'train_region_asia']

    for split in splits:
        if len(all_wards) >= TARGET:
            break
        print(f"Streaming {split}...")
        try:
            ds = load_dataset(
                "gptilt/lol-ultimate-events-challenger-10m",
                name="events",
                split=split,
                streaming=True
            )
            for row in ds:
                count += 1
                if count % 10000 == 0:
                    print(f"  {count} rows, {len(all_wards)} wards...")

                if row.get('type') != 'WARD_PLACED':
                    continue

                ts = row.get('timestamp')
                pid = row.get('participantId')
                if not ts or not pid: continue

                # Ward position = player position at time of placement
                x = row.get(f'positionX_{pid}')
                y = row.get(f'positionY_{pid}')

                if not x or not y: continue
                if x == 0 and y == 0: continue
                if x < MAP_X_MIN or x > MAP_X_MAX: continue
                if y < MAP_Y_MIN or y > MAP_Y_MAX: continue

                all_wards.append({
                    'game_x': x, 'game_y': y,
                    'side': get_side(pid), 'phase': get_phase(ts),
                })

                if len(all_wards) >= TARGET:
                    break
        except Exception as e:
            print(f"  Error: {e}")
            continue

    print(f"\nScanned {count} rows, collected {len(all_wards)} wards")

    if len(all_wards) < 100:
        print("Not enough data!")
        sys.exit(1)

    df = pd.DataFrame(all_wards)
    print(f"By phase: {df['phase'].value_counts().to_dict()}")
    print(f"By side: {df['side'].value_counts().to_dict()}")

    results = {}
    for phase in ['early', 'mid', 'late']:
        for side in ['blue', 'red']:
            g = df[(df['phase'] == phase) & (df['side'] == side)]
            if len(g) < 30:
                continue
            print(f"\nClustering {phase}/{side} ({len(g)})...")
            coords = g[['game_x', 'game_y']].values
            cl = DBSCAN(eps=800, min_samples=max(3, len(g)//100)).fit(coords)
            g = g.copy()
            g['cluster'] = cl.labels_

            clusters = []
            for lab in sorted(g['cluster'].unique()):
                if lab == -1: continue
                cp = g[g['cluster'] == lab]
                cx, cy = cp['game_x'].mean(), cp['game_y'].mean()
                nx, ny = normalize_coords(cx, cy)
                clusters.append({'gx': round(cx), 'gy': round(cy),
                    'nx': nx, 'ny': ny, 'n': len(cp),
                    'pct': round(len(cp)/len(g)*100, 1)})

            clusters.sort(key=lambda c: c['n'], reverse=True)
            results[f"{phase}_{side}"] = clusters[:15]
            for c in clusters[:5]:
                print(f"  ({c['gx']},{c['gy']}) -> ({c['nx']},{c['ny']}) {c['n']} ({c['pct']}%)")

    with open('scripts/ward_positions.json', 'w') as f:
        json.dump(results, f, indent=2)
    print("\nSaved to scripts/ward_positions.json")

if __name__ == '__main__':
    main()
