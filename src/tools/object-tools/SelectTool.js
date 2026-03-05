import { BaseTool } from '../BaseTool.js';
import { SelectionModel } from './selection/SelectionModel.js';
// import { HandlesSync } from './selection/HandlesSync.js';
import {
    onMouseDown as routeOnMouseDown,
    onMouseMove as routeOnMouseMove,
    onMouseUp as routeOnMouseUp,
    onDoubleClick as routeOnDoubleClick,
    onContextMenu as routeOnContextMenu,
    onKeyDown as routeOnKeyDown
} from './selection/SelectInputRouter.js';
import {
    drawGroupSelectionGraphics as drawGroupSelectionGraphicsViaService,
    removeGroupSelectionGraphics as removeGroupSelectionGraphicsViaService,
    computeGroupBounds as computeGroupBoundsViaService,
    ensureGroupBoundsGraphics as ensureGroupBoundsGraphicsViaService,
    updateGroupBoundsGraphics as updateGroupBoundsGraphicsViaService,
    updateGroupBoundsGraphicsByTopLeft as updateGroupBoundsGraphicsByTopLeftViaService
} from './selection/SelectionOverlayService.js';
import { toWorld as toWorldViaMapper } from './selection/CoordinateMapper.js';
import {
    onGroupDuplicateReady as onGroupDuplicateReadyViaCloneFlow,
    onDuplicateReady as onDuplicateReadyViaCloneFlow
} from './selection/CloneFlowController.js';
import {
    openTextEditor as openTextEditorViaController,
    openFileNameEditor as openFileNameEditorViaController,
    closeFileNameEditor as closeFileNameEditorViaController,
    closeTextEditor as closeTextEditorViaController
} from './selection/InlineEditorController.js';
import {
    hitTest as hitTestViaService,
    getPixiObjectAt as getPixiObjectAtViaService
} from './selection/HitTestService.js';
import {
    updateCursor as updateCursorViaController,
    createRotatedResizeCursor as createRotatedResizeCursorViaController,
    getResizeCursor as getResizeCursorViaController,
    setCursor as setCursorViaController
} from './selection/CursorController.js';
import {
    addToSelection as addToSelectionViaState,
    removeFromSelection as removeFromSelectionViaState,
    clearSelection as clearSelectionViaState,
    selectAll as selectAllViaState,
    deleteSelectedObjects as deleteSelectedObjectsViaState,
    editObject as editObjectViaState,
    getSelection as getSelectionViaState,
    hasSelection as hasSelectionViaState,
    setSelection as setSelectionViaState,
    updateResizeHandles as updateResizeHandlesViaState,
    onActivateSelection
} from './selection/SelectionStateController.js';
import {
    handleObjectSelect as handleObjectSelectViaController,
    startDrag as startDragViaController,
    updateDrag as updateDragViaController,
    endDrag as endDragViaController,
    startResize as startResizeViaController,
    updateResize as updateResizeViaController,
    endResize as endResizeViaController,
    startRotate as startRotateViaController,
    updateRotate as updateRotateViaController,
    endRotate as endRotateViaController,
    startBoxSelect as startBoxSelectViaController,
    updateBoxSelect as updateBoxSelectViaController,
    endBoxSelect as endBoxSelectViaController,
    startGroupDrag as startGroupDragViaController,
    prepareAltCloneDrag as prepareAltCloneDragViaController,
    transformHandleType as transformHandleTypeViaController,
    calculateNewSize as calculateNewSizeViaController,
    calculatePositionOffset as calculatePositionOffsetViaController
} from './selection/TransformInteractionController.js';
import {
    initializeSelectToolState,
    registerSelectToolCoreSubscriptions
} from './selection/SelectToolSetup.js';
import {
    activateSelectTool,
    deactivateSelectTool,
    destroySelectTool
} from './selection/SelectToolLifecycleController.js';
import cursorDefaultSvg from '../../assets/icons/cursor-default.svg?raw';

const DEFAULT_CURSOR = '';

/**
 * Инструмент выделения и работы с объектами
 * Основной инструмент для выделения, перемещения, изменения размера и поворота объектов
 */
export class SelectTool extends BaseTool {
    constructor(eventBus) {
        super('select', eventBus);
        this.cursor = DEFAULT_CURSOR;
        this.hotkey = 'v';

        // Состояние выделения перенесено в модель
        this.selection = new SelectionModel();

        initializeSelectToolState(this);
        registerSelectToolCoreSubscriptions(this);
    }
    
    activate(app) {
        return activateSelectTool.call(this, app, DEFAULT_CURSOR, () => super.activate());
    }

    _has(id) { return this.selection.has(id); }
    _size() { return this.selection.size(); }
    _ids() { return this.selection.toArray(); }
    _clear() { this.selection.clear(); }
    _add(id) { this.selection.add(id); }
    _addMany(ids) { this.selection.addMany(ids); }
    _remove(id) { this.selection.remove(id); }
    _toggle(id) { this.selection.toggle(id); }
    _computeGroupBounds(getPixiById) { return this.selection.computeBounds(getPixiById); }
    
    deactivate() {
        return deactivateSelectTool.call(this, () => super.deactivate());
    }

    onMouseDown(event) {
        super.onMouseDown(event);
        routeOnMouseDown.call(this, event);
    }

    onMouseMove(event) {
        super.onMouseMove(event);
        routeOnMouseMove.call(this, event);
    }

    onMouseUp(event) {
        routeOnMouseUp.call(this, event);
        super.onMouseUp(event);
    }

