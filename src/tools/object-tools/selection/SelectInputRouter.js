import { Events } from '../../../core/events/Events.js';

export function onMouseDown(event) {
    // Если активен текстовый редактор, закрываем его при клике вне
    if (this.textEditor.active) {
        const activeEditorType = this.textEditor.objectType;
        if (this.textEditor.objectType === 'file') {
            this._closeFileNameEditor(true);
        } else {
            this._closeTextEditor(true);
        }
        // Mindmap UX: outside click should fully reset on first click
        // (editor close + selection clear + handles/buttons hidden).
        if (activeEditorType === 'mindmap') {
            this.clearSelection();
        }
        return; // Прерываем выполнение, чтобы не обрабатывать клик дальше
    }

    this.isMultiSelect = event.originalEvent.ctrlKey || event.originalEvent.metaKey || event.originalEvent.shiftKey;

    // Проверяем, что под курсором
    const hitResult = this.hitTest(event.x, event.y);

    if (hitResult.type === 'resize-handle') {
        this.startResize(hitResult.handle, hitResult.object);
    } else if (hitResult.type === 'rotate-handle') {
        this.startRotate(hitResult.object);
    } else if (this.selection.size() > 1) {
        // Особая логика для группового выделения: клики внутри общей рамки не снимают выделение
        const gb = this.computeGroupBounds();
        const insideGroup = this.isPointInBounds({ x: event.x, y: event.y }, { x: gb.x, y: gb.y, width: gb.width, height: gb.height });
        if (insideGroup) {
            // Если клик внутри группы (по объекту или пустому месту), сохраняем выделение и начинаем перетаскивание группы
            this.startGroupDrag(event);
            return;
        }
        // Вне группы — обычная логика
        if (hitResult.type === 'object') {
            this.handleObjectSelect(hitResult.object, event);
        } else {
            this.startBoxSelect(event);
        }
    } else if (hitResult.type === 'object') {
        // Особая логика для фреймов: если у фрейма есть дети и клик внутри внутренней области (без 20px рамки),
        // то не начинаем drag фрейма, а запускаем box-select для выбора объектов внутри
        const req = { objectId: hitResult.object, pixiObject: null };
        this.emit(Events.Tool.GetObjectPixi, req);
        const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
        if (mbType === 'frame') {
            // Получаем данные фрейма и его экранные границы
            const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
            const frameObj = objects.find(o => o.id === hitResult.object);
            const hasChildren = !!(objects && objects.some(o => o.properties && o.properties.frameId === hitResult.object));
            if (req.pixiObject && hasChildren && frameObj) {
                const bounds = req.pixiObject.getBounds(); // экранные координаты
                const inner = { x: bounds.x + 20, y: bounds.y + 20, width: Math.max(0, bounds.width - 40), height: Math.max(0, bounds.height - 40) };
                const insideInner = this.isPointInBounds({ x: event.x, y: event.y }, inner);
                // Если клик внутри внутренней области — запускаем box-select и выходим
                if (insideInner) {
                    // Запускаем рамку выделения вместо drag фрейма
                    this.startBoxSelect(event);
                    return;
                }
                // Если клик на 20px рамке — позволяем перетягивать фрейм. Но запрещаем box-select от рамки.
                // Здесь ничего не делаем: ниже пойдёт обычная логика handleObjectSelect
            }
        }
        // Обычная логика: начинаем drag выбранного объекта
        this.handleObjectSelect(hitResult.object, event);
    } else {
        // Клик по пустому месту — если есть одиночное выделение, разрешаем drag за пределами объекта в пределах рамки
        if (this.selection.size() === 1) {
            const selId = this.selection.toArray()[0];
            // Если выбран фрейм с детьми и клик внутри внутренней области — не начинаем drag, а box-select
            const req = { objectId: selId, pixiObject: null };
            this.emit(Events.Tool.GetObjectPixi, req);
            const isFrame = !!(req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type === 'frame');
            if (isFrame) {
                const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
                const frameObj = objects.find(o => o.id === selId);
                const hasChildren = !!(objects && objects.some(o => o.properties && o.properties.frameId === selId));
                if (frameObj && hasChildren) {
                    const b = { x: frameObj.position.x, y: frameObj.position.y, width: frameObj.width || 0, height: frameObj.height || 0 };
                    const inner = { x: b.x + 20, y: b.y + 20, width: Math.max(0, b.width - 40), height: Math.max(0, b.height - 40) };
                    const insideInner = this.isPointInBounds({ x: event.x, y: event.y }, inner);
                    if (insideInner) {
                        this.startBoxSelect(event);
                        return;
                    }
                }
            }
            // Обычная логика: если клик внутри рамки выбранного — начинаем drag
            const boundsReq = { objects: [] };
            this.emit(Events.Tool.GetAllObjects, boundsReq);
            const map = new Map(boundsReq.objects.map(o => [o.id, o.bounds]));
            const b = map.get(selId);
            if (b && this.isPointInBounds({ x: event.x, y: event.y }, b)) {
                // Для фрейма c детьми: отфильтруем клики внутри внутренней области (box-select)
                const req2 = { objectId: selId, pixiObject: null };
                this.emit(Events.Tool.GetObjectPixi, req2);
                const isFrame2 = !!(req2.pixiObject && req2.pixiObject._mb && req2.pixiObject._mb.type === 'frame');
                if (isFrame2) {
                    const os = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
                    const fr = os.find(o => o.id === selId);
                    const hasChildren2 = !!(os && os.some(o => o.properties && o.properties.frameId === selId));
                    if (req2.pixiObject && fr && hasChildren2) {
                        const bounds2 = req2.pixiObject.getBounds();
                        const inner2 = { x: bounds2.x + 20, y: bounds2.y + 20, width: Math.max(0, bounds2.width - 40), height: Math.max(0, bounds2.height - 40) };
                        if (this.isPointInBounds({ x: event.x, y: event.y }, inner2)) {
                            this.startBoxSelect(event);
                            return;
                        }
                    }
                }
                // Старт перетаскивания как если бы кликнули по объекту
                this.startDrag(selId, event);
                return;
            }
        }
        // Иначе — начинаем рамку выделения
        this.startBoxSelect(event);
    }
}

