import { Events } from '../../../core/events/Events.js';
import { registerEditorListeners } from './InlineEditorListenersRegistry.js';

export function createRegularTextAutoSize({
    textarea,
    wrapper,
    minWBound,
    minHBound,
    effectiveFontPx,
    computeLineHeightPx,
}) {
    const MAX_AUTO_WIDTH = 360;
    const BASELINE_FIX = 2;

    return () => {
        textarea.style.width = 'auto';
        textarea.style.height = 'auto';

        const naturalW = textarea.scrollWidth + 1;
        const targetW = Math.min(MAX_AUTO_WIDTH, Math.max(minWBound, naturalW));
        textarea.style.width = `${targetW}px`;
        wrapper.style.width = `${targetW}px`;

        textarea.style.height = 'auto';
        const adjust = BASELINE_FIX;
        const computed = (typeof window !== 'undefined') ? window.getComputedStyle(textarea) : null;
        const lineH = (computed ? parseFloat(computed.lineHeight) : computeLineHeightPx(effectiveFontPx)) + 10;
        const rawH = textarea.scrollHeight;
        const lines = lineH > 0 ? Math.max(1, Math.round(rawH / lineH)) : 1;
        const targetH = lines <= 1
            ? Math.max(minHBound, Math.max(1, lineH - BASELINE_FIX))
            : Math.max(minHBound, Math.max(1, rawH - adjust));
        textarea.style.height = `${targetH}px`;
        wrapper.style.height = `${targetH}px`;
    };
}

export function createNoteEditorUpdater(controller, {
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
}) {
    const minNoteEditorWidthPx = 20;
    const minNoteEditorHeightPx = Math.max(1, computeLineHeightPx(effectiveFontPx));

    return () => {
        try {
            const posDataNow = { objectId, position: null };
            const sizeDataNow = { objectId, size: null };
            controller.eventBus.emit(Events.Tool.GetObjectPosition, posDataNow);
            controller.eventBus.emit(Events.Tool.GetObjectSize, sizeDataNow);
            const posNow = posDataNow.position || position;
            const sizeNow = sizeDataNow.size || { width: noteWidth, height: noteHeight };
            const screenNow = toScreen(posNow.x, posNow.y);
            const viewRes = (controller.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
            const worldLayerRef = controller.textEditor.world || (controller.app?.stage);
            const scaleX = worldLayerRef?.scale?.x || 1;
            const scaleCss = scaleX / viewRes;
            const maxWpx = Math.max(1, Math.round((sizeNow.width - (horizontalPadding * 2)) * scaleCss));
            const maxHpx = Math.max(1, Math.round((sizeNow.height - (horizontalPadding * 2)) * scaleCss));

            textarea.style.width = 'auto';
            textarea.style.height = 'auto';
            const naturalW = Math.ceil(textarea.scrollWidth + 1);
            const naturalH = Math.ceil(textarea.scrollHeight);
            const widthPx = Math.min(maxWpx, Math.max(minNoteEditorWidthPx, naturalW));
            const heightPx = Math.min(maxHpx, Math.max(minNoteEditorHeightPx, naturalH));

            textarea.style.width = `${widthPx}px`;
            wrapper.style.width = `${widthPx}px`;
            textarea.style.height = `${heightPx}px`;
            wrapper.style.height = `${heightPx}px`;

            const left = Math.round(screenNow.x + (sizeNow.width * scaleCss) / 2 - (widthPx / 2));
            const top = Math.round(screenNow.y + (sizeNow.height * scaleCss) / 2 - (heightPx / 2));
            wrapper.style.left = `${left}px`;
            wrapper.style.top = `${top}px`;
            textarea.style.width = `${widthPx}px`;
            textarea.style.height = `${heightPx}px`;
        } catch (_) {}
    };
}

export function registerNoteEditorSync(controller, { objectId, updateNoteEditor }) {
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
    controller.textEditor._listeners = listeners;
    return listeners;
}
