import { Events } from '../../core/events/Events.js';
import { createRotatedResizeCursor } from '../../tools/object-tools/selection/CursorController.js';
import { createChildMindmapIntentMetadata, logMindmapCompoundDebug } from '../../mindmap/MindmapCompoundContract.js';
import { MINDMAP_LAYOUT } from '../mindmap/MindmapLayoutConfig.js';

const HANDLES_ACCENT_COLOR = '#80D8FF';
const REVIT_SHOW_IN_MODEL_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true" focusable="false"><path d="M384 64C366.3 64 352 78.3 352 96C352 113.7 366.3 128 384 128L466.7 128L265.3 329.4C252.8 341.9 252.8 362.2 265.3 374.7C277.8 387.2 298.1 387.2 310.6 374.7L512 173.3L512 256C512 273.7 526.3 288 544 288C561.7 288 576 273.7 576 256L576 96C576 78.3 561.7 64 544 64L384 64zM144 160C99.8 160 64 195.8 64 240L64 496C64 540.2 99.8 576 144 576L400 576C444.2 576 480 540.2 480 496L480 416C480 398.3 465.7 384 448 384C430.3 384 416 398.3 416 416L416 496C416 504.8 408.8 512 400 512L144 512C135.2 512 128 504.8 128 496L128 240C128 231.2 135.2 224 144 224L224 224C241.7 224 256 209.7 256 192C256 174.3 241.7 160 224 160L144 160z"/></svg>';
const MINDMAP_CHILD_WIDTH_FACTOR = 0.9;
const MINDMAP_CHILD_HEIGHT_FACTOR = 0.8;
const MINDMAP_CHILD_PADDING_FACTOR = 0.5;
const MINDMAP_CHILD_STROKE_COLOR = 0x16A34A;
const MINDMAP_CHILD_FILL_COLOR = 0x16A34A;
const MINDMAP_CHILD_FILL_ALPHA = 0.25;
const MINDMAP_CHILD_GAP_MULTIPLIER = 10;
const MINDMAP_CHILD_VERTICAL_GAP_MULTIPLIER = 2;

function resolveBottomSiblingParentId(sourceObjectId, sourceMeta) {
    if (typeof sourceMeta?.parentId === 'string' && sourceMeta.parentId.length > 0) {
        return sourceMeta.parentId;
    }
    if (typeof sourceMeta?.branchRootId === 'string' && sourceMeta.branchRootId.length > 0) {
        return sourceMeta.branchRootId;
    }
    if (typeof sourceObjectId === 'string' && sourceObjectId.length > 0) {
        return sourceObjectId;
    }
    return sourceMeta?.parentId || null;
}