export function onMouseMove(event) {
    // Проверяем, что инструмент не уничтожен
    if (this.destroyed) {
        return;
    }

    // Обновляем текущие координаты мыши
    this.currentX = event.x;
    this.currentY = event.y;

    if (this.isResizing || this.isGroupResizing) {
        this.updateResize(event);
    } else if (this.isRotating || this.isGroupRotating) {
        this.updateRotate(event);
    } else if (this.isDragging || this.isGroupDragging) {
        this.updateDrag(event);
    } else if (this.isBoxSelect) {
        this.updateBoxSelect(event);
    } else {
        // Обновляем курсор в зависимости от того, что под мышью
        this.updateCursor(event);
    }
}

export function onMouseUp(event) {
    if (this.isResizing || this.isGroupResizing) {
        this.endResize();
    } else if (this.isRotating || this.isGroupRotating) {
        this.endRotate();
    } else if (this.isDragging || this.isGroupDragging) {
        this.endDrag();
    } else if (this.isBoxSelect) {
        this.endBoxSelect();
    }
}

export function onDoubleClick(event) {
    const hitResult = this.hitTest(event.x, event.y);

    if (hitResult.type === 'object') {
        // если это текст или записка — войдём в режим редактирования через ObjectEdit
        const req = { objectId: hitResult.object, pixiObject: null };
        this.emit(Events.Tool.GetObjectPixi, req);
        const pix = req.pixiObject;

        const isText = !!(pix && pix._mb && pix._mb.type === 'text');
        const isNote = !!(pix && pix._mb && pix._mb.type === 'note');
        const isFile = !!(pix && pix._mb && pix._mb.type === 'file');

        if (isText) {
            // Получаем позицию объекта для редактирования
            const posData = { objectId: hitResult.object, position: null };
            this.emit(Events.Tool.GetObjectPosition, posData);

            // Получаем содержимое из properties объекта
            const textContent = pix._mb?.properties?.content || '';

            this.emit(Events.Tool.ObjectEdit, {
                id: hitResult.object,
                type: 'text',
                position: posData.position,
                properties: { content: textContent },
                caretClick: {
                    clientX: event?.originalEvent?.clientX,
                    clientY: event?.originalEvent?.clientY
                },
                create: false
            });
            return;
        }
        if (isNote) {
            const noteProps = pix._mb.properties || {};
            // Получаем позицию объекта для редактирования
            const posData = { objectId: hitResult.object, position: null };
            this.emit(Events.Tool.GetObjectPosition, posData);

            this.emit(Events.Tool.ObjectEdit, {
                id: hitResult.object,
                type: 'note',
                position: posData.position,
                properties: { content: noteProps.content || '' },
                create: false
            });
            return;
        }

        if (isFile) {
            const fileProps = pix._mb.properties || {};
            // Получаем позицию объекта для редактирования
            const posData = { objectId: hitResult.object, position: null };
            this.emit(Events.Tool.GetObjectPosition, posData);

            this.emit(Events.Tool.ObjectEdit, {
                id: hitResult.object,
                type: 'file',
                position: posData.position,
                properties: { fileName: fileProps.fileName || 'Untitled' },
                create: false
            });
            return;
        }
        this.editObject(hitResult.object);
    }
}

export function onContextMenu(event) {
    // Определяем, что под курсором
    const hit = this.hitTest(event.x, event.y);
    let context = 'canvas';
    let targetId = null;
    if (hit && hit.type === 'object' && hit.object) {
        targetId = hit.object;
        if (this.selection.has(targetId) && this.selection.size() > 1) {
            context = 'group';
        } else {
            context = 'object';
        }
    } else if (this.selection.size() > 1) {
        context = 'group';
    }
    // Сообщаем ядру/UI, что нужно показать контекстное меню (пока без пунктов)
    this.emit(Events.Tool.ContextMenuShow, { x: event.x, y: event.y, context, targetId });
}

export function onKeyDown(event) {
    // Проверяем, не активен ли текстовый редактор (редактирование названия файла или текста)
    if (this.textEditor && this.textEditor.active) {
        return; // Не обрабатываем клавиши во время редактирования
    }

    switch (event.key) {
        case 'Delete':
        case 'Backspace':
            this.deleteSelectedObjects();
            break;

        case 'a':
            if (event.ctrlKey) {
                this.selectAll();
                event.originalEvent.preventDefault();
            }
            break;

        case 'Escape':
            this.clearSelection();
            break;
    }
}
