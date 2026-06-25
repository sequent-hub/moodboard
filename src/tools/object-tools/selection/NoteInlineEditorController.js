import { Events } from '../../../core/events/Events.js';
import {
    applyNoteEditorBox,
    createNoteEditorUpdater,
    registerNoteEditorSync,
} from './TextEditorSyncService.js';

// Разметка иконки запрета (assets/icons/ban.svg). stroke=currentColor — цвет задаётся CSS.
const NOTE_BAN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.929 4.929 19.07 19.071"/></svg>';

/**
 * Создаёт (или переиспользует) оверлей запрета ввода внутри wrapper редактора записки
 * и возвращает функцию переключения его видимости.
 * @param {HTMLElement} wrapper
 * @returns {(visible: boolean) => void}
 */
function ensureNoteLimitBan(wrapper) {
    let banEl = wrapper.querySelector('.moodboard-note-limit-ban');
    if (!banEl) {
        banEl = document.createElement('div');
        banEl.className = 'moodboard-note-limit-ban';
        banEl.innerHTML = NOTE_BAN_SVG;
        banEl.style.display = 'none';
        wrapper.appendChild(banEl);
    }
    return (visible) => {
        banEl.style.display = visible ? 'flex' : 'none';
    };
}

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

    // Текст у записки центрирован по обеим осям; редактор повторяет блок текста.
    const horizontalPadding = 16;
    // Мировые размеры/отступы → CSS-пиксели. Множитель = worldScale, БЕЗ деления на
    // renderer.resolution: screenPos берётся из toGlobal (см. InlineEditorPositioningService),
    // который уже возвращает CSS-px независимо от res, а сама записка рисуется в PIXI, где
    // 1 мировая единица = worldScale CSS-px. Лишнее /res занижало ширину блока и слагаемое
    // центрирования (noteWidth*scale/2) → при зуме браузера ≠100% (res≠1) редактор уезжал влево.
    const worldLayerRefForCss = controller.textEditor.world || (controller.app?.stage);
    const sForCss = worldLayerRefForCss?.scale?.x || 1;
    const sCssLocal = sForCss;

    const backdrop = wrapper.querySelector('.moodboard-text-backdrop');

    // Оверлей запрета ввода: показывается по центру записки, когда достигнут лимит
    // строк (NOTE_MAX_LINES). Иконка — assets/icons/ban.svg (stroke=currentColor).
    const setBanVisible = ensureNoteLimitBan(wrapper);

    // Внутренний блок текста = границы записки минус отступы, ограничение ширины 360 —
    // как в NoteObject._getVisibleTextWidth.
    const MIN_NOTE_EDITOR_H = Math.max(1, computeLineHeightPx(effectiveFontPx));
    const innerWorldW = Math.max(1, Math.min(360, noteWidth - (horizontalPadding * 2)));
    const innerWorldH = Math.max(1, noteHeight - (horizontalPadding * 2));
    const boxW = Math.max(1, Math.round(innerWorldW * sCssLocal));
    const innerH = Math.max(MIN_NOTE_EDITOR_H, Math.round(innerWorldH * sCssLocal));

    const autoSizeNote = () => {
        const result = applyNoteEditorBox(textarea, backdrop, {
            boxW,
            innerH,
            effectiveFontPx,
        });
        wrapper.style.width = `${boxW}px`;
        wrapper.style.height = `${result.contentH}px`;

        // Центрируем блок контента внутри записки по обеим осям (как PIXI-текст).
        const left = Math.round(screenPos.x + (noteWidth * sCssLocal) / 2 - (boxW / 2));
        const top = Math.round(screenPos.y + (noteHeight * sCssLocal) / 2 - (result.contentH / 2));
        wrapper.style.left = `${left}px`;
        wrapper.style.top = `${top}px`;
        return result;
    };
    // Первый вызов — синхронизировать с текущим содержимым
    const initial = autoSizeNote();
    setBanVisible(!!(initial && initial.full));

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

    return { updateNoteEditor, setBanVisible };
}
