import { Events } from '../../../core/events/Events.js';
import { unregisterSelectToolCoreSubscriptions } from './SelectToolSetup.js';
import { ResizeHandles } from '../../ResizeHandles.js';
import { SimpleDragController } from './SimpleDragController.js';
import { ResizeController } from './ResizeController.js';
import { RotateController } from './RotateController.js';
import { GroupResizeController } from './GroupResizeController.js';
import { GroupRotateController } from './GroupRotateController.js';
import { GroupDragController } from './GroupDragController.js';
import { BoxSelectController } from './BoxSelectController.js';

export function activateSelectTool(app, defaultCursor, superActivate) {
    superActivate();
    // Сохраняем ссылку на PIXI app для оверлеев (рамка выделения)
    this.app = app;

    // Устанавливаем стандартный курсор для select инструмента
    if (this.app && this.app.view) {
        this.app.view.style.cursor = defaultCursor; // пусто → наследует глобальный CSS
    }

    // Инициализируем систему ручек изменения размера
    if (!this.resizeHandles && app) {
        this.resizeHandles = new ResizeHandles(app);
        // Полностью отключаем синхронизацию старых PIXI-ручек
        if (this.resizeHandles && typeof this.resizeHandles.hideHandles === 'function') {
            this.resizeHandles.hideHandles();
        }
        this._dragCtrl = new SimpleDragController({
            emit: (event, payload) => this.emit(event, payload)
        });
        this._resizeCtrl = new ResizeController({
            emit: (event, payload) => this.emit(event, payload),
            getRotation: (objectId) => {
                const d = { objectId, rotation: 0 };
                this.emit(Events.Tool.GetObjectRotation, d);
                return d.rotation || 0;
            }
        });
        this._rotateCtrl = new RotateController({
            emit: (event, payload) => this.emit(event, payload)
        });
        this._groupResizeCtrl = new GroupResizeController({
            emit: (event, payload) => this.emit(event, payload),
            selection: this.selection,
            getGroupBounds: () => this.computeGroupBounds(),
            ensureGroupGraphics: (b) => this.ensureGroupBoundsGraphics(b),
            updateGroupGraphics: (b) => this.updateGroupBoundsGraphics(b)
        });
        this._groupRotateCtrl = new GroupRotateController({
            emit: (event, payload) => this.emit(event, payload),
            selection: this.selection,
            getGroupBounds: () => this.computeGroupBounds(),
            ensureGroupGraphics: (b) => this.ensureGroupBoundsGraphics(b),
            updateHandles: () => { if (this.resizeHandles) this.resizeHandles.updateHandles(); }
        });
        this._groupDragCtrl = new GroupDragController({
            emit: (event, payload) => this.emit(event, payload),
            selection: this.selection,
            updateGroupBoundsByTopLeft: (pos) => this.updateGroupBoundsGraphicsByTopLeft(pos)
        });
        this._boxSelect = new BoxSelectController({
            app,
            selection: this.selection,
            emit: (event, payload) => this.emit(event, payload),
            setSelection: (ids) => this.setSelection(ids),
            clearSelection: () => this.clearSelection(),
            rectIntersectsRect: (a, b) => this.rectIntersectsRect(a, b)
        });
    } else if (!app) {
        console.log('❌ PIXI app не передан в activate');
    } else {
    }
}

export function deactivateSelectTool(superDeactivate) {
    superDeactivate();

    // Закрываем текстовый/файловый редактор если открыт
    if (this.textEditor.active) {
        if (this.textEditor.objectType === 'file') {
            this._closeFileNameEditor(true);
        } else {
            this._closeTextEditor(true);
        }
    }

    // Очищаем выделение и ручки
    this.clearSelection();
    // Скрываем любые старые PIXI-ручки: используем только HTML-ручки

    // Сбрасываем курсор на стандартный
    if (this.app && this.app.view) {
        this.app.view.style.cursor = '';
    }
}

export function destroySelectTool(superDestroy) {
    if (this.destroyed) {
        return;
    }

    this.destroyed = true;

    unregisterSelectToolCoreSubscriptions(this);
    this.clearSelection();

    // Уничтожаем ручки изменения размера
    if (this.resizeHandles) {
        this.resizeHandles.destroy();
        this.resizeHandles = null;
    }

    // Очищаем контроллеры
    this.dragController = null;
    this.resizeController = null;
    this.rotateController = null;
    this.groupDragController = null;
    this.groupResizeController = null;
    this.groupRotateController = null;
    this.boxSelectController = null;

    // Очищаем модель выделения
    this.selection = null;

    // Вызываем destroy родительского класса
    superDestroy();
}
