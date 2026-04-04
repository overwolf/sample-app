type LiveClientCallback = (data: any) => void;
type DisconnectCallback = () => void;

const API_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';
const POLL_INTERVAL = 3000;
const DISCONNECT_THRESHOLD = 3; // failures before triggering disconnect

export class LiveClientPoller {
  private _callback: LiveClientCallback;
  private _onDisconnect: DisconnectCallback | null = null;
  private _intervalId: number | null = null;
  private _active: boolean = false;
  private _connected: boolean = false;
  private _failCount: number = 0;

  constructor(callback: LiveClientCallback) {
    this._callback = callback;
  }

  public onDisconnect(callback: DisconnectCallback): void {
    this._onDisconnect = callback;
  }

  public isConnected(): boolean {
    return this._connected;
  }

  public start(): void {
    if (this._active) return;
    this._active = true;
    this._failCount = 0;
    this.poll();
    this._intervalId = window.setInterval(() => this.poll(), POLL_INTERVAL);
  }

  public stop(): void {
    this._active = false;
    if (this._intervalId !== null) {
      window.clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this._active) return;

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        // @ts-ignore
        rejectUnauthorized: false,
      });

      if (response.ok) {
        const data = await response.json();
        this._failCount = 0;
        if (!this._connected) {
          this._connected = true;
        }
        this._callback(data);
        return;
      }
    } catch (fetchError) {
      // Try overwolf fallback
      try {
        const success = await this.pollOverwolf();
        if (success) return;
      } catch (e) {}
    }

    // If we reach here, the poll failed
    this._failCount++;
    if (this._connected && this._failCount >= DISCONNECT_THRESHOLD) {
      this._connected = false;
      if (this._onDisconnect) {
        this._onDisconnect();
      }
    }
  }

  private pollOverwolf(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        overwolf.web.sendHttpRequest(
          API_URL,
          overwolf.web.enums.HttpRequestMethods.GET,
          [],
          '',
          (result) => {
            if (result.success && result.data) {
              try {
                const parsed = JSON.parse(result.data);
                this._failCount = 0;
                if (!this._connected) {
                  this._connected = true;
                }
                this._callback(parsed);
                resolve(true);
                return;
              } catch (e) {}
            }
            resolve(false);
          }
        );
      } catch (e) {
        resolve(false);
      }
    });
  }
}
