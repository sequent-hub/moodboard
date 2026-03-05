import { Events } from '../../../core/events/Events.js';
import { registerEditorListeners } from './InlineEditorListenersRegistry.js';

export function setupNoteInlineEditor(controller, params) {
    const {
        objectId,
        position,
        initialSize,
        view,
        screenPos,
        textarea,
        wrapper,
        computeLineHeightPx,
        effectiveFontPx,
        toScreen,
    } = params;

    // Получаем актуальные размеры записки
    let noteWidth = 160;
    let noteHeight = 100;

    if (initialSize) {
        noteWidth = initialSize.width;
        noteHeight = initialSize.height;
    } else if (objectId) {
        // Если размер не передан, пытаемся получить его из объекта
        const sizeData = { objectId, size: null };
        controller.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (sizeData.size) {
            noteWidth = sizeData.size.width;
            noteHeight = sizeData.size.height;
        }
    }

    // Текст у записки центрирован по обеим осям; textarea тоже центрируем
    const horizontalPadding = 16; // немного больше, чем раньше
    // Преобразуем мировые размеры/отступы в CSS-пиксели с учётом текущего зума
    const viewResLocal = (controller.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
    const worldLayerRefForCss = controller.textEditor.world || (controller.app?.stage);
    const sForCss = worldLayerRefForCss?.scale?.x || 1;
    const sCssLocal = sForCss / viewResLocal;
    const editorWidthWorld = Math.min(360, Math.max(1, noteWidth - (horizontalPadding * 2)));
    const editorHeightWorld = Math.min(180, Math.max(1, noteHeight - (horizontalPadding * 2)));
    const editorWidthPx = Math.max(1, Math.round(editorWidthWorld * sCssLocal));
    const editorHeightPx = Math.max(1, Math.round(editorHeightWorld * sCssLocal));
    const textCenterXWorld = noteWidth / 2;
    const textCenterYWorld = noteHeight / 2;
    const editorLeftWorld = textCenterXWorld - (editorWidthWorld / 2);
    const editorTopWorld = textCenterYWorld - (editorHeightWorld / 2);
    wrapper.style.left = `${Math.round(screenPos.x + editorLeftWorld * sCssLocal)}px`;
    wrapper.style.top = `${Math.round(screenPos.y + editorTopWorld * sCssLocal)}px`;
    // Устанавливаем размеры редактора (центрируем по контенту) в CSS-пикселях
    textarea.style.width = `${editorWidthPx}px`;
    textarea.style.height = `${editorHeightPx}px`;
    wrapper.style.width = `${editorWidthPx}px`;
    wrapper.style.height = `${editorHeightPx}px`;

    // Для записок: авто-ресайз редактора под содержимое с сохранением центрирования
    textarea.style.textAlign = 'center';
    const maxEditorWidthPx = Math.max(1, Math.round((noteWidth - (horizontalPadding * 2)) * sCssLocal));
    const maxEditorHeightPx = Math.max(1, Math.round((noteHeight - (horizontalPadding * 2)) * sCssLocal));
    const MIN_NOTE_EDITOR_W = 20;
    const MIN_NOTE_EDITOR_H = Math.max(1, computeLineHeightPx(effectiveFontPx));

    const autoSizeNote = () => {
        // Сначала сбрасываем размеры, чтобы измерить естественные
        textarea.style.width = 'auto';
        textarea.style.height = 'auto';

        // Ширина по содержимому, но не шире границ записки (в CSS-пикселях)
        const naturalW = Math.ceil(textarea.scrollWidth + 1);
        const targetW = Math.min(maxEditorWidthPx, Math.max(MIN_NOTE_EDITOR_W, naturalW));
        textarea.style.width = `${targetW}px`;
        wrapper.style.width = `${targetW}px`;

        // Высота по содержимому, c нижним пределом = одна строка
        const computed = (typeof window !== 'undefined') ? window.getComputedStyle(textarea) : null;
        const lineH = (computed ? parseFloat(computed.lineHeight) : computeLineHeightPx(effectiveFontPx));
        const naturalH = Math.ceil(textarea.scrollHeight);
        const targetH = Math.min(maxEditorHeightPx, Math.max(MIN_NOTE_EDITOR_H, naturalH));
        textarea.style.height = `${targetH}px`;
        wrapper.style.height = `${targetH}px`;

        // Центрируем wrapper внутри записки после смены размеров (в CSS-пикселях)
        const left = Math.round(screenPos.x + (noteWidth * sCssLocal) / 2 - (targetW / 2));
        const top = Math.round(screenPos.y + (noteHeight * sCssLocal) / 2 - (targetH / 2));
        wrapper.style.left = `${left}px`;
        wrapper.style.top = `${top}px`;
    };
    // Первый вызов — синхронизировать с текущим содержимым
    autoSizeNote();

    // Динамическое обновление позиции/размера редактора при зуме/панорамировании/трансформациях
    const updateNoteEditor = () => {
        try {
            // Актуальная позиция и размер объекта в мире
            const posDataNow = { objectId, position: null };
            const sizeDataNow = { objectId, size: null };
            controller.eventBus.emit(Events.Tool.GetObjectPosition, posDataNow);
            controller.eventBus.emit(Events.Tool.GetObjectSize, sizeDataNow);
            const posNow = posDataNow.position || position;
            const sizeNow = sizeDataNow.size || { width: noteWidth, height: noteHeight };
            const screenNow = toScreen(posNow.x, posNow.y);
            // Пересчитываем масштаб в CSS пикселях
            const vr = (controller.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
            const wl = controller.textEditor.world || (controller.app?.stage);
            const sc = wl?.scale?.x || 1;
            const sCss = sc / vr;
            const maxWpx = Math.max(1, Math.round((sizeNow.width - (horizontalPadding * 2)) * sCss));
            const maxHpx = Math.max(1, Math.round((sizeNow.height - (horizontalPadding * 2)) * sCss));
            // Измеряем естественный размер по контенту
            textarea.style.width = 'auto';
            textarea.style.height = 'auto';
            const naturalW = Math.ceil(textarea.scrollWidth + 1);
            const naturalH = Math.ceil(textarea.scrollHeight);
            const wPx = Math.min(maxWpx, Math.max(MIN_NOTE_EDITOR_W, naturalW));
            const hPx = Math.min(maxHpx, Math.max(MIN_NOTE_EDITOR_H, naturalH));
            // Применяем размеры редактора
            textarea.style.width = `${wPx}px`;
            wrapper.style.width = `${wPx}px`;
            textarea.style.height = `${hPx}px`;
            wrapper.style.height = `${hPx}px`;
            // Центрируем в пределах записки
            const left = Math.round(screenNow.x + (sizeNow.width * sCss) / 2 - (wPx / 2));
            const top = Math.round(screenNow.y + (sizeNow.height * sCss) / 2 - (hPx / 2));
            wrapper.style.left = `${left}px`;
            wrapper.style.top = `${top}px`;
            // Восстанавливаем прошлые значения, чтобы избежать мигания в стилях при следующем измерении
            textarea.style.width = `${wPx}px`;
            textarea.style.height = `${hPx}px`;
        } catch (_) {}
    };
    const onZoom = () => updateNoteEditor();
    const onPan = () => updateNoteEditor();
    const onDrag = (e) => { if (e && e.object === objectId) updateNoteEditor(); };
    const onResize = (e) => { if (e && e.object === objectId) updateNoteEditor(); };
    const onRotate = (e) => { if (e && e.object === objectId) updateNoteEditor(); };
    const listeners = [
        [Events.UI.ZoomPercent, onZoom],
        [Events.Tool.PanUpdate, onPan],
        [Events.Tool.DragUpdate, onDrag],
        [Events.Tool.ResizeUpdate, onResize],
        [Events.Tool.RotateUpdate, onRotate],
    ];
    registerEditorListeners(controller.eventBus, listeners);
    // Сохраняем слушателей для снятия при закрытии редактора
    controller.textEditor._listeners = listeners;

    return { updateNoteEditor };
}