function relayoutMindmapBranchLevel({ core, eventBus, parentId, side }) {
    if (!core || !eventBus || !parentId || (side !== 'left' && side !== 'right')) return;
    const objects = core?.state?.state?.objects || [];
    const mindmaps = Array.isArray(objects) ? objects.filter((obj) => obj?.type === 'mindmap') : [];
    const byId = new Map(mindmaps.map((obj) => [obj.id, obj]));
    const parent = byId.get(parentId);
    if (!parent) return;

    const getBranchOrder = (obj) => {
        const raw = obj?.properties?.mindmap?.branchOrder;
        return Number.isFinite(raw) ? Number(raw) : null;
    };
    const siblings = mindmaps
        .filter((obj) => {
            const meta = obj?.properties?.mindmap || {};
            return meta?.role === 'child' && meta?.parentId === parentId && meta?.side === side;
        })
        .sort((a, b) => {
            const ao = getBranchOrder(a);
            const bo = getBranchOrder(b);
            if (ao !== null && bo !== null && ao !== bo) return ao - bo;
            if (ao !== null && bo === null) return -1;
            if (ao === null && bo !== null) return 1;
            const ay = a?.position?.y || 0;
            const by = b?.position?.y || 0;
            if (ay !== by) return ay - by;
            return String(a?.id || '').localeCompare(String(b?.id || ''));
        });
    if (siblings.length === 0) return;

    const app = core?.pixi?.app;
    const worldLayer = core?.pixi?.worldLayer || app?.stage;
    const rendererRes = app?.renderer?.resolution || 1;
    const worldScale = worldLayer?.scale?.x || 1;
    const baseGapWorld = Math.max(1, Math.round((10 * rendererRes) / worldScale));
    const gapWorld = Math.max(1, Math.round(baseGapWorld * MINDMAP_CHILD_GAP_MULTIPLIER));
    const verticalGapWorld = Math.max(1, Math.round(baseGapWorld * MINDMAP_CHILD_VERTICAL_GAP_MULTIPLIER));

    const byParentBySide = new Map();
    const childrenByParent = new Map();
    mindmaps.forEach((obj) => {
        const meta = obj?.properties?.mindmap || {};
        if (meta?.role !== 'child') return;
        const key = `${meta.parentId || ''}::${meta.side || ''}`;
        if (!byParentBySide.has(key)) byParentBySide.set(key, []);
        byParentBySide.get(key).push(obj.id);
        if (!childrenByParent.has(meta.parentId)) childrenByParent.set(meta.parentId, []);
        childrenByParent.get(meta.parentId).push(obj.id);
    });

    const subtreeSpanCache = new Map();
    const getNodeHeight = (node) => Math.max(1, Math.round(node?.height || node?.properties?.height || 1));
    const getGroupSpan = (ownerId, branchSide, visiting) => {
        const key = `${ownerId}::${branchSide}`;
        const children = byParentBySide.get(key) || [];
        if (!children.length) return 0;
        let total = 0;
        children.forEach((childId, index) => {
            const childNode = byId.get(childId);
            if (!childNode) return;
            total += getSubtreeSpan(childNode, visiting);
            if (index > 0) total += verticalGapWorld;
        });
        return Math.max(0, Math.round(total));
    };
    const getSubtreeSpan = (node, visiting = new Set()) => {
        if (!node?.id) return 1;
        if (subtreeSpanCache.has(node.id)) return subtreeSpanCache.get(node.id);
        if (visiting.has(node.id)) return getNodeHeight(node);
        visiting.add(node.id);
        const ownHeight = getNodeHeight(node);
        const leftSpan = getGroupSpan(node.id, 'left', visiting);
        const rightSpan = getGroupSpan(node.id, 'right', visiting);
        const span = Math.max(ownHeight, leftSpan, rightSpan);
        subtreeSpanCache.set(node.id, span);
        visiting.delete(node.id);
        return span;
    };

    const parentX = Math.round(parent?.position?.x || 0);
    const parentWidth = Math.max(1, Math.round(parent?.width || parent?.properties?.width || 1));
    const anchorLeftX = side === 'right'
        ? Math.round(parentX + parentWidth + gapWorld)
        : null;
    const anchorRightX = side === 'left'
        ? Math.round(parentX - gapWorld)
        : null;

    const siblingHeights = siblings.map((node) => getNodeHeight(node));
    const siblingSpans = siblings.map((node) => getSubtreeSpan(node));
    const avgHeight = Math.max(
        1,
        Math.round(
            siblingHeights.reduce((acc, h) => acc + h, 0) / siblings.length
        )
    );
    const verticalStep = Math.max(1, avgHeight + verticalGapWorld);
    const parentHeight = Math.max(1, Math.round(parent?.height || parent?.properties?.height || 1));
    const parentCenterY = Math.round(parent?.position?.y || 0) + Math.round(parentHeight / 2);
    const totalStackHeight = siblingSpans.reduce((acc, h) => acc + h, 0)
        + Math.max(0, siblings.length - 1) * verticalGapWorld;
    const startY = Math.round(parentCenterY - totalStackHeight / 2);
    logMindmapCompoundDebug('layout:branch-level-start', {
        parentId,
        side,
        siblings: siblings.map((node, index) => ({
            id: node?.id || null,
            index,
            y: Math.round(node?.position?.y || 0),
            height: siblingHeights[index] || null,
            span: siblingSpans[index] || null,
        })),
        parentCenterY,
        totalStackHeight,
        verticalGapWorld,
    });
    const movedPositions = new Map();
    const getCurrentPos = (nodeId) => {
        if (movedPositions.has(nodeId)) return movedPositions.get(nodeId);
        const node = byId.get(nodeId);
        return {
            x: Math.round(node?.position?.x || 0),
            y: Math.round(node?.position?.y || 0),
        };
    };
    const getDescendants = (rootId) => {
        const result = [];
        const queue = [...(childrenByParent.get(rootId) || [])];
        const seen = new Set();
        while (queue.length > 0) {
            const nextId = queue.shift();
            if (!nextId || seen.has(nextId)) continue;
            seen.add(nextId);
            result.push(nextId);
            const nested = childrenByParent.get(nextId) || [];
            nested.forEach((nestedId) => {
                if (!seen.has(nestedId)) queue.push(nestedId);
            });
        }
        return result;
    };

    let movedCount = 0;
    let cursorY = startY;
    siblings.forEach((node, index) => {
        const currentPos = getCurrentPos(node.id);
        const currentX = currentPos.x;
        const currentY = currentPos.y;
        const nodeWidth = Math.max(1, Math.round(node?.width || node?.properties?.width || 1));
        const nodeHeight = siblingHeights[index] || Math.max(1, Math.round(node?.height || node?.properties?.height || 1));
        const nodeSpan = siblingSpans[index] || nodeHeight;
        const targetX = side === 'right'
            ? anchorLeftX
            : Math.round((anchorRightX || 0) - nodeWidth);
        const targetY = Math.round(cursorY + Math.max(0, nodeSpan - nodeHeight) / 2);
        logMindmapCompoundDebug('layout:branch-level-node-target', {
            parentId,
            side,
            nodeId: node?.id || null,
            index,
            currentX,
            currentY,
            targetX,
            targetY,
            nodeHeight,
            nodeSpan,
        });

        if (!(targetX === currentX && targetY === currentY)) {
            core.updateObjectPositionDirect(node.id, { x: targetX, y: targetY }, { snap: false });
            eventBus.emit(Events.Object.TransformUpdated, { objectId: node.id });
            eventBus.emit(Events.Tool.DragUpdate, { object: node.id });
            movedPositions.set(node.id, { x: targetX, y: targetY });

            const dx = Math.round(targetX - currentX);
            const dy = Math.round(targetY - currentY);
            if (dx !== 0 || dy !== 0) {
                const descendants = getDescendants(node.id);
                logMindmapCompoundDebug('layout:branch-level-node-shift', {
                    parentId,
                    side,
                    nodeId: node?.id || null,
                    index,
                    dx,
                    dy,
                    descendantsCount: descendants.length,
                });
                descendants.forEach((descId) => {
                    const pos = getCurrentPos(descId);
                    const nextPos = {
                        x: Math.round(pos.x + dx),
                        y: Math.round(pos.y + dy),
                    };
                    core.updateObjectPositionDirect(descId, nextPos, { snap: false });
                    eventBus.emit(Events.Object.TransformUpdated, { objectId: descId });
                    eventBus.emit(Events.Tool.DragUpdate, { object: descId });
                    movedPositions.set(descId, nextPos);
                });
            }
            movedCount += 1;
        }
        cursorY += nodeSpan + verticalGapWorld;
    });

    logMindmapCompoundDebug('layout:branch-level-align', {
        parentId,
        side,
        siblingsCount: siblings.length,
        movedCount,
        verticalStep,
        parentCenterY,
        totalStackHeight,
    });
}

