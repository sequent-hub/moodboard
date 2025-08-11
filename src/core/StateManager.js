export class StateManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.state = {
            board: {},
            objects: [],
            selectedObjects: [],
            isDirty: false
        };
    }

    loadBoard(boardData) {
        this.state.board = boardData;
        this.state.objects = boardData.objects || [];
        this.eventBus.emit('board:loaded', boardData);
    }

    addObject(objectData) {
        this.state.objects.push(objectData);
        this.markDirty();
        this.eventBus.emit('object:created', objectData);
    }

    removeObject(objectId) {
        this.state.objects = this.state.objects.filter(obj => obj.id !== objectId);
        this.markDirty();
        this.eventBus.emit('object:deleted', objectId);
    }

    getObjects() {
        return [...this.state.objects];
    }

    serialize() {
        return {
            board: { ...this.state.board, objects: this.state.objects }
        };
    }

    markDirty() {
        this.state.isDirty = true;
    }

    isDirty() {
        return this.state.isDirty;
    }
}