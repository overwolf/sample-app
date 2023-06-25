/**
 * Game Event Provider service
 * This will listen to events from the game provided by
 * Overwolf's Game Events Provider
 */
const REGISTER_RETRY_TIMEOUT = 10000;

let storedEventsListener = null;
let storedInfoListener = null;

export class GepService {
  static setRequiredFeatures(features, eventsListener, infoListener) {
    if (!features.length) this.setListeners(eventsListener, infoListener) // if there are no features, this is an sdk game. as such, just sign up directly
    else {
      overwolf.games.events.setRequiredFeatures(features, response => {
        if (response.success) {
          console.log(`Successfully registered to GEP.`);

          this.setListeners(eventsListener, infoListener)
        } else {
          console.log(`Failed to register to GEP: ${response.error}. Retrying in ${REGISTER_RETRY_TIMEOUT / 1000}s...`);

          setTimeout(() => {
            GepService.setRequiredFeatures(
              features,
              eventsListener,
              infoListener
            );
          }, REGISTER_RETRY_TIMEOUT);
        }
      });
    }
  }

  static setListeners(eventsListener, infoListener) {
    if (storedEventsListener) {
      overwolf.games.events.onNewEvents.removeListener(storedEventsListener);
      storedEventsListener = null;
    }
    overwolf.games.events.onNewEvents.addListener(eventsListener);
    storedEventsListener = eventsListener;

    if (storedInfoListener) {
      overwolf.games.events.onInfoUpdates2.removeListener(storedInfoListener);
      storedInfoListener = null;
    }
    overwolf.games.events.onInfoUpdates2.addListener(infoListener);
    storedInfoListener = infoListener;
  }
}
