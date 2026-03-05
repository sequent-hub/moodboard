import { Events } from '../events/Events.js';

export function setupSaveFlow(core) {
    core.eventBus.on(Events.Save.GetBoardData, (requestData) => {
        requestData.data = core.getBoardData();
    });

    core.eventBus.on(Events.Grid.BoardDataChanged, ({ grid }) => {
        try {
            if (grid) {
                if (!core.state.state.board) core.state.state.board = {};
                core.state.state.board.grid = grid;
                core.state.markDirty();
            }
        } catch (_) {}
    });

    core.eventBus.on(Events.Save.StatusChanged, () => {
    });

    core.eventBus.on(Events.Save.Error, (data) => {
        console.error('Save error:', data.error);
    });

    core.eventBus.on(Events.Save.Success, async () => {
        try {
            const result = await core.cleanupUnusedImages();
            if (result.deletedCount > 0) {
            }
        } catch (error) {
            console.warn('⚠️ Не удалось выполнить автоматическую очистку изображений:', error.message);
        }
    });
}