function relayoutMindmapBranchCascade({ core, eventBus, startParentId, startSide }) {
    if (!core || !eventBus || !startParentId || (startSide !== 'left' && startSide !== 'right')) return;
    const objects = core?.state?.state?.objects || [];
    const mindmaps = Array.isArray(objects) ? objects.filter((obj) => obj?.type === 'mindmap') : [];
    const byId = new Map(mindmaps.map((obj) => [obj.id, obj]));

    let parentId = startParentId;
    let side = startSide;
    const visited = new Set();

    while (parentId && !visited.has(`${parentId}:${side}`)) {
        visited.add(`${parentId}:${side}`);
        relayoutMindmapBranchLevel({ core, eventBus, parentId, side });
        const parentNode = byId.get(parentId);
        const parentMeta = parentNode?.properties?.mindmap || {};
        if (parentMeta?.role !== 'child') break;
        parentId = parentMeta.parentId || null;
        side = (parentMeta.side === 'left' || parentMeta.side === 'right') ? parentMeta.side : side;
    }
}

export class HandlesDomRenderer {
    constructor(host, rotateIconSvg) {
        this.host = host;
        this.rotateIconSvg = rotateIconSvg;
    }

    captureMindmapSnapshot() {
        const objects = this.host.core?.state?.state?.objects || [];
        const snapshot = {};
        (Array.isArray(objects) ? objects : []).forEach((obj) => {
            if (!obj || obj.type !== 'mindmap' || !obj.id) return;
            snapshot[obj.id] = {
                x: Math.round(obj?.position?.x || 0),
                y: Math.round(obj?.position?.y || 0),
            };
        });
        return snapshot;
    }

