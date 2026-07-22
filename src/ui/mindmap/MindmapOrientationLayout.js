import { Events } from '../../core/events/Events.js';

// Раскладка компаунда mindmap в двух ориентациях.
// horizontal — дети слева/справа от родителя, соседи стопкой по вертикали (совместимо
//   со штатным движком в HandlesDomRenderer; те же зазоры).
// vertical — дети под родителем, соседи в ряд по горизонтали.
const HORIZONTAL_LEVEL_GAP = 100; // родитель → ребёнок по X (= gapWorld движка)
const HORIZONTAL_SIBLING_GAP = 30; // между соседями по Y (= verticalGap движка)
const VERTICAL_LEVEL_GAP = 70; // родитель низ → ребёнок верх по Y
const VERTICAL_SIBLING_GAP = 40; // между поддеревьями соседей по X

function getObjects(core) {
    return core?.state?.state?.objects || [];
}

function nodeWidth(node) {
    const w = node?.width ?? node?.properties?.width ?? 1;
    return Math.max(1, Math.round(Number.isFinite(w) ? w : 1));
}

function nodeHeight(node) {
    const h = node?.height ?? node?.properties?.height ?? 1;
    return Math.max(1, Math.round(Number.isFinite(h) ? h : 1));
}

function meta(node) {
    return node?.properties?.mindmap || {};
}

/**
 * Пересобирает позиции и стороны всех узлов компаунда под выбранную ориентацию.
 * Корень остаётся на месте; дети раскладываются рекурсивно.
 */
