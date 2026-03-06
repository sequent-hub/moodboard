import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

const mockState = vi.hoisted(() => ({
    coreInstances: [],
    toolbarInstances: [],
    saveStatusInstances: [],
    topbarInstances: [],
    zoomPanelInstances: [],
    mapPanelInstances: [],
    contextMenuInstances: [],
    htmlTextLayerInstances: [],
    htmlHandlesLayerInstances: [],
    commentPopoverInstances: [],
    textPropertiesPanelInstances: [],
    framePropertiesPanelInstances: [],
    notePropertiesPanelInstances: [],
    filePropertiesPanelInstances: [],
    alignmentGuidesInstances: [],
    imageUploadServiceInstances: [],
    settingsApplierInstances: [],
    objectIdCounter: 0,
}));

function resetMockState() {
    for (const key of Object.keys(mockState)) {
        if (Array.isArray(mockState[key])) {
            mockState[key].length = 0;
        }
    }
    mockState.objectIdCounter = 0;
}

function createEventBus() {
    const handlers = new Map();
    return {
        handlers,
        on: vi.fn((eventName, handler) => {
            if (!handlers.has(eventName)) {
                handlers.set(eventName, []);
            }
            handlers.get(eventName).push(handler);
        }),
        emit: vi.fn((eventName, payload) => {
            const list = handlers.get(eventName) || [];
            list.forEach((handler) => handler(payload));
        }),
        off: vi.fn(),
        removeAllListeners: vi.fn(),
    };
}

function createComponentClass(storageKey, extraMethods = {}) {
    return class MockComponent {
        constructor(...args) {
            this.args = args;
            this.destroy = vi.fn();
            Object.assign(this, extraMethods);
            mockState[storageKey].push(this);
        }
    };
}

vi.mock('../../src/core/index.js', () => ({
    CoreMoodBoard: class MockCoreMoodBoard {
        constructor(container, options) {
            this.container = container;
            this.options = options;
            this.eventBus = createEventBus();
            this.apiClient = { post: vi.fn(), get: vi.fn() };
            this.boardService = { save: vi.fn(), load: vi.fn() };
            this._objects = [];
            this.objects = this._objects;
            this.state = {
                state: { objects: this._objects },
                getObjects: vi.fn(() => this._objects),
            };
            this.pixi = {
                app: {
                    renderer: {
                        background: { color: 0xF7FBFF },
                        backgroundColor: 0xF7FBFF,
                    },
                    view: {
                        width: 640,
                        height: 480,
                        toDataURL: vi.fn(() => 'data:image/jpeg;base64,pixi-only'),
                    },
                    stage: {
                        scale: {
                            set: vi.fn(),
                        },
                    },
                },
                worldLayer: {
                    on: vi.fn(),
                    scale: {
                        set: vi.fn(),
                    },
                },
                objects: new Map(),
                removeObject: vi.fn((objectId) => {
                    this.pixi.objects.delete(objectId);
                }),
            };
            this.init = vi.fn(async () => {});
            this.destroy = vi.fn();
            this.createObject = vi.fn((type, position, properties = {}, extraData = {}) => {
                const object = {
                    id: `mock-object-${++mockState.objectIdCounter}`,
                    type,
                    position,
                    properties,
                    extraData,
                };
                this._objects.push(object);
                this.pixi.objects.set(object.id, object);
                return object;
            });
            this.deleteObject = vi.fn((objectId) => {
                const index = this._objects.findIndex((item) => item.id === objectId);
                if (index >= 0) {
                    this._objects.splice(index, 1);
                }
                this.pixi.objects.delete(objectId);
            });
            this.createObjectFromData = vi.fn((objectData) => {
                this._objects.push(objectData);
                this.pixi.objects.set(objectData.id, objectData);
                return objectData;
            });
            this.boardData = {
                objects: this._objects,
                settings: { backgroundColor: '#f7fbff' },
            };
            mockState.coreInstances.push(this);
        }
    },
}));

vi.mock('../../src/ui/Toolbar.js', () => ({
    Toolbar: class MockToolbar extends createComponentClass('toolbarInstances', {
        reloadToolbarIcon: vi.fn(),
        setTheme: vi.fn(),
    }) {},
}));

