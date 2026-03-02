import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

// --- Моки зависимостей SelectTool ---

vi.mock('pixi.js', () => ({
    Container: vi.fn().mockImplementation(() => ({
        addChild: vi.fn(),
        removeChild: vi.fn(),
        children: [],
        pivot: { set: vi.fn() },
        scale: { x: 1, y: 1 },
        x: 0, y: 0,
    })),
    Graphics: vi.fn().mockImplementation(() => ({
        clear: vi.fn().mockReturnThis(),
        beginFill: vi.fn().mockReturnThis(),
        endFill: vi.fn().mockReturnThis(),
        drawRect: vi.fn().mockReturnThis(),
        drawRoundedRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        x: 0, y: 0, parent: null,
    })),
    Text: vi.fn().mockImplementation(() => ({
        text: '', style: {}, x: 0, y: 0, anchor: { set: vi.fn() },
    })),
    Point: vi.fn().mockImplementation((x, y) => ({ x, y })),
    Rectangle: vi.fn().mockImplementation((x, y, w, h) => ({ x, y, width: w, height: h })),
}));

vi.mock('../../src/assets/icons/cursor-default.svg?raw', () => ({
    default: '<svg width="50px" height="50px"></svg>',
}));

vi.mock('./selection/GeometryUtils.js', () => ({
    calculateNewSize: vi.fn(),
    calculatePositionOffset: vi.fn(),
}));

vi.mock('../../src/tools/object-tools/selection/SelectionModel.js', () => ({
    SelectionModel: vi.fn().mockImplementation(() => ({
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
        has: vi.fn(() => false),
        size: vi.fn(() => 0),
        getAll: vi.fn(() => []),
        toArray: vi.fn(() => []),
        first: vi.fn(() => null),
    })),
}));

vi.mock('../../src/tools/object-tools/selection/SimpleDragController.js', () => ({
    SimpleDragController: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
    })),
}));

vi.mock('../../src/tools/object-tools/selection/ResizeController.js', () => ({
    ResizeController: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
    })),
}));

vi.mock('../../src/tools/object-tools/selection/RotateController.js', () => ({
    RotateController: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
    })),
}));

vi.mock('../../src/tools/object-tools/selection/GroupResizeController.js', () => ({
    GroupResizeController: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
    })),
}));

vi.mock('../../src/tools/object-tools/selection/GroupRotateController.js', () => ({
    GroupRotateController: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
    })),
}));

vi.mock('../../src/tools/object-tools/selection/GroupDragController.js', () => ({
    GroupDragController: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
    })),
}));

vi.mock('../../src/tools/object-tools/selection/BoxSelectController.js', () => ({
    BoxSelectController: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
    })),
}));

vi.mock('../../src/tools/ResizeHandles.js', () => ({
    ResizeHandles: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
        update: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
    })),
}));

import { SelectTool } from '../../src/tools/object-tools/SelectTool.js';

// ─────────────────────────────────────────────
// Хелперы
// ─────────────────────────────────────────────
function createMockEventBus() {
    const handlers = {};
    return {
        on: vi.fn((event, handler) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
        }),
        emit: vi.fn((event, data) => {
            if (handlers[event]) {
                handlers[event].forEach(h => h(data));
            }
        }),
        off: vi.fn(),
        _handlers: handlers,
    };
}

