import { MinimapBounds } from '../types';
import { MinimapConfigManager } from './minimap-config';

type CalibrationCallback = () => void;

const CORNER_ZONE = 30; // px from corner to trigger resize

export class CalibrationUI {
  private _configManager: MinimapConfigManager;
  private _container: HTMLElement;
  private _overlay: HTMLElement | null = null;
  private _box: HTMLElement | null = null;
  private _active: boolean = false;
  private _onComplete: CalibrationCallback | null = null;
  private _onCancel: CalibrationCallback | null = null;

  // Interaction state
  private _mode: 'none' | 'drag' | 'resize' = 'none';
  private _resizeCorner: string = '';
  private _dragStartX: number = 0;
  private _dragStartY: number = 0;
  private _boxStartX: number = 0;
  private _boxStartY: number = 0;
  private _boxStartW: number = 0;
  private _boxStartH: number = 0;

  // Bound event handlers (stored so we can remove them)
  private _boundMouseDown: (e: MouseEvent) => void;
  private _boundMouseMove: (e: MouseEvent) => void;
  private _boundMouseUp: () => void;

  constructor(configManager: MinimapConfigManager, container: HTMLElement) {
    this._configManager = configManager;
    this._container = container;
    this._boundMouseDown = this.onMouseDown.bind(this);
    this._boundMouseMove = this.onMouseMove.bind(this);
    this._boundMouseUp = this.onMouseUp.bind(this);
  }

