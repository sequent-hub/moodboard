export class PlacementSessionStore {
    constructor(host) {
        this.host = host;
    }

    initialize() {
        this.host.pending = null;
        this.host.selectedFile = null;
        this.host.selectedImage = null;
        this.host.ghostContainer = null;
    }

    clearSelectionState() {
        this.host.pending = null;
        this.host.selectedFile = null;
        this.host.selectedImage = null;
    }
}