    enforceMindmapAutoLayoutAfterDragEnd({ draggedIds = [], snapshot = null } = {}) {
        const ids = Array.isArray(draggedIds) ? draggedIds.filter((id) => typeof id === 'string' && id.length > 0) : [];
        if (!ids.length) return;
        const core = this.host.core;
        const eventBus = this.host.eventBus;
        if (!core || !eventBus) return;

        const objects = core?.state?.state?.objects || [];
        const mindmaps = (Array.isArray(objects) ? objects : []).filter((obj) => obj?.type === 'mindmap');
        if (!mindmaps.length) return;
        const byId = new Map(mindmaps.map((obj) => [obj.id, obj]));
        const draggedMindmapIds = ids.filter((id) => byId.has(id));
        if (!draggedMindmapIds.length) return;

        const compoundToAllIds = new Map();
        const compoundOf = (obj) => {
            const c = obj?.properties?.mindmap?.compoundId;
            return (typeof c === 'string' && c.length > 0) ? c : obj?.id;
        };
        mindmaps.forEach((obj) => {
            const key = compoundOf(obj);
            if (!compoundToAllIds.has(key)) compoundToAllIds.set(key, new Set());
            compoundToAllIds.get(key).add(obj.id);
        });
        const touchedCompounds = new Set(draggedMindmapIds.map((id) => compoundOf(byId.get(id))));

        touchedCompounds.forEach((compoundId) => {
            const allIds = compoundToAllIds.get(compoundId) || new Set();
            const selectedIds = draggedMindmapIds.filter((id) => allIds.has(id));
            const isWholeTreeMove = selectedIds.length > 0 && selectedIds.length === allIds.size;
            if (isWholeTreeMove) return;

            allIds.forEach((nodeId) => {
                const snap = snapshot && snapshot[nodeId];
                if (!snap || !Number.isFinite(snap.x) || !Number.isFinite(snap.y)) return;
                const nextPos = { x: Math.round(snap.x), y: Math.round(snap.y) };
                core.updateObjectPositionDirect(nodeId, nextPos, { snap: false });
                eventBus.emit(Events.Object.TransformUpdated, { objectId: nodeId });
                eventBus.emit(Events.Tool.DragUpdate, { object: nodeId });
            });
            logMindmapCompoundDebug('layout:drag-end-restore-compound', {
                compoundId,
                selectedCount: selectedIds.length,
                totalCount: allIds.size,
            });
        });

        touchedCompounds.forEach((compoundId) => {
            const compoundNodes = mindmaps.filter((obj) => compoundOf(obj) === compoundId);
            const roots = compoundNodes.filter((obj) => {
                const meta = obj?.properties?.mindmap || {};
                if (meta?.role === 'root') return true;
                return !meta?.parentId;
            });
            roots.forEach((root) => {
                relayoutMindmapBranchCascade({
                    core,
                    eventBus,
                    startParentId: root.id,
                    startSide: 'left',
                });
                relayoutMindmapBranchCascade({
                    core,
                    eventBus,
                    startParentId: root.id,
                    startSide: 'right',
                });
            });
        });
    }

    setHandlesVisibility(show) {
        if (!this.host.layer) return;
        const box = this.host.layer.querySelector('.mb-handles-box');
        if (!box) return;

        const applyVisibility = (el) => {
            if (!el) return;
            const lockedHidden = el.dataset.lockedHidden === '1';
            el.style.display = show && !lockedHidden ? '' : 'none';
        };

        box.querySelectorAll('[data-dir]').forEach((el) => {
            applyVisibility(el);
        });
        box.querySelectorAll('[data-edge]').forEach((el) => {
            applyVisibility(el);
        });

        const rot = box.querySelector('[data-handle="rotate"]');
        if (rot) applyVisibility(rot);
        this.host.layer.querySelectorAll('.mb-mindmap-side-btn').forEach((btn) => {
            btn.style.display = show ? '' : 'none';
        });
        if (show && !box.querySelector('[data-dir]')) {
            this.host.update();
        }
    }

