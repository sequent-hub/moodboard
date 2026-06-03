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
