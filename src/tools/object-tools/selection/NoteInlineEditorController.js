import { Events } from '../../../core/events/Events.js';
import {
    createNoteEditorUpdater,
    registerNoteEditorSync,
} from './TextEditorSyncService.js';

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
    const updateNoteEditor = createNoteEditorUpdater(controller, {
        objectId,
        position,
        noteWidth,
        noteHeight,
        view,
        textarea,
        wrapper,
        horizontalPadding,
        computeLineHeightPx,
        effectiveFontPx,
        toScreen,
    });
    registerNoteEditorSync(controller, { objectId, updateNoteEditor });

    return { updateNoteEditor };
}
