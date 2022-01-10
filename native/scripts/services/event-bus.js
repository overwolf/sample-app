export class EventBus {
  constructor() {
    this._listeners = [];
  }

  addListener(eventHandler) {
    this._listeners.push(eventHandler);
  }

  trigger(eventName, eventValue) {
    this._listeners.forEach(listener => listener(eventName, eventValue))
  }
}
