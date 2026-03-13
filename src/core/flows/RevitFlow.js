import { Events } from '../events/Events.js';
import { RevitNavigationService } from '../../services/RevitNavigationService.js';

export function setupRevitFlow(core) {
    const navigationService = new RevitNavigationService();

    core.eventBus.on(Events.UI.RevitShowInModel, async ({ objectId, view }) => {
        if (!view || typeof view !== 'string') {
            return;
        }

        await navigationService.showInModel(view, { objectId });
    });
}

