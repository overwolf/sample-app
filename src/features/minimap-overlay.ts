import { ScoredWardSpot, MinimapBounds } from '../types';
import { MinimapConfigManager } from './minimap-config';

interface RenderedMarker {
  id: string;
  element: HTMLElement;
  spot: ScoredWardSpot;
}

function spotId(spot: ScoredWardSpot): string {
  return `${spot.x.toFixed(4)}_${spot.y.toFixed(4)}_${spot.label}`;
}

export class MinimapOverlay {
  private _container: HTMLElement | null = null;
  private _configManager: MinimapConfigManager;
  private _renderedMarkers: Map<string, RenderedMarker> = new Map();
  private _visible: boolean = true;
  private _lastSpotKey: string = '';

  constructor(configManager: MinimapConfigManager) {
    this._configManager = configManager;
  }

  public init(container: HTMLElement): void {
    this._container = container;
  }

  public show(spots: ScoredWardSpot[]): void {
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
  public update(spots: ScoredWardSpot[]): void {
    if (!this._visible || !this._container) return;

    // Skip re-render if spots haven't changed
    const spotKey = spots.map(s => spotId(s)).join('|');
    if (spotKey === this._lastSpotKey) return;
    this._lastSpotKey = spotKey;

    const bounds = this._configManager.getMinimapBounds();
    const newSpotIds = new Set<string>();

    for (const spot of spots) {
      const id = spotId(spot);
      newSpotIds.add(id);

      const existing = this._renderedMarkers.get(id);
      if (existing) {
        this.positionMarker(existing.element, spot, bounds);
        this.styleMarker(existing.element, spot);
      } else {
        const element = this.createMarkerElement(spot, bounds);
        this._container.appendChild(element);
        this._renderedMarkers.set(id, { id, element, spot });
      }
    }

    for (const [id, marker] of this._renderedMarkers) {
      if (!newSpotIds.has(id)) {
        // Animate out before removing
        marker.element.classList.add('ward-marker-exit');
        const el = marker.element;
        setTimeout(() => el.remove(), 500);
        this._renderedMarkers.delete(id);
      }
    }
  }

  public repositionAll(): void {
    if (!this._visible) return;
    const bounds = this._configManager.getMinimapBounds();
    for (const marker of this._renderedMarkers.values()) {
      this.positionMarker(marker.element, marker.spot, bounds);
    }
  }

  private createMarkerElement(spot: ScoredWardSpot, bounds: MinimapBounds): HTMLElement {
    const marker = document.createElement('div');
    marker.className = 'ward-marker ward-marker-enter';
    marker.setAttribute('data-label', spot.label);
    marker.title = spot.label;
    this.positionMarker(marker, spot, bounds);
    this.styleMarker(marker, spot);

    // Animate in
    requestAnimationFrame(() => {
      marker.classList.remove('ward-marker-enter');
      marker.classList.add('ward-marker-visible');
    });

    return marker;
  }

  private styleMarker(element: HTMLElement, spot: ScoredWardSpot): void {
    if (spot.type === 'defensive') {
      element.classList.add('ward-marker-defensive');
      element.classList.remove('ward-marker-offensive');
    } else if (spot.type === 'offensive') {
      element.classList.add('ward-marker-offensive');
      element.classList.remove('ward-marker-defensive');
    } else {
      element.classList.remove('ward-marker-defensive', 'ward-marker-offensive');
    }
  }

  private positionMarker(element: HTMLElement, spot: ScoredWardSpot, bounds: MinimapBounds): void {
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
    this._lastSpotKey = '';
  }
}
