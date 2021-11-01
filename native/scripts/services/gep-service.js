/**
 * Game Event Provider service
 * This will listen to events from the game provided by
 * Overwolf's Game Events Provider
 */
const REGISTER_RETRY_TIMEOUT = 10000;

export class GepService {
  static setRequiredFeatures(features, eventsListener, infoListener) {
    overwolf.games.events.setRequiredFeatures(features, response => {
      if (response.success) {
        console.log(`Successfully registered to GEP.`);

        overwolf.games.events.onNewEvents.removeListener(eventsListener);
        overwolf.games.events.onNewEvents.addListener(eventsListener);

        overwolf.games.events.onInfoUpdates2.removeListener(infoListener);
        overwolf.games.events.onInfoUpdates2.addListener(infoListener);
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
