import { MinimapBounds, MinimapConfig } from '../types';

const STORAGE_KEY = 'ward_optimizer_minimap_config';

// Minimap size formula at 1080p: size = A * S^2 + B * S + C
// Derived from 3 calibration data points:
//   MinimapScale=1.0 → 215px, MinimapScale=1.41 → 296px, MinimapScale=3.0 → 431px
const MINIMAP_COEFF_A = -56.3;
const MINIMAP_COEFF_B = 333.2;
const MINIMAP_COEFF_C = -61.9;

// Default MinimapScale in League when not configured
const DEFAULT_MINIMAP_SCALE = 1.0;

const DEFAULT_CONFIG: MinimapConfig = {
  mode: 'auto',
  manualBounds: null,
  sideOverride: null
};

interface LeagueSettings {
  minimapScale: number;
  flipMiniMap: boolean;
}

export class MinimapConfigManager {
  private _config: MinimapConfig;
  private _gameWidth: number = 1920;
  private _gameHeight: number = 1080;
  private _leagueSettings: LeagueSettings = {
    minimapScale: DEFAULT_MINIMAP_SCALE,
    flipMiniMap: false
  };

  constructor() {
    this._config = this.loadConfig();
  }

  /** Initialize with current game resolution and League config */
  public async init(): Promise<void> {
    try {
      const info = await this.getGameInfo();
      if (info && info.width && info.height) {
        this._gameWidth = info.width;
        this._gameHeight = info.height;
      }

      // Read League's game.cfg for minimap settings
      if (info && info.executionPath) {
        await this.readLeagueConfig(info.executionPath);
      }
    } catch (e) {
      console.warn('Could not initialize minimap config, using defaults', e);
    }

    const bounds = this.getMinimapBounds();
  }

  /** Get current minimap bounds in screen pixels */
  public getMinimapBounds(): MinimapBounds {
    if (this._config.mode === 'manual' && this._config.manualBounds) {
      if (this._config.manualBounds.gameWidth === this._gameWidth &&
          this._config.manualBounds.gameHeight === this._gameHeight) {
        return {
          x: this._config.manualBounds.x,
          y: this._config.manualBounds.y,
          width: this._config.manualBounds.width,
          height: this._config.manualBounds.height
        };
      }
      console.warn('Resolution changed since calibration, falling back to auto-detect');
    }

    return this.calculateAutoBounds();
  }

  private calculateAutoBounds(): MinimapBounds {
    const isLeftSide = this._config.sideOverride === 'left' ||
      (!this._config.sideOverride && this._leagueSettings.flipMiniMap);

    const S = this._leagueSettings.minimapScale;
    const resFactor = this._gameHeight / 1080;
    const size = Math.round((MINIMAP_COEFF_A * S * S + MINIMAP_COEFF_B * S + MINIMAP_COEFF_C) * resFactor);

    const x = isLeftSide
      ? 0
      : this._gameWidth - size + 3;
    const y = this._gameHeight - size + 3;

    return { x, y, width: size, height: size };
  }

  /** Read League config from game.cfg and PersistedSettings.json */
  private async readLeagueConfig(gamePath: string): Promise<void> {
    // Normalize path separators
    const normalized = gamePath.replace(/\//g, '\\');
    const sep = '\\';

    // Find Config directory — go up from the exe to the League root
    // executionPath could be:
    //   "C:\Riot Games\League of Legends\Game\League of Legends.exe"
    //   "C:\Riot Games\League of Legends\League of Legends.exe"
    const parts = normalized.split(sep);
    let configDir = '';

    // Walk up until we find a directory that has a Config sibling
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = parts.slice(0, i).join(sep) + sep + 'Config';
      const exists = await this.fileExists(candidate + sep + 'game.cfg');
      if (exists) {
        configDir = candidate;
        break;
      }
    }

    if (!configDir) {
      // Try common League installation paths as fallback
      const commonPaths = [
        'C:\\Riot Games\\League of Legends\\Config',
        'D:\\Riot Games\\League of Legends\\Config',
        'C:\\Program Files\\Riot Games\\League of Legends\\Config',
        'D:\\Program Files\\Riot Games\\League of Legends\\Config',
      ];
      for (const p of commonPaths) {
        if (await this.fileExists(p + sep + 'game.cfg')) {
          configDir = p;
          break;
        }
      }
    }

    if (!configDir) {
      console.warn('Could not find League Config directory from path:', gamePath);
      return;
    }


    // Try game.cfg first (INI format)
    await this.parseGameCfg(configDir + sep + 'game.cfg');

    // Also try PersistedSettings.json (JSON format, may have overrides)
    await this.parsePersistedSettings(configDir + sep + 'PersistedSettings.json');

  }

  private async parseGameCfg(path: string): Promise<void> {
    try {
      const content = await this.readFile(path);
      if (!content) return;

      const lines = content.split('\n');
      let inHudSection = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('[')) {
          inHudSection = trimmed.toLowerCase() === '[hud]';
          continue;
        }

        if (!inHudSection) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();

        if (key === 'MinimapScale') {
          const scale = parseFloat(value);
          if (!isNaN(scale) && scale > 0) {
            this._leagueSettings.minimapScale = scale;
          }
        } else if (key === 'FlipMiniMap') {
          this._leagueSettings.flipMiniMap = value === '1';
        }
      }

    } catch (e) {
      console.warn('Error parsing game.cfg:', e);
    }
  }

  private async parsePersistedSettings(path: string): Promise<void> {
    try {
      const content = await this.readFile(path);
      if (!content) return;

      const json = JSON.parse(content);

      // PersistedSettings.json uses nested structure or flat keys
      // Try multiple known formats
      const files = json.files || json;

      // Format: { "files": { "Settings/HUD.MinimapScale": "1.0" } }
      for (const [key, value] of Object.entries(files)) {
        const strValue = String(value);
        if (key.includes('MinimapScale') || key.includes('minimapScale')) {
          const scale = parseFloat(strValue);
          if (!isNaN(scale) && scale > 0) {
            this._leagueSettings.minimapScale = scale;
          }
        }
        if (key.includes('FlipMiniMap') || key.includes('flipMiniMap') || key.includes('MirrorMinimap') || key.includes('MinimapLeft')) {
          this._leagueSettings.flipMiniMap = strValue === '1' || strValue === 'true';
        }
      }

    } catch (e) {
      // PersistedSettings.json may not exist, that's fine
    }
  }

  private fileExists(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      overwolf.io.exist(path, (result) => {
        resolve(result.success && result.exist);
      });
    });
  }

  private readFile(path: string): Promise<string | null> {
    return new Promise((resolve) => {
      overwolf.io.readFileContents(path, overwolf.io.enums.eEncoding.UTF8, (result) => {
        if (result.success && result.content) {
          resolve(result.content);
        } else {
          resolve(null);
        }
      });
    });
  }

  public updateResolution(width: number, height: number): void {
    this._gameWidth = width;
    this._gameHeight = height;
  }

  public getGameResolution(): { width: number; height: number } {
    return { width: this._gameWidth, height: this._gameHeight };
  }

  public saveManualBounds(bounds: MinimapBounds): void {
    this._config.mode = 'manual';
    this._config.manualBounds = {
      ...bounds,
      gameWidth: this._gameWidth,
      gameHeight: this._gameHeight
    };
    this.saveConfig();
  }

  public resetToAuto(): void {
    this._config.mode = 'auto';
    this._config.manualBounds = null;
    this.saveConfig();
  }

  public setSideOverride(side: 'left' | 'right' | null): void {
    this._config.sideOverride = side;
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