// ─────────────────────────────────────────────
// Тесты SelectTool (note-related)
// ─────────────────────────────────────────────
describe('SelectTool — функциональность записки', () => {
    let eventBus;
    let tool;
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        eventBus = createMockEventBus();
        tool = new SelectTool(eventBus);
    });

    // ═══════════════════════════════════════════
    // Инициализация textEditor
    // ═══════════════════════════════════════════
    describe('Инициализация textEditor', () => {
        it('textEditor должен быть неактивным по умолчанию', () => {
            expect(tool.textEditor.active).toBe(false);
        });

        it('textEditor.objectType по умолчанию должен быть "text"', () => {
            expect(tool.textEditor.objectType).toBe('text');
        });

        it('textEditor.objectId по умолчанию null', () => {
            expect(tool.textEditor.objectId).toBeNull();
        });

        it('textEditor.textarea по умолчанию null', () => {
            expect(tool.textEditor.textarea).toBeNull();
        });
    });

    // ═══════════════════════════════════════════
    // onDoubleClick — записка
    // ═══════════════════════════════════════════
    describe('onDoubleClick — записка', () => {
        it('должен отправить ObjectEdit с type="note" при двойном клике на записку', () => {
            const noteId = 'note-123';
            const notePixi = {
                _mb: {
                    type: 'note',
                    properties: { content: 'Текст записки', fontSize: 24 },
                },
            };

            // Мок hitTest чтобы вернуть записку
            tool.hitTest = vi.fn(() => ({
                type: 'object',
                object: noteId,
            }));

            // Мок emit чтобы перехватить GetObjectPixi и подставить pixiObject
            const originalEmit = tool.emit.bind(tool);
            tool.emit = vi.fn((event, data) => {
                if (event === Events.Tool.GetObjectPixi) {
                    data.pixiObject = notePixi;
                } else if (event === Events.Tool.GetObjectPosition) {
                    data.position = { x: 100, y: 200 };
                } else {
                    originalEmit(event, data);
                }
            });

            tool.onDoubleClick({ x: 100, y: 200 });

            expect(tool.emit).toHaveBeenCalledWith(
                Events.Tool.ObjectEdit,
                expect.objectContaining({
                    id: noteId,
                    type: 'note',
                    properties: { content: 'Текст записки' },
                    create: false,
                })
            );
        });

        it('должен получить позицию объекта перед отправкой ObjectEdit', () => {
            const noteId = 'note-456';
            tool.hitTest = vi.fn(() => ({
                type: 'object',
                object: noteId,
            }));

            const expectedPosition = { x: 300, y: 400 };
            tool.emit = vi.fn((event, data) => {
                if (event === Events.Tool.GetObjectPixi) {
                    data.pixiObject = {
                        _mb: { type: 'note', properties: { content: 'Test' } },
                    };
                } else if (event === Events.Tool.GetObjectPosition) {
                    data.position = expectedPosition;
                }
            });

            tool.onDoubleClick({ x: 300, y: 400 });

            const objectEditCall = tool.emit.mock.calls.find(
                c => c[0] === Events.Tool.ObjectEdit
            );
            expect(objectEditCall).toBeDefined();
            expect(objectEditCall[1].position).toEqual(expectedPosition);
        });

        it('должен передать пустой content если у записки нет текста', () => {
            tool.hitTest = vi.fn(() => ({
                type: 'object',
                object: 'note-empty',
            }));

            tool.emit = vi.fn((event, data) => {
                if (event === Events.Tool.GetObjectPixi) {
                    data.pixiObject = {
                        _mb: { type: 'note', properties: {} },
                    };
                } else if (event === Events.Tool.GetObjectPosition) {
                    data.position = { x: 0, y: 0 };
                }
            });

            tool.onDoubleClick({ x: 100, y: 100 });

            const objectEditCall = tool.emit.mock.calls.find(
                c => c[0] === Events.Tool.ObjectEdit
            );
            expect(objectEditCall[1].properties.content).toBe('');
        });

        it('не должен отправлять ObjectEdit для не-объекта', () => {
            tool.hitTest = vi.fn(() => ({
                type: 'empty',
                object: null,
            }));
            tool.emit = vi.fn();

            tool.onDoubleClick({ x: 100, y: 100 });

            const objectEditCalls = tool.emit.mock.calls.filter(
                c => c[0] === Events.Tool.ObjectEdit
            );
            expect(objectEditCalls).toHaveLength(0);
        });

        it('не должен отправлять note ObjectEdit для обычного текста', () => {
            tool.hitTest = vi.fn(() => ({
                type: 'object',
                object: 'text-1',
            }));

            tool.emit = vi.fn((event, data) => {
                if (event === Events.Tool.GetObjectPixi) {
                    data.pixiObject = {
                        _mb: { type: 'text', properties: { content: 'Hello' } },
                    };
                } else if (event === Events.Tool.GetObjectPosition) {
                    data.position = { x: 0, y: 0 };
                }
            });

            tool.onDoubleClick({ x: 100, y: 100 });

            const objectEditCalls = tool.emit.mock.calls.filter(
                c => c[0] === Events.Tool.ObjectEdit
            );
            expect(objectEditCalls).toHaveLength(1);
            expect(objectEditCalls[0][1].type).toBe('text');
        });
    });

    // ═══════════════════════════════════════════
    // selectedObjects (для NotePropertiesPanel)
    // ═══════════════════════════════════════════
    describe('selectedObjects', () => {
        it('должен предоставить selectedObjects через свойство', () => {
            expect(tool.selectedObjects).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════
    // Граничные случаи
    // ═══════════════════════════════════════════
    describe('Граничные случаи', () => {
        it('onDoubleClick не должен падать при pixiObject = null', () => {
            tool.hitTest = vi.fn(() => ({
                type: 'object',
                object: 'obj-1',
            }));

            tool.emit = vi.fn((event, data) => {
                if (event === Events.Tool.GetObjectPixi) {
                    data.pixiObject = null;
                }
            });

            expect(() => tool.onDoubleClick({ x: 100, y: 100 })).not.toThrow();
        });

        it('onDoubleClick не должен падать при отсутствии _mb', () => {
            tool.hitTest = vi.fn(() => ({
                type: 'object',
                object: 'obj-1',
            }));

            tool.emit = vi.fn((event, data) => {
                if (event === Events.Tool.GetObjectPixi) {
                    data.pixiObject = {};
                }
            });

            expect(() => tool.onDoubleClick({ x: 100, y: 100 })).not.toThrow();
        });

        it('onDoubleClick не должен падать при _mb без type', () => {
            tool.hitTest = vi.fn(() => ({
                type: 'object',
                object: 'obj-1',
            }));

            tool.emit = vi.fn((event, data) => {
                if (event === Events.Tool.GetObjectPixi) {
                    data.pixiObject = { _mb: {} };
                }
            });

            expect(() => tool.onDoubleClick({ x: 100, y: 100 })).not.toThrow();
        });
    });
});
