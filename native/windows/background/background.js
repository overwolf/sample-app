import { BackgroundController } from './background-controller.js';

const backgroundController = new BackgroundController();

backgroundController.run().catch(e => console.error(e));
