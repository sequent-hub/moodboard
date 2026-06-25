import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import { toScreenWithContainerOffset } from './InlineEditorPositioningService.js';

export function createTextEditorToScreen(controller, view) {
    return (wx, wy) => toScreenWithContainerOffset(
        controller.textEditor.world || (controller.app?.stage),
        view,
        wx,
        wy
    );
}

export function positionRegularTextEditor({
    create,
    objectId,
    screenPos,
    textarea,
    wrapper,
}) {
    let padTop = 0;
    let padLeft = 0;
    let lineHeightPx = 0;
    try {
        if (typeof window !== 'undefined' && window.getComputedStyle) {
            const cs = window.getComputedStyle(textarea);
            const pt = parseFloat(cs.paddingTop);
            const pl = parseFloat(cs.paddingLeft);
            const lh = parseFloat(cs.lineHeight);
            if (isFinite(pt)) padTop = pt;
            if (isFinite(pl)) padLeft = pl;
            if (isFinite(lh)) lineHeightPx = lh;
        }
    } catch (_) {}

    if (!isFinite(lineHeightPx) || lineHeightPx <= 0) {
        try {
            const rect = textarea.getBoundingClientRect && textarea.getBoundingClientRect();
            if (rect && isFinite(rect.height)) lineHeightPx = rect.height;
        } catch (_) {}
    }

    let baseLeftPx = screenPos.x;
    let baseTopPx = screenPos.y;
    // Computed padding-top of the static .mb-text element (e.g. 0.3em for list/markdown types).
    // The static element top edge ≠ text glyph top: glyphs start paddingTop pixels lower.
    // The editor wrapper must be shifted down by the same amount so text doesn't jump.
    let staticPadTop = 0;
    let baseWidthPx = null;
    let baseHeightPx = null;
    try {
        if (!create && objectId && typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
            const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
            if (el) {
                const cssLeft = parseFloat(el.style.left || 'NaN');
                const cssTop = parseFloat(el.style.top || 'NaN');
                if (isFinite(cssLeft)) baseLeftPx = cssLeft;
                if (isFinite(cssTop)) baseTopPx = cssTop;
                const rect = el.getBoundingClientRect?.();
                if (rect && isFinite(rect.width) && rect.width > 0) baseWidthPx = rect.width;
                if (rect && isFinite(rect.height) && rect.height > 0) baseHeightPx = rect.height;
                if (typeof window.getComputedStyle === 'function') {
                    try {
                        const cs = window.getComputedStyle(el);
                        const pt = parseFloat(cs.paddingTop);
                        if (isFinite(pt) && pt > 0) staticPadTop = pt;
                    } catch (_) {}
                }
            }
        }
    } catch (_) {}

    const leftPx = Math.round(baseLeftPx - padLeft);
    // Верх текста редактора привязываем к точке клика (= верх рамки ручек и будущего
    // статического текста). Прежний create-якорь `- lineHeightPx/2` (центрирование каретки
    // по клику) поднимал текст на пол-строки выше рамки mb-handles-box-obj_.
    const topPx = Math.round(baseTopPx + staticPadTop - padTop + 1);

    wrapper.style.left = `${leftPx}px`;
    wrapper.style.top = `${topPx}px`;

    return {
        leftPx,
        topPx,
        padTop,
        padLeft,
        lineHeightPx,
        baseLeftPx,
        baseTopPx,
        baseWidthPx,
        baseHeightPx,
    };
}

export function syncCreatedTextEditorWorldPosition({
    controller,
    create,
    objectId,
    position,
    leftPx,
    topPx,
    padTop,
}) {
    try {
        if (create && objectId) {
            const worldLayerRef = controller.textEditor.world || (controller.app?.stage);
            const viewEl = controller.app?.view;
            if (worldLayerRef && viewEl && viewEl.parentElement) {
                const containerRect = viewEl.parentElement.getBoundingClientRect();
                const viewRect = viewEl.getBoundingClientRect();
                const offsetLeft = viewRect.left - containerRect.left;
                const offsetTop = viewRect.top - containerRect.top;

                const yCssStaticTop = Math.round(topPx + padTop);
                const screenX = Math.round(leftPx - offsetLeft);
                const screenY = Math.round(yCssStaticTop - offsetTop);
                const globalPoint = new PIXI.Point(screenX, screenY);
                const worldPoint = worldLayerRef.toLocal
                    ? worldLayerRef.toLocal(globalPoint)
                    : { x: position.x, y: position.y };
                const newWorldPos = {
                    x: Math.round(worldPoint.x),
                    y: Math.round(worldPoint.y),
                };

                controller.eventBus.emit(Events.Object.StateChanged, {
                    objectId,
                    updates: { position: newWorldPos },
                });

                console.log('🧭 Text position sync', {
                    objectId,
                    newWorldPos,
                    leftPx,
                    topPx,
                    yCssStaticTop,
                    padTop,
                    offsetLeft,
                    offsetTop,
                });
            }
        }
    } catch (_) {}
}

export function alignStaticTextToEditorCssPosition({
    controller,
    objectId,
    worldLayerRef,
    view,
    cssLeft,
    cssTop,
}) {
    try {
        if (view && view.parentElement && isFinite(cssLeft) && isFinite(cssTop) && worldLayerRef) {
            setTimeout(() => {
                try {
                    const containerRect = view.parentElement.getBoundingClientRect();
                    const viewRect = view.getBoundingClientRect();
                    const offsetLeft = viewRect.left - containerRect.left;
                    const offsetTop = viewRect.top - containerRect.top;
                    const screenX = cssLeft - offsetLeft;
                    const screenY = cssTop - offsetTop;
                    const desiredWorld = worldLayerRef.toLocal(new PIXI.Point(screenX, screenY));
                    const newPos = { x: Math.round(desiredWorld.x), y: Math.round(desiredWorld.y) };

                    controller.eventBus.emit(Events.Object.StateChanged, {
                        objectId,
                        updates: { position: newPos },
                    });

                    console.log('🧭 Text post-show align', { objectId, cssLeft, cssTop, newPos });
                } catch (_) {}
            }, 0);
        }
    } catch (_) {}
}
