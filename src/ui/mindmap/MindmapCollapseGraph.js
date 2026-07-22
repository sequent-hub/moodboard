/**
 * Чистые функции для работы с деревом майндмапа (collapse/expand).
 * Без PIXI, без побочных эффектов, без импортов UI.
 */

const MINDMAP_TYPE = 'mindmap';
const CHILD_ROLE = 'child';
const VALID_SIDES = new Set(['left', 'right', 'bottom']);

function isMindmapNode(obj) {
    return obj?.type === MINDMAP_TYPE;
}

function asMeta(obj) {
    return obj?.properties?.mindmap || {};
}

function asNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Резолв родителя — та же логика, что в MindmapConnectionLayer.resolveLegacyLink.
 * Возвращает parentId или null.
 */
function resolveParentId(child, byId, rootByCompoundId) {
    const meta = asMeta(child);
    const compoundId = meta.compoundId || null;
    let parentId = meta.parentId || null;
    const childId = child?.id || null;

    if (!parentId || parentId === childId) {
        parentId = asNonEmptyString(meta.branchRootId);
    }

    const parent = parentId ? byId.get(parentId) : null;
    if (!parent && compoundId) {
        const rootId = rootByCompoundId.get(compoundId) || null;
        if (rootId && rootId !== childId) parentId = rootId;
    }

    if (parentId === childId && compoundId) {
        const rootId = rootByCompoundId.get(compoundId) || null;
        if (rootId && rootId !== childId) parentId = rootId;
    }

    return parentId || null;
}

function buildIndexMaps(objects) {
    const arr = Array.isArray(objects) ? objects : [];
    const mindmaps = arr.filter(isMindmapNode);
    const byId = new Map(mindmaps.map((o) => [o.id, o]));
    const rootByCompoundId = new Map();
    mindmaps.forEach((o) => {
        const meta = asMeta(o);
        const cid = asNonEmptyString(meta.compoundId);
        if (meta.role === 'root' && cid) {
            rootByCompoundId.set(cid, o.id);
        }
    });
    return { byId, rootByCompoundId };
}

/**
 * Строит индекс parent → [children] для всех майндмап-нод.
 * @param {object[]} objects — массив всех объектов доски
 * @returns {Map<string, object[]>}
 */
export function buildChildrenIndex(objects) {
    const arr = Array.isArray(objects) ? objects : [];
    const { byId, rootByCompoundId } = buildIndexMaps(arr);

    const index = new Map();
    arr.filter(isMindmapNode).forEach((obj) => {
        const meta = asMeta(obj);
        if (meta.role !== CHILD_ROLE) return;
        const parentId = resolveParentId(obj, byId, rootByCompoundId);
        if (!parentId) return;
        if (!index.has(parentId)) index.set(parentId, []);
        index.get(parentId).push(obj);
    });

    return index;
}

/**
 * Возвращает id всех потомков nodeId (рекурсивно, все уровни).
 * @param {object[]} objects
 * @param {string} nodeId
 * @returns {string[]}
 */
export function getDescendantIds(objects, nodeId) {
    const childrenIndex = buildChildrenIndex(objects);
    const result = [];
    const queue = [nodeId];
    const visited = new Set();

    while (queue.length > 0) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        const children = childrenIndex.get(id) || [];
        for (const child of children) {
            result.push(child.id);
            queue.push(child.id);
        }
    }

    return result;
}

/**
 * Возвращает true, если у любого предка nodeId стоит collapsed === true.
 * @param {object[]} objects
 * @param {string} nodeId
 * @returns {boolean}
 */
export function isHiddenByCollapsedAncestor(objects, nodeId) {
    const { byId, rootByCompoundId } = buildIndexMaps(objects);
    const node = byId.get(nodeId);
    if (!node) return false;

    let currentId = resolveParentId(node, byId, rootByCompoundId);
    const visited = new Set();

    while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const ancestor = byId.get(currentId);
        if (!ancestor) break;
        if (asMeta(ancestor).collapsed === true) return true;
        currentId = resolveParentId(ancestor, byId, rootByCompoundId);
    }

    return false;
}

/**
 * Число всех потомков ноды — для отображения в бейдже.
 * @param {object[]} objects
 * @param {string} nodeId
 * @returns {number}
 */
export function countVisibleDescendantsForBadge(objects, nodeId) {
    return getDescendantIds(objects, nodeId).length;
}