    showBounds(worldBounds, id, options = {}) {
        if (!this.host.layer) return;

        const cssRect = this.host.positioningService.worldBoundsToCssRect(worldBounds);

        let isFileTarget = false;
        let isFrameTarget = false;
        let isMindmapTarget = false;
        let isMindmapOnlyGroupTarget = false;
        let isRevitScreenshotTarget = false;
        let revitViewPayload = null;
        let sourceMindmapProperties = null;
        const occupiedOutgoingSides = new Set();
        const hiddenIncomingSide = { value: null };
        if (id !== '__group__') {
            const req = { objectId: id, pixiObject: null };
            this.host.eventBus.emit(Events.Tool.GetObjectPixi, req);
            const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
            isFileTarget = mbType === 'file';
            isFrameTarget = mbType === 'frame';
            isMindmapTarget = mbType === 'mindmap';
            isRevitScreenshotTarget = mbType === 'revit-screenshot-img';
            revitViewPayload = req.pixiObject?._mb?.properties?.view || null;
            if (isMindmapTarget) {
                sourceMindmapProperties = req.pixiObject?._mb?.properties || null;
                const allObjects = this.host.core?.state?.state?.objects || [];
                allObjects.forEach((obj) => {
                    if (!obj || obj.type !== 'mindmap') return;
                    const meta = obj.properties?.mindmap || {};
                    const isOutgoingFromCurrent = meta?.role === 'child'
                        && typeof meta?.side === 'string'
                        && meta?.parentId === id;
                    if (isOutgoingFromCurrent) {
                        occupiedOutgoingSides.add(meta.side);
                    }
                });
                const incoming = sourceMindmapProperties?.mindmap?.side || null;
                if (incoming === 'left') hiddenIncomingSide.value = 'right';
                else if (incoming === 'right') hiddenIncomingSide.value = 'left';
            }
        } else {
            const selectionIds = Array.isArray(options.selectionIds) ? options.selectionIds : [];
            if (selectionIds.length > 0) {
                const byId = new Map((this.host.core?.state?.state?.objects || []).map((obj) => [obj?.id, obj]));
                isMindmapOnlyGroupTarget = selectionIds.every((selectedId) => byId.get(selectedId)?.type === 'mindmap');
            }
        }
        const isNonResizableTarget = isFileTarget || isMindmapTarget || isMindmapOnlyGroupTarget;

        const left = Math.round(cssRect.left);
        const top = Math.round(cssRect.top);
        const width = Math.max(1, Math.round(cssRect.width));
        const height = Math.max(1, Math.round(cssRect.height));

        this.host.layer.innerHTML = '';
        const box = document.createElement('div');
        box.className = 'mb-handles-box';

        let rotation = options.rotation ?? 0;
        if (id !== '__group__') {
            const rotationData = { objectId: id, rotation: 0 };
            this.host.eventBus.emit(Events.Tool.GetObjectRotation, rotationData);
            rotation = rotationData.rotation || 0;
        }

        Object.assign(box.style, {
            position: 'absolute', left: `${left}px`, top: `${top}px`,
            width: `${width}px`, height: `${height}px`,
            outline: `2px solid ${HANDLES_ACCENT_COLOR}`, outlineOffset: '0', borderRadius: '3px', boxSizing: 'border-box', pointerEvents: 'none',
            transformOrigin: 'center center',
            transform: `rotate(${rotation}deg)`,
        });
        this.host.layer.appendChild(box);
        if (this.host._handlesSuppressed) {
            this.host.visible = true;
            return;
        }

        const mkCorner = (dir, x, y) => {
            const cursor = createRotatedResizeCursor(dir, rotation);
            const h = document.createElement('div');
            h.dataset.dir = dir;
            h.dataset.id = id;
            h.className = 'mb-handle';
            h.style.pointerEvents = isNonResizableTarget ? 'none' : 'auto';
            h.style.cursor = cursor;
            h.style.left = `${x - 6}px`;
            h.style.top = `${y - 6}px`;
            h.style.display = isNonResizableTarget ? 'none' : 'block';
            if (isNonResizableTarget) h.dataset.lockedHidden = '1';

            const inner = document.createElement('div');
            inner.className = 'mb-handle-inner';
            h.appendChild(inner);

            h.addEventListener('mouseenter', () => {
                h.style.background = HANDLES_ACCENT_COLOR;
                h.style.borderColor = HANDLES_ACCENT_COLOR;
                h.style.cursor = cursor;
            });
            h.addEventListener('mouseleave', () => {
                h.style.background = HANDLES_ACCENT_COLOR;
                h.style.borderColor = HANDLES_ACCENT_COLOR;
            });

            if (!isNonResizableTarget) {
                h.addEventListener('mousedown', (e) => this.host._onHandleDown(e, box));
            }

            box.appendChild(h);
        };

        const x0 = 0;
        const y0 = 0;
        const x1 = width;
        const y1 = height;
        mkCorner('nw', x0, y0);
        mkCorner('ne', x1, y0);
        mkCorner('se', x1, y1);
        mkCorner('sw', x0, y1);

        const edgeSize = 10;
        const makeEdge = (name, style, cursorHandleType) => {
            const cursor = createRotatedResizeCursor(cursorHandleType, rotation);
            const e = document.createElement('div');
            e.dataset.edge = name;
            e.dataset.id = id;
            e.className = 'mb-edge';
            Object.assign(e.style, style, {
                pointerEvents: isNonResizableTarget ? 'none' : 'auto',
                cursor,
                display: isNonResizableTarget ? 'none' : 'block',
            });
            if (isNonResizableTarget) e.dataset.lockedHidden = '1';
            if (!isNonResizableTarget) {
                e.addEventListener('mousedown', (evt) => this.host._onEdgeResizeDown(evt));
            }
            box.appendChild(e);
        };

        const cornerGap = 20;
        makeEdge('top', {
            left: `${cornerGap}px`,
            top: `-${edgeSize / 2}px`,
            width: `${Math.max(0, width - 2 * cornerGap)}px`,
            height: `${edgeSize}px`,
        }, 'n');

        makeEdge('bottom', {
            left: `${cornerGap}px`,
            top: `${height - edgeSize / 2}px`,
            width: `${Math.max(0, width - 2 * cornerGap)}px`,
            height: `${edgeSize}px`,
        }, 's');

        makeEdge('left', {
            left: `-${edgeSize / 2}px`,
            top: `${cornerGap}px`,
            width: `${edgeSize}px`,
            height: `${Math.max(0, height - 2 * cornerGap)}px`,
        }, 'w');

        makeEdge('right', {
            left: `${width - edgeSize / 2}px`,
            top: `${cornerGap}px`,
            width: `${edgeSize}px`,
            height: `${Math.max(0, height - 2 * cornerGap)}px`,
        }, 'e');

        const rotateHandle = document.createElement('div');
        rotateHandle.dataset.handle = 'rotate';
        rotateHandle.dataset.id = id;
        if (isFileTarget || isFrameTarget || isMindmapTarget || isMindmapOnlyGroupTarget) {
            rotateHandle.dataset.lockedHidden = '1';
            Object.assign(rotateHandle.style, { display: 'none', pointerEvents: 'none' });
        } else {
            rotateHandle.className = 'mb-rotate-handle';
            const d = 38;
            const L = Math.max(1, Math.hypot(width, height));
            const centerX = -(width / L) * d;
            const centerY = height + (height / L) * d;
            rotateHandle.style.left = `${Math.round(centerX)}px`;
            rotateHandle.style.top = `${Math.round(centerY - 10)}px`;
            rotateHandle.innerHTML = this.rotateIconSvg;
            const svgEl = rotateHandle.querySelector('svg');
            if (svgEl) {
                svgEl.style.width = '100%';
                svgEl.style.height = '100%';
                svgEl.style.display = 'block';
            }
            rotateHandle.addEventListener('mousedown', (e) => this.host._onRotateHandleDown(e, box));
        }
        box.appendChild(rotateHandle);

        if (isMindmapTarget) {
            const emitChildMindmapFromSource = (direction) => {
                const app = this.host.core?.pixi?.app;
                const worldLayer = this.host.core?.pixi?.worldLayer || app?.stage;
                const rendererRes = app?.renderer?.resolution || 1;
                const worldScale = worldLayer?.scale?.x || 1;
                const baseGapWorld = Math.max(1, Math.round((10 * rendererRes) / worldScale));
                const gapWorld = Math.max(1, Math.round(baseGapWorld * MINDMAP_CHILD_GAP_MULTIPLIER));
                const childWidth = Math.max(1, Math.round(MINDMAP_LAYOUT.width * MINDMAP_CHILD_WIDTH_FACTOR));
                const childHeight = Math.max(1, Math.round(MINDMAP_LAYOUT.height * MINDMAP_CHILD_HEIGHT_FACTOR));
                const childPaddingX = Math.max(1, Math.round(MINDMAP_LAYOUT.paddingX * MINDMAP_CHILD_PADDING_FACTOR));
                const childPaddingY = Math.max(1, Math.round(MINDMAP_LAYOUT.paddingY * MINDMAP_CHILD_PADDING_FACTOR));
                const sourceMeta = sourceMindmapProperties?.mindmap || {};
                const isBottomSiblingClone = direction === 'bottom' && sourceMeta?.role === 'child';
                const metaParentId = isBottomSiblingClone
                    ? resolveBottomSiblingParentId(id, sourceMeta)
                    : id;
                const metaSide = isBottomSiblingClone
                    ? (sourceMeta?.side || 'right')
                    : direction;
                const normalizeBranchOrderForBottomInsert = () => {
                    if (!isBottomSiblingClone || !metaParentId || !metaSide) {
                        return { sourceIndex: -1, siblings: [] };
                    }
                    const objects = this.host.core?.state?.state?.objects || [];
                    const siblings = (Array.isArray(objects) ? objects : [])
                        .filter((obj) => {
                            if (!obj || obj.type !== 'mindmap') return false;
                            const meta = obj.properties?.mindmap || {};
                            return meta?.role === 'child' && meta?.parentId === metaParentId && meta?.side === metaSide;
                        })
                        .sort((a, b) => (a?.position?.y || 0) - (b?.position?.y || 0));
                    siblings.forEach((obj, index) => {
                        if (!obj.properties) obj.properties = {};
                        const meta = obj.properties.mindmap || {};
                        if (!Number.isFinite(meta.branchOrder) || Number(meta.branchOrder) !== index) {
                            obj.properties.mindmap = {
                                ...meta,
                                branchOrder: index,
                            };
                        }
                    });
                    const sourceIndex = siblings.findIndex((obj) => obj?.id === id);
                    if (sourceIndex >= 0) {
                        for (let idx = sourceIndex + 1; idx < siblings.length; idx += 1) {
                            const node = siblings[idx];
                            if (!node?.properties) continue;
                            const meta = node.properties.mindmap || {};
                            const nextOrder = idx + 1;
                            if (!Number.isFinite(meta.branchOrder) || Number(meta.branchOrder) !== nextOrder) {
                                node.properties.mindmap = {
                                    ...meta,
                                    branchOrder: nextOrder,
                                };
                            }
                        }
                    }
                    this.host.core?.state?.markDirty?.();
                    return { sourceIndex, siblings };
                };
                const bottomInsertData = normalizeBranchOrderForBottomInsert();
                const resolveBottomInsertY = () => {
                    if (!isBottomSiblingClone || !metaParentId || !metaSide) {
                        return Math.round(worldBounds.y + worldBounds.height + gapWorld);
                    }
                    const siblings = bottomInsertData.siblings;
                    const sourceIndex = bottomInsertData.sourceIndex;
                    if (sourceIndex < 0) {
                        return Math.round(worldBounds.y + worldBounds.height + gapWorld);
                    }
                    const sourceY = Math.round(siblings[sourceIndex]?.position?.y || worldBounds.y);
                    const nextSibling = siblings[sourceIndex + 1] || null;
                    if (!nextSibling) {
                        return Math.round(sourceY + Math.max(1, childHeight + 1));
                    }
                    const nextY = Math.round(nextSibling?.position?.y || sourceY + childHeight + 1);
                    if (nextY <= sourceY) return Math.round(sourceY + 1);
                    const midY = Math.round((sourceY + nextY) / 2);
                    if (midY <= sourceY) return Math.round(sourceY + 1);
                    if (midY >= nextY) return Math.round(nextY - 1);
                    return midY;
                };
                const nextPosition = direction === 'left'
                    ? { x: Math.round(worldBounds.x - childWidth - gapWorld), y: Math.round(worldBounds.y) }
                    : direction === 'right'
                        ? { x: Math.round(worldBounds.x + worldBounds.width + gapWorld), y: Math.round(worldBounds.y) }
                        : { x: Math.round(worldBounds.x), y: resolveBottomInsertY() };
                if (isBottomSiblingClone) {
                    logMindmapCompoundDebug('handles:bottom-branch-parent-resolve', {
                        sourceId: id,
                        sourceParentId: sourceMeta?.parentId || null,
                        sourceBranchRootId: sourceMeta?.branchRootId || null,
                        resolvedParentId: metaParentId || null,
                        resolvedSide: metaSide || null,
                    });
                }
                logMindmapCompoundDebug('handles:child-create-intent', {
                    sourceId: id,
                    direction,
                    sourceRole: sourceMeta?.role || null,
                    sourceParentId: sourceMeta?.parentId || null,
                    sourceSide: sourceMeta?.side || null,
                    isBottomSiblingClone,
                    metaParentId: metaParentId || null,
                    metaSide: metaSide || null,
                    sourceBounds: {
                        x: Math.round(worldBounds.x || 0),
                        y: Math.round(worldBounds.y || 0),
                        width: Math.round(worldBounds.width || 0),
                        height: Math.round(worldBounds.height || 0),
                    },
                    nextPosition,
                });
                const childMindmapMeta = createChildMindmapIntentMetadata({
                    sourceObjectId: metaParentId,
                    sourceProperties: sourceMindmapProperties || {},
                    side: metaSide,
                });
                if (isBottomSiblingClone && metaParentId) {
                    childMindmapMeta.branchRootId = metaParentId;
                    if (bottomInsertData.sourceIndex >= 0) {
                        childMindmapMeta.branchOrder = bottomInsertData.sourceIndex + 1;
                    }
                }
                this.host.eventBus.emit(Events.UI.ToolbarAction, {
                    type: 'mindmap',
                    id: 'mindmap',
                    position: nextPosition,
                    properties: {
                        ...(sourceMindmapProperties || {}),
                        mindmap: childMindmapMeta,
                        content: '',
                        width: childWidth,
                        height: childHeight,
                        capsuleBaseHeight: childHeight,
                        paddingX: childPaddingX,
                        paddingY: childPaddingY,
                        strokeColor: MINDMAP_CHILD_STROKE_COLOR,
                        fillColor: MINDMAP_CHILD_FILL_COLOR,
                        fillAlpha: MINDMAP_CHILD_FILL_ALPHA,
                    },
                });
                setTimeout(() => {
                    relayoutMindmapBranchCascade({
                        core: this.host.core,
                        eventBus: this.host.eventBus,
                        startParentId: metaParentId,
                        startSide: metaSide,
                    });
                }, 0);
                setTimeout(() => {
                    relayoutMindmapBranchCascade({
                        core: this.host.core,
                        eventBus: this.host.eventBus,
                        startParentId: metaParentId,
                        startSide: metaSide,
                    });
                }, 24);
            };
            const createMindmapSideButton = (side) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'mb-mindmap-side-btn';
                btn.dataset.side = side;
                btn.dataset.id = id;
                btn.textContent = '';
                btn.setAttribute('aria-label', 'Добавить узел mindmap');
                const centerY = top + Math.round(height / 2);
                const edgeGap = 10;
                const buttonRadius = 12;
                const centerOffset = edgeGap + buttonRadius;
                if (side === 'left') {
                    btn.style.left = `${Math.round(left - centerOffset)}px`;
                } else {
                    btn.style.left = `${Math.round(left + width + centerOffset)}px`;
                }
                btn.style.top = `${centerY}px`;
                btn.addEventListener('mousedown', (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                });
                btn.addEventListener('click', (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    emitChildMindmapFromSource(side);
                });
                return btn;
            };
            const createMindmapBottomButton = () => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'mb-mindmap-side-btn mb-mindmap-side-btn--down';
                btn.dataset.side = 'bottom';
                btn.dataset.id = id;
                btn.textContent = '';
                btn.setAttribute('aria-label', 'Добавить дочерний узел вниз');
                const centerX = left + Math.round(width / 2);
                const edgeGap = 10;
                const buttonRadius = 12;
                const centerOffset = edgeGap + buttonRadius;
                btn.style.left = `${centerX}px`;
                btn.style.top = `${Math.round(top + height + centerOffset)}px`;
                btn.addEventListener('mousedown', (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                });
                btn.addEventListener('click', (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    emitChildMindmapFromSource('bottom');
                });
                return btn;
            };
            const canShowLeft = !occupiedOutgoingSides.has('left') && hiddenIncomingSide.value !== 'left';
            const canShowRight = !occupiedOutgoingSides.has('right') && hiddenIncomingSide.value !== 'right';
            if (canShowLeft) this.host.layer.appendChild(createMindmapSideButton('left'));
            if (canShowRight) this.host.layer.appendChild(createMindmapSideButton('right'));
            const role = sourceMindmapProperties?.mindmap?.role || null;
            const canShowBottom = !occupiedOutgoingSides.has('bottom');
            if (role === 'child' && canShowBottom) {
                this.host.layer.appendChild(createMindmapBottomButton());
            }
        }

        if (isRevitScreenshotTarget && typeof revitViewPayload === 'string' && revitViewPayload.length > 0) {
            const showInModelButton = document.createElement('button');
            showInModelButton.type = 'button';
            showInModelButton.className = 'mb-revit-show-in-model';
            showInModelButton.innerHTML = `${REVIT_SHOW_IN_MODEL_ICON_SVG}<span>Показать в модели</span>`;
            showInModelButton.style.left = `${Math.round(left + width / 2)}px`;
            showInModelButton.style.top = `${Math.round(top - 34)}px`;
            showInModelButton.addEventListener('mousedown', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
            });
            showInModelButton.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                this.host.eventBus.emit(Events.UI.RevitShowInModel, {
                    objectId: id,
                    view: revitViewPayload
                });
            });
            this.host.layer.appendChild(showInModelButton);
        }

        this.host.visible = true;
        this.host.target = { type: id === '__group__' ? 'group' : 'single', id, bounds: worldBounds };
    }

    repositionBoxChildren(box) {
        const width = parseFloat(box.style.width);
        const height = parseFloat(box.style.height);
        const cx = width / 2;
        const cy = height / 2;

        box.querySelectorAll('[data-dir]').forEach((h) => {
            const dir = h.dataset.dir;
            switch (dir) {
                case 'nw':
                    h.style.left = `${-6}px`;
                    h.style.top = `${-6}px`;
                    break;
                case 'ne':
                    h.style.left = `${Math.max(-6, width - 6)}px`;
                    h.style.top = `${-6}px`;
                    break;
                case 'se':
                    h.style.left = `${Math.max(-6, width - 6)}px`;
                    h.style.top = `${Math.max(-6, height - 6)}px`;
                    break;
                case 'sw':
                    h.style.left = `${-6}px`;
                    h.style.top = `${Math.max(-6, height - 6)}px`;
                    break;
                case 'n':
                    h.style.left = `${cx - 6}px`;
                    h.style.top = `${-6}px`;
                    break;
                case 'e':
                    h.style.left = `${Math.max(-6, width - 6)}px`;
                    h.style.top = `${cy - 6}px`;
                    break;
                case 's':
                    h.style.left = `${cx - 6}px`;
                    h.style.top = `${Math.max(-6, height - 6)}px`;
                    break;
                case 'w':
                    h.style.left = `${-6}px`;
                    h.style.top = `${cy - 6}px`;
                    break;
            }
        });

        const edgeSize = 10;
        const cornerGap = 20;
        const top = box.querySelector('[data-edge="top"]');
        const bottom = box.querySelector('[data-edge="bottom"]');
        const left = box.querySelector('[data-edge="left"]');
        const right = box.querySelector('[data-edge="right"]');

        if (top) Object.assign(top.style, {
            left: `${cornerGap}px`,
            top: `-${edgeSize / 2}px`,
            width: `${Math.max(0, width - 2 * cornerGap)}px`,
            height: `${edgeSize}px`,
        });
        if (bottom) Object.assign(bottom.style, {
            left: `${cornerGap}px`,
            top: `${height - edgeSize / 2}px`,
            width: `${Math.max(0, width - 2 * cornerGap)}px`,
            height: `${edgeSize}px`,
        });
        if (left) Object.assign(left.style, {
            left: `-${edgeSize / 2}px`,
            top: `${cornerGap}px`,
            width: `${edgeSize}px`,
            height: `${Math.max(0, height - 2 * cornerGap)}px`,
        });
        if (right) Object.assign(right.style, {
            left: `${width - edgeSize / 2}px`,
            top: `${cornerGap}px`,
            width: `${edgeSize}px`,
            height: `${Math.max(0, height - 2 * cornerGap)}px`,
        });

        const rotateHandle = box.querySelector('[data-handle="rotate"]');
        if (rotateHandle) {
            const d = 20;
            const L = Math.max(1, Math.hypot(width, height));
            const centerX = -(width / L) * d;
            const centerY = height + (height / L) * d;
            rotateHandle.style.left = `${Math.round(centerX - 10)}px`;
            rotateHandle.style.top = `${Math.round(centerY - 10)}px`;
        }
    }
}