export function applyMindmapOrientation({ core, eventBus, rootId, orientation }) {
    if (!core || !eventBus || !rootId) {
        return;
    }
    const mindmaps = getObjects(core).filter((o) => o?.type === 'mindmap');
    const byId = new Map(mindmaps.map((o) => [o.id, o]));
    const root = byId.get(rootId);
    if (!root || meta(root).role !== 'root') {
        return;
    }
    const compoundId = meta(root).compoundId || null;

    const childrenByParent = new Map();
    mindmaps.forEach((o) => {
        const m = meta(o);
        if (m.role !== 'child' || !m.parentId) {
            return;
        }
        if (compoundId && m.compoundId && m.compoundId !== compoundId) {
            return;
        }
        if (!childrenByParent.has(m.parentId)) {
            childrenByParent.set(m.parentId, []);
        }
        childrenByParent.get(m.parentId).push(o);
    });

    const orderVal = (o) => (Number.isFinite(meta(o).branchOrder) ? Number(meta(o).branchOrder) : null);
    childrenByParent.forEach((list) => {
        list.sort((a, b) => {
            const ao = orderVal(a);
            const bo = orderVal(b);
            if (ao !== null && bo !== null && ao !== bo) {
                return ao - bo;
            }
            if (ao !== null && bo === null) {
                return -1;
            }
            if (ao === null && bo !== null) {
                return 1;
            }
            return orientation === 'vertical'
                ? (a.position?.x || 0) - (b.position?.x || 0)
                : (a.position?.y || 0) - (b.position?.y || 0);
        });
    });

    // Дети свёрнутого узла скрыты — не участвуют в раскладке.
    const kids = (id) => {
        const n = byId.get(id);
        if (n && meta(n).collapsed === true) {
            return [];
        }
        return childrenByParent.get(id) || [];
    };

    const childSide = (node) => (meta(node).side === 'left' ? 'left' : 'right');
    const positions = new Map();

    if (orientation === 'vertical') {
        const widthCache = new Map();
        const subtreeWidth = (node) => {
            if (widthCache.has(node.id)) {
                return widthCache.get(node.id);
            }
            const cs = kids(node.id);
            let value = nodeWidth(node);
            if (cs.length) {
                let total = 0;
                cs.forEach((c, i) => {
                    total += subtreeWidth(c);
                    if (i > 0) {
                        total += VERTICAL_SIBLING_GAP;
                    }
                });
                value = Math.max(value, total);
            }
            widthCache.set(node.id, value);
            return value;
        };
        const place = (node, centerX, topY) => {
            positions.set(node.id, { x: Math.round(centerX - nodeWidth(node) / 2), y: Math.round(topY) });
            const cs = kids(node.id);
            if (!cs.length) {
                return;
            }
            let total = 0;
            cs.forEach((c, i) => {
                total += subtreeWidth(c);
                if (i > 0) {
                    total += VERTICAL_SIBLING_GAP;
                }
            });
            const childTopY = topY + nodeHeight(node) + VERTICAL_LEVEL_GAP;
            let cursor = centerX - total / 2;
            cs.forEach((c) => {
                const cw = subtreeWidth(c);
                place(c, cursor + cw / 2, childTopY);
                cursor += cw + VERTICAL_SIBLING_GAP;
            });
        };
        place(root, (root.position?.x || 0) + nodeWidth(root) / 2, root.position?.y || 0);
    } else {
        const heightCache = new Map();
        const columnHeight = (list) => {
            if (!list.length) {
                return 0;
            }
            let total = 0;
            list.forEach((c, i) => {
                total += subtreeHeight(c);
                if (i > 0) {
                    total += HORIZONTAL_SIBLING_GAP;
                }
            });
            return total;
        };
        const subtreeHeight = (node) => {
            if (heightCache.has(node.id)) {
                return heightCache.get(node.id);
            }
            const cs = kids(node.id);
            let value = nodeHeight(node);
            if (cs.length) {
                const left = cs.filter((c) => childSide(c) === 'left');
                const right = cs.filter((c) => childSide(c) !== 'left');
                value = Math.max(value, columnHeight(left), columnHeight(right));
            }
            heightCache.set(node.id, value);
            return value;
        };
        const layoutColumn = (list, side, parentLeftX, parentWidth, parentCenterY) => {
            if (!list.length) {
                return;
            }
            const total = columnHeight(list);
            let cursor = parentCenterY - total / 2;
            list.forEach((c) => {
                const ch = subtreeHeight(c);
                const childCenterY = cursor + ch / 2;
                const childLeftX = side === 'left'
                    ? parentLeftX - HORIZONTAL_LEVEL_GAP - nodeWidth(c)
                    : parentLeftX + parentWidth + HORIZONTAL_LEVEL_GAP;
                place(c, childLeftX, childCenterY);
                cursor += ch + HORIZONTAL_SIBLING_GAP;
            });
        };
        const place = (node, leftX, centerY) => {
            positions.set(node.id, { x: Math.round(leftX), y: Math.round(centerY - nodeHeight(node) / 2) });
            const cs = kids(node.id);
            if (!cs.length) {
                return;
            }
            const left = cs.filter((c) => childSide(c) === 'left');
            const right = cs.filter((c) => childSide(c) !== 'left');
            layoutColumn(left, 'left', leftX, nodeWidth(node), centerY);
            layoutColumn(right, 'right', leftX, nodeWidth(node), centerY);
        };
        place(root, root.position?.x || 0, (root.position?.y || 0) + nodeHeight(root) / 2);
    }

    positions.forEach((pos, id) => {
        const node = byId.get(id);
        if (!node) {
            return;
        }
        const curX = Math.round(node.position?.x || 0);
        const curY = Math.round(node.position?.y || 0);
        if (curX === pos.x && curY === pos.y) {
            return;
        }
        try {
            core.updateObjectPositionDirect(id, { x: pos.x, y: pos.y }, { snap: false });
        } catch (_) { /* позиция подхватится на следующем перерисе */ }
        eventBus.emit(Events.Object.TransformUpdated, { objectId: id });
        eventBus.emit(Events.Tool.DragUpdate, { object: id, position: { x: pos.x, y: pos.y } });
    });

    core?.state?.markDirty?.();
}