/**
 * Возвращает стороны ('left'|'right'|'bottom'), по которым у ноды есть дети.
 * Используется для размещения кнопки collapse со стороны детей.
 * @param {object[]} objects
 * @param {string} nodeId
 * @returns {Set<string>}
 */
export function getChildrenSidesWithChildren(objects, nodeId) {
    const { byId, rootByCompoundId } = buildIndexMaps(objects);
    const sides = new Set();

    (Array.isArray(objects) ? objects : []).filter(isMindmapNode).forEach((obj) => {
        const meta = asMeta(obj);
        if (meta.role !== CHILD_ROLE) return;
        const parentId = resolveParentId(obj, byId, rootByCompoundId);
        if (parentId !== nodeId) return;
        if (VALID_SIDES.has(meta.side)) sides.add(meta.side);
    });

    return sides;
}

const CHILD_ATTACH_SIDE = { left: 'right', right: 'left', bottom: 'top' };

function nodeRect(node) {
    const x = Number.isFinite(node?.position?.x) ? node.position.x : 0;
    const y = Number.isFinite(node?.position?.y) ? node.position.y : 0;
    const rawW = Number.isFinite(node?.width) ? node.width : node?.properties?.width;
    const rawH = Number.isFinite(node?.height) ? node.height : node?.properties?.height;
    const w = Math.max(1, Math.round(Number.isFinite(rawW) ? rawW : 1));
    const h = Math.max(1, Math.round(Number.isFinite(rawH) ? rawH : 1));
    return { x, y, w, h };
}

function anchorPoint(rect, side) {
    if (side === 'right') return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
    if (side === 'left') return { x: rect.x, y: rect.y + rect.h / 2 };
    if (side === 'bottom') return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    return { x: rect.x + rect.w / 2, y: rect.y };
}

function bezierControls(start, end, side) {
    if (side === 'bottom') {
        const spanY = Math.max(30, Math.abs(end.y - start.y) * 0.5);
        return { cp1: { x: start.x, y: start.y + spanY }, cp2: { x: end.x, y: end.y - spanY } };
    }
    const dir = side === 'left' ? -1 : 1;
    const spanX = Math.max(30, Math.abs(end.x - start.x) * 0.5);
    return { cp1: { x: start.x + spanX * dir, y: start.y }, cp2: { x: end.x - spanX * dir, y: end.y } };
}

function cubicAt(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return {
        x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
        y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    };
}

/**
 * World-точка для кнопки collapse на стороне side узла nodeId.
 * — Ровно 1 ребёнок на стороне → середина соединяющей линии (bezier t=0.5), atEdge:false.
 * — 0, >1 детей или collapsed → основание веера (якорь на ребре капсулы), atEdge:true.
 * Флаг atEdge=true означает, что точка лежит на ребре капсулы и потребитель
 * должен отодвинуть кнопку наружу в экранных px, чтобы не заходить на капсулу.
 * @param {object[]} objects
 * @param {string} nodeId
 * @param {'left'|'right'|'bottom'} side
 * @returns {{x:number,y:number,atEdge:boolean}|null}
 */
export function getMindmapCollapsePoint(objects, nodeId, side) {
    if (!VALID_SIDES.has(side)) return null;
    const { byId, rootByCompoundId } = buildIndexMaps(objects);
    const parent = byId.get(nodeId);
    if (!parent) return null;

    const anchor = anchorPoint(nodeRect(parent), side);
    if (asMeta(parent).collapsed === true) return { x: anchor.x, y: anchor.y, atEdge: true };

    const kids = (Array.isArray(objects) ? objects : []).filter((obj) => {
        if (!isMindmapNode(obj)) return false;
        const meta = asMeta(obj);
        if (meta.role !== CHILD_ROLE || meta.side !== side) return false;
        return resolveParentId(obj, byId, rootByCompoundId) === nodeId;
    });
    if (kids.length !== 1) return { x: anchor.x, y: anchor.y, atEdge: true };

    const end = anchorPoint(nodeRect(kids[0]), CHILD_ATTACH_SIDE[side] || 'top');
    const { cp1, cp2 } = bezierControls(anchor, end, side);
    const mid = cubicAt(anchor, cp1, cp2, end, 0.5);
    return { x: mid.x, y: mid.y, atEdge: false };
}
