import { Events } from '../events/Events.js';

export function setupModel3dFlow(core) {
    core.eventBus.on(Events.UI.Model3dShowInViewer, ({ objectId, modelUrl, format }) => {
        if (!modelUrl || typeof modelUrl !== 'string') {
            return;
        }

        if (typeof core.options?.onShowModel3dInViewer === 'function') {
            core.options.onShowModel3dInViewer({ objectId, modelUrl, format });
        } else {
            console.warn('[Model3dFlow] onShowModel3dInViewer не задан в options. objectId:', objectId, 'modelUrl:', modelUrl);
        }
    });
}