vi.mock('../../src/ui/SaveStatus.js', () => ({
    SaveStatus: createComponentClass('saveStatusInstances'),
}));

vi.mock('../../src/ui/Topbar.js', () => ({
    Topbar: class MockTopbar extends createComponentClass('topbarInstances', {
        mapBoardToBtnHex: vi.fn((hex) => `${hex}-btn`),
        setPaintButtonHex: vi.fn(),
    }) {},
}));

vi.mock('../../src/ui/ZoomPanel.js', () => ({
    ZoomPanel: createComponentClass('zoomPanelInstances'),
}));

vi.mock('../../src/ui/MapPanel.js', () => ({
    MapPanel: createComponentClass('mapPanelInstances'),
}));

vi.mock('../../src/ui/ContextMenu.js', () => ({
    ContextMenu: createComponentClass('contextMenuInstances'),
}));

vi.mock('../../src/ui/HtmlTextLayer.js', () => ({
    HtmlTextLayer: class MockHtmlTextLayer extends createComponentClass('htmlTextLayerInstances', {
        attach: vi.fn(),
        rebuildFromState: vi.fn(),
        updateAll: vi.fn(),
    }) {},
}));

vi.mock('../../src/ui/HtmlHandlesLayer.js', () => ({
    HtmlHandlesLayer: class MockHtmlHandlesLayer extends createComponentClass('htmlHandlesLayerInstances', {
        attach: vi.fn(),
        update: vi.fn(),
        hide: vi.fn(),
    }) {},
}));

vi.mock('../../src/ui/CommentPopover.js', () => ({
    CommentPopover: class MockCommentPopover extends createComponentClass('commentPopoverInstances', {
        attach: vi.fn(),
    }) {},
}));

vi.mock('../../src/ui/TextPropertiesPanel.js', () => ({
    TextPropertiesPanel: class MockTextPropertiesPanel extends createComponentClass('textPropertiesPanelInstances', {
        attach: vi.fn(),
    }) {},
}));

vi.mock('../../src/ui/FramePropertiesPanel.js', () => ({
    FramePropertiesPanel: createComponentClass('framePropertiesPanelInstances'),
}));

vi.mock('../../src/ui/NotePropertiesPanel.js', () => ({
    NotePropertiesPanel: createComponentClass('notePropertiesPanelInstances'),
}));

vi.mock('../../src/ui/FilePropertiesPanel.js', () => ({
    FilePropertiesPanel: createComponentClass('filePropertiesPanelInstances'),
}));

vi.mock('../../src/tools/AlignmentGuides.js', () => ({
    AlignmentGuides: createComponentClass('alignmentGuidesInstances'),
}));

vi.mock('../../src/services/ImageUploadService.js', () => ({
    ImageUploadService: createComponentClass('imageUploadServiceInstances'),
}));

vi.mock('../../src/services/SettingsApplier.js', () => ({
    SettingsApplier: class MockSettingsApplier extends createComponentClass('settingsApplierInstances', {
        set: vi.fn(),
        setUI: vi.fn(),
        apply: vi.fn(),
    }) {},
}));

vi.mock('../../src/grid/GridFactory.js', () => ({
    GridFactory: class MockGridFactory {},
}));

import { MoodBoard } from '../../src/moodboard/MoodBoard.js';

export function setupMoodBoardDom() {
    const container = document.createElement('div');
    container.id = 'moodboard-test-root';
    document.body.appendChild(container);
    return container;
}

export function resetMoodBoardTestState() {
    resetMockState();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete window.reloadIcon;
    window.moodboardHtmlTextLayer = null;
    window.moodboardHtmlHandlesLayer = null;
    global.fetch = vi.fn();
    document.head.innerHTML = '';
}

export function createMoodBoard(container, options = {}, data = null) {
    return new MoodBoard(container, options, data);
}

export async function settleMoodBoard(board) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (board.workspaceElement && board.coreMoodboard && board.actionHandler) {
            break;
        }
        await Promise.resolve();
    }

    if (!board.workspaceElement || !board.coreMoodboard || !board.actionHandler) {
        throw new Error('MoodBoard did not finish init in test helper');
    }

    for (let index = 0; index < 6; index += 1) {
        await Promise.resolve();
    }
}

export function lastCoreInstance() {
    return mockState.coreInstances.at(-1) || null;
}

export { mockState };
