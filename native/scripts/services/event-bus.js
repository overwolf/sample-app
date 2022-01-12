export class EventBus {
  constructor() {
    this._listeners = [];
  }

  addListener(eventHandler) {
    this._listeners.push(eventHandler);
  }

  removeListener(eventHandler) {
    const index = this._listeners.indexOf(eventHandler);

    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }

  trigger(eventName, eventValue) {
    this._listeners.forEach(listener => listener(eventName, eventValue))
  }
}