  public start(onComplete: CalibrationCallback, onCancel: CalibrationCallback): void {
    if (this._active) return;
    this._active = true;
    this._onComplete = onComplete;
    this._onCancel = onCancel;

    this.setClickthrough(false);

    const bounds = this._configManager.getMinimapBounds();

    // Create calibration overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'calibration-overlay';

    // Create the box
    this._box = document.createElement('div');
    this._box.className = 'calibration-box';
    this._box.style.left = `${bounds.x}px`;
    this._box.style.top = `${bounds.y}px`;
    this._box.style.width = `${bounds.width}px`;
    this._box.style.height = `${bounds.height}px`;

    // Corner indicators (visual only)
    const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    for (const corner of corners) {
      const indicator = document.createElement('div');
      indicator.className = `calibration-corner calibration-corner-${corner}`;
      this._box.appendChild(indicator);
    }

    // Center dot — align with the center of the minimap
    const centerDot = document.createElement('div');
    centerDot.className = 'calibration-center-dot';
    this._box.appendChild(centerDot);

    // Instruction text
    const instructions = document.createElement('div');
    instructions.className = 'calibration-instructions';
    instructions.textContent = 'Drag center to move, drag corners to resize';
    this._box.appendChild(instructions);

    // Buttons
    const btnContainer = document.createElement('div');
    btnContainer.className = 'calibration-buttons';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'calibration-btn calibration-btn-confirm';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onConfirm(); });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'calibration-btn calibration-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onCancelClick(); });

    btnContainer.appendChild(confirmBtn);
    btnContainer.appendChild(cancelBtn);
    this._box.appendChild(btnContainer);

    this._overlay.appendChild(this._box);
    this._container.appendChild(this._overlay);

    // Single mousedown on the entire overlay to handle both drag and resize
    this._overlay.addEventListener('mousedown', this._boundMouseDown);
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('mouseup', this._boundMouseUp);
  }

  public isActive(): boolean {
    return this._active;
  }

  /** Detect if click is near a corner of the box */
  private detectCorner(clientX: number, clientY: number): string | null {
    if (!this._box) return null;

    const rect = this._box.getBoundingClientRect();
    const nearLeft = clientX - rect.left < CORNER_ZONE;
    const nearRight = rect.right - clientX < CORNER_ZONE;
    const nearTop = clientY - rect.top < CORNER_ZONE;
    const nearBottom = rect.bottom - clientY < CORNER_ZONE;

    if (nearTop && nearLeft) return 'top-left';
    if (nearTop && nearRight) return 'top-right';
    if (nearBottom && nearLeft) return 'bottom-left';
    if (nearBottom && nearRight) return 'bottom-right';
    return null;
  }

  private onMouseDown(e: MouseEvent): void {
    // Ignore clicks on buttons
    if ((e.target as HTMLElement).closest('.calibration-btn')) return;
    if (!this._box) return;

    e.preventDefault();

    const clientX = e.clientX;
    const clientY = e.clientY;
    const rect = this._box.getBoundingClientRect();

    this._dragStartX = clientX;
    this._dragStartY = clientY;
    this._boxStartX = this._box.offsetLeft;
    this._boxStartY = this._box.offsetTop;
    this._boxStartW = this._box.offsetWidth;
    this._boxStartH = this._box.offsetHeight;

    // Check if near a corner of the box
    const corner = this.detectCorner(clientX, clientY);
    if (corner) {
      this._mode = 'resize';
      this._resizeCorner = corner;
    } else if (clientX >= rect.left && clientX <= rect.right &&
               clientY >= rect.top && clientY <= rect.bottom) {
      this._mode = 'drag';
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this._box || this._mode === 'none') return;

    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;

    if (this._mode === 'drag') {
      this._box.style.left = `${this._boxStartX + dx}px`;
      this._box.style.top = `${this._boxStartY + dy}px`;
    } else if (this._mode === 'resize') {
      // Use dominant axis, keep square
      const delta = (Math.abs(dx) > Math.abs(dy)) ? dx : dy;

      switch (this._resizeCorner) {
        case 'bottom-right': {
          const newSize = Math.max(80, this._boxStartW + delta);
          this._box.style.width = `${newSize}px`;
          this._box.style.height = `${newSize}px`;
          break;
        }
        case 'bottom-left': {
          const newSize = Math.max(80, this._boxStartW - delta);
          this._box.style.width = `${newSize}px`;
          this._box.style.height = `${newSize}px`;
          this._box.style.left = `${this._boxStartX + (this._boxStartW - newSize)}px`;
          break;
        }
        case 'top-right': {
          const newSize = Math.max(80, this._boxStartH - delta);
          this._box.style.width = `${newSize}px`;
          this._box.style.height = `${newSize}px`;
          this._box.style.top = `${this._boxStartY + (this._boxStartH - newSize)}px`;
          break;
        }
        case 'top-left': {
          const newSize = Math.max(80, this._boxStartW - delta);
          this._box.style.width = `${newSize}px`;
          this._box.style.height = `${newSize}px`;
          this._box.style.left = `${this._boxStartX + (this._boxStartW - newSize)}px`;
          this._box.style.top = `${this._boxStartY + (this._boxStartH - newSize)}px`;
          break;
        }
      }
    }
  }

  private onMouseUp(): void {
    this._mode = 'none';
  }

  private onConfirm(): void {
    if (!this._box) return;

    const bounds: MinimapBounds = {
      x: this._box.offsetLeft,
      y: this._box.offsetTop,
      width: this._box.offsetWidth,
      height: this._box.offsetHeight
    };

    this._configManager.saveManualBounds(bounds);
    this.cleanup();

    if (this._onComplete) this._onComplete();
  }

  private onCancelClick(): void {
    this.cleanup();
    if (this._onCancel) this._onCancel();
  }

  private cleanup(): void {
    if (this._overlay) {
      this._overlay.removeEventListener('mousedown', this._boundMouseDown);
    }
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mouseup', this._boundMouseUp);

    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    this._box = null;
    this._active = false;
    this._mode = 'none';

    this.setClickthrough(true);
  }

  private setClickthrough(enabled: boolean): void {
    overwolf.windows.getCurrentWindow((result) => {
      if (!result || !result.window) return;
      const windowId = result.window.id;
      try {
        if (enabled) {
          overwolf.windows.setWindowStyle(windowId, overwolf.windows.enums.WindowStyle.InputPassThrough, () => {});
        } else {
          overwolf.windows.removeWindowStyle(windowId, overwolf.windows.enums.WindowStyle.InputPassThrough, () => {});
        }
      } catch (e) {
        console.warn('CalibrationUI setClickthrough failed', e);
      }
    });
  }
}
