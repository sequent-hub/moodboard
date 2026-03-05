import * as PIXI from 'pixi.js';

export function toScreenWithContainerOffset(worldLayer, view, wx, wy) {
    if (!worldLayer || !view || !view.parentElement) return { x: wx, y: wy };

    const containerRect = view.parentElement.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    const offsetLeft = viewRect.left - containerRect.left;
    const offsetTop = viewRect.top - containerRect.top;
    const global = worldLayer.toGlobal(new PIXI.Point(wx, wy));

    return {
        x: offsetLeft + global.x,
        y: offsetTop + global.y,
    };
}

export function toScreenWithResolution(worldLayer, app, wx, wy) {
    if (!worldLayer) return { x: wx, y: wy };

    const global = worldLayer.toGlobal(new PIXI.Point(wx, wy));
    const view = app?.view || document.querySelector('canvas');
    const viewRes = (app?.renderer?.resolution) || (view && view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
    return { x: global.x / viewRes, y: global.y / viewRes };
}