    onDoubleClick(event) {
        routeOnDoubleClick.call(this, event);
    }
    onContextMenu(event) {
        routeOnContextMenu.call(this, event);
    }

    onKeyDown(event) {
        routeOnKeyDown.call(this, event);
    }

    hitTest(x, y) {
        return hitTestViaService.call(this, x, y);
    }

    getPixiObjectAt(x, y) {
        return getPixiObjectAtViaService.call(this, x, y);
    }

    handleObjectSelect(objectId, event) {
        return handleObjectSelectViaController.call(this, objectId, event);
    }

    startDrag(objectId, event) {
        return startDragViaController.call(this, objectId, event);
    }

    updateDrag(event) {
        return updateDragViaController.call(this, event);
    }

    endDrag() {
        return endDragViaController.call(this);
    }

    startResize(handle, objectId) {
        return startResizeViaController.call(this, handle, objectId);
    }

    updateResize(event) {
        return updateResizeViaController.call(this, event);
    }

    endResize() {
        return endResizeViaController.call(this);
    }

    startRotate(objectId) {
        return startRotateViaController.call(this, objectId);
    }

    updateRotate(event) {
        return updateRotateViaController.call(this, event);
    }

    endRotate() {
        return endRotateViaController.call(this);
    }

    startBoxSelect(event) {
        return startBoxSelectViaController.call(this, event);
    }

    updateBoxSelect(event) {
        return updateBoxSelectViaController.call(this, event);
    }

    endBoxSelect() {
        return endBoxSelectViaController.call(this);
    }
    rectIntersectsRect(a, b) {
        return !(
            b.x > a.x + a.width ||
            b.x + b.width < a.x ||
            b.y > a.y + a.height ||
            b.y + b.height < a.y
        );
    }

    setSelection(objectIds) {
        return setSelectionViaState.call(this, objectIds);
    }
    drawGroupSelectionGraphics() {
        return drawGroupSelectionGraphicsViaService.call(this);
    }
    removeGroupSelectionGraphics() {
        return removeGroupSelectionGraphicsViaService.call(this);
    }
    computeGroupBounds() {
        return computeGroupBoundsViaService.call(this);
    }

    ensureGroupBoundsGraphics(bounds) {
        return ensureGroupBoundsGraphicsViaService.call(this, bounds);
    }

    updateGroupBoundsGraphics(bounds) {
        return updateGroupBoundsGraphicsViaService.call(this, bounds);
    }

    updateGroupBoundsGraphicsByTopLeft(topLeft) {
        return updateGroupBoundsGraphicsByTopLeftViaService.call(this, topLeft);
    }

    _toWorld(x, y) {
        return toWorldViaMapper.call(this, x, y);
    }

    startGroupDrag(event) {
        return startGroupDragViaController.call(this, event);
    }

    onGroupDuplicateReady(idMap) {
        return onGroupDuplicateReadyViaCloneFlow.call(this, idMap);
    }

    updateCursor(event) {
        return updateCursorViaController.call(this, event, DEFAULT_CURSOR);
    }
    createRotatedResizeCursor(handleType, rotationDegrees) {
        return createRotatedResizeCursorViaController.call(this, handleType, rotationDegrees);
    }
    getResizeCursor(handle) {
        return getResizeCursorViaController.call(this, handle, DEFAULT_CURSOR);
    }

    setCursor() {
        this.__baseSetCursor = super.setCursor.bind(this);
        return setCursorViaController.call(this);
    }
    addToSelection(object) {
        return addToSelectionViaState.call(this, object);
    }

    removeFromSelection(object) {
        return removeFromSelectionViaState.call(this, object);
    }

    clearSelection() {
        return clearSelectionViaState.call(this);
    }
    
    selectAll() {
        return selectAllViaState.call(this);
    }
    
    deleteSelectedObjects() {
        return deleteSelectedObjectsViaState.call(this);
    }
    
    editObject(object) {
        return editObjectViaState.call(this, object);
    }
    
    getSelection() {
        return getSelectionViaState.call(this);
    }

    get selectedObjects() {
        return new Set(this.selection.toArray());
    }

    onActivate() {
        return onActivateSelection.call(this);
    }
    
    hasSelection() {
        return hasSelectionViaState.call(this);
    }
    
    updateResizeHandles() {
        return updateResizeHandlesViaState.call(this);
    }
    prepareAltCloneDrag(objectId, event) {
        return prepareAltCloneDragViaController.call(this, objectId, event);
    }
    transformHandleType(handleType, rotationDegrees) {
        return transformHandleTypeViaController.call(this, handleType, rotationDegrees);
    }
    calculateNewSize(handleType, startBounds, deltaX, deltaY, maintainAspectRatio) {
        return calculateNewSizeViaController.call(this, handleType, startBounds, deltaX, deltaY, maintainAspectRatio);
    }

    calculatePositionOffset(handleType, startBounds, newSize, objectRotation = 0) {
        return calculatePositionOffsetViaController.call(this, handleType, startBounds, newSize, objectRotation);
    }

    _openTextEditor(object, create = false) {
        return openTextEditorViaController.call(this, object, create);
    }

    _openFileNameEditor(object, create = false) {
        return openFileNameEditorViaController.call(this, object, create);
    }
    _closeFileNameEditor(commit) {
        return closeFileNameEditorViaController.call(this, commit);
    }

    _closeTextEditor(commit) {
        return closeTextEditorViaController.call(this, commit);
    }

    destroy() {
        return destroySelectTool.call(this, () => super.destroy());
    }

    onDuplicateReady(newObjectId) {
        return onDuplicateReadyViaCloneFlow.call(this, newObjectId);
    }

}
