const ROOT_ROLE = 'root';
const CHILD_ROLE = 'child';
const LEFT_SIDE = 'left';
const RIGHT_SIDE = 'right';
const BOTTOM_SIDE = 'bottom';
const DEBUG_STORAGE_KEY = 'mb:mindmap:compound:debug';
const BRANCH_COLOR_HEX = Object.freeze([
    'EF9A9A', 'CE93D8', '90CAF9',
    '80DEEA', 'A5D6A7', 'E6EE9C',
    'FFE082', 'BCAAA4', 'B0BEC5',
]);
export const MINDMAP_BRANCH_COLOR_PALETTE = Object.freeze(
    BRANCH_COLOR_HEX.map((hex) => Number.parseInt(hex, 16))
);

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function asNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asValidRole(value) {
    return value === ROOT_ROLE || value === CHILD_ROLE ? value : null;
}

function asValidSide(value) {
    return value === LEFT_SIDE || value === RIGHT_SIDE || value === BOTTOM_SIDE ? value : null;
}

function asOrder(value) {
    if (!Number.isFinite(value)) return null;
    const normalized = Math.floor(value);
    return normalized >= 0 ? normalized : null;
}

function asBranchOrder(value) {
    if (!Number.isFinite(value)) return null;
    return Number(value);
}

function asOptionalNodeId(value) {
    return asNonEmptyString(value);
}

function asBranchColor(value) {
    if (!Number.isFinite(value)) return null;
    const normalized = Math.floor(Number(value));
    if (normalized < 0 || normalized > 0xFFFFFF) return null;
    return normalized;
}

export function pickRandomMindmapBranchColor(randomFn = Math.random) {
    const rand = typeof randomFn === 'function' ? randomFn : Math.random;
    const palette = MINDMAP_BRANCH_COLOR_PALETTE;
    if (!Array.isArray(palette) || palette.length === 0) return null;
    const raw = Number(rand());
    const safe = Number.isFinite(raw) ? raw : 0;
    const idx = Math.max(0, Math.min(palette.length - 1, Math.floor(safe * palette.length)));
    return palette[idx];
}

export function pickRandomMindmapBranchColorExcluding({
    excludedColors = [],
    randomFn = Math.random,
} = {}) {
    const excluded = new Set(
        (Array.isArray(excludedColors) ? excludedColors : [])
            .filter((value) => Number.isFinite(value))
            .map((value) => Math.floor(Number(value)))
    );
    const palette = MINDMAP_BRANCH_COLOR_PALETTE.filter((color) => !excluded.has(color));
    if (palette.length === 0) return pickRandomMindmapBranchColor(randomFn);
    const rand = typeof randomFn === 'function' ? randomFn : Math.random;
    const raw = Number(rand());
    const safe = Number.isFinite(raw) ? raw : 0;
    const idx = Math.max(0, Math.min(palette.length - 1, Math.floor(safe * palette.length)));
    return palette[idx];
}

function getMindmapMetadataFromProperties(properties) {
    const props = asObject(properties);
    return asObject(props.mindmap);
}

function getCompoundIdFromObject(objectData) {
    const meta = getMindmapMetadataFromProperties(objectData?.properties);
    return asNonEmptyString(meta.compoundId);
}

function nextChildOrder(existingObjects, compoundId) {
    if (!Array.isArray(existingObjects)) return 0;
    let maxOrder = -1;
    for (const obj of existingObjects) {
        if (!obj || obj.type !== 'mindmap') continue;
        const meta = getMindmapMetadataFromProperties(obj.properties);
        if (asNonEmptyString(meta.compoundId) !== compoundId) continue;
        if (asValidRole(meta.role) !== CHILD_ROLE) continue;
        const order = asOrder(meta.order);
        if (order !== null && order > maxOrder) {
            maxOrder = order;
        }
    }
    return maxOrder + 1;
}

export function createRootMindmapIntentMetadata() {
    return {
        compoundId: null,
        role: ROOT_ROLE,
        parentId: null,
        side: null,
        order: 0,
        branchOrder: 0,
        branchColor: null,
    };
}

export function createChildMindmapIntentMetadata({ sourceObjectId, sourceProperties, side }) {
    const sourceMeta = getMindmapMetadataFromProperties(sourceProperties);
    const sourceId = asNonEmptyString(sourceObjectId);
    const sourceCompoundId = asNonEmptyString(sourceMeta.compoundId);
    const sourceRole = asValidRole(sourceMeta.role);
    const inheritedColor = asBranchColor(sourceMeta.branchColor)
        ?? asBranchColor(sourceProperties?.strokeColor);
    const branchColor = sourceRole === ROOT_ROLE
        ? pickRandomMindmapBranchColor()
        : inheritedColor;
    return {
        compoundId: sourceCompoundId || sourceId,
        role: CHILD_ROLE,
        parentId: sourceId,
        side: asValidSide(side),
        order: null,
        branchOrder: null,
        branchColor,
    };
}

export function normalizeMindmapPropertiesForCreate({
    type,
    objectId,
    properties,
    existingObjects = [],
}) {
    const props = asObject(properties);
    if (type !== 'mindmap') return props;

    const meta = getMindmapMetadataFromProperties(props);
    let role = asValidRole(meta.role);
    const parentIdRaw = asNonEmptyString(meta.parentId);
    const branchRootIdRaw = asOptionalNodeId(meta.branchRootId);
    const sideRaw = asValidSide(meta.side);
    let compoundId = asNonEmptyString(meta.compoundId);
    let order = asOrder(meta.order);
    const branchOrder = asBranchOrder(meta.branchOrder);
    let branchColor = asBranchColor(meta.branchColor)
        ?? asBranchColor(props.strokeColor);

    if (!role) {
        role = parentIdRaw ? CHILD_ROLE : ROOT_ROLE;
    }

    let parentId = parentIdRaw;
    if (role === ROOT_ROLE) {
        parentId = null;
    } else if (!parentId) {
        // Invalid child payload must degrade to root-safe mode.
        role = ROOT_ROLE;
        parentId = null;
    }

    if (!compoundId) {
        if (role === CHILD_ROLE && parentId) {
            const parent = Array.isArray(existingObjects)
                ? existingObjects.find((obj) => obj && obj.id === parentId && obj.type === 'mindmap')
                : null;
            compoundId = getCompoundIdFromObject(parent) || parentId;
        } else {
            compoundId = asNonEmptyString(objectId);
        }
    }

    if (!compoundId) {
        compoundId = asNonEmptyString(objectId);
    }

    if (order === null) {
        order = role === ROOT_ROLE ? 0 : nextChildOrder(existingObjects, compoundId);
    }

    if (role === CHILD_ROLE && branchColor === null && parentId) {
        const parent = Array.isArray(existingObjects)
            ? existingObjects.find((obj) => obj && obj.id === parentId && obj.type === 'mindmap')
            : null;
        const parentMeta = getMindmapMetadataFromProperties(parent?.properties);
        branchColor = asBranchColor(parentMeta.branchColor)
            ?? asBranchColor(parent?.properties?.strokeColor);
        if (branchColor === null && asValidRole(parentMeta.role) === ROOT_ROLE) {
            branchColor = pickRandomMindmapBranchColor();
        }
    }

    return {
        ...props,
        mindmap: {
            compoundId,
            role,
            parentId: role === ROOT_ROLE ? null : parentId,
            side: role === CHILD_ROLE ? sideRaw : null,
            order,
            branchOrder: role === CHILD_ROLE ? branchOrder : 0,
            branchRootId: role === CHILD_ROLE
                ? (branchRootIdRaw || asNonEmptyString(objectId) || null)
                : null,
            branchColor: role === CHILD_ROLE ? branchColor : null,
        },
    };
}

export function isMindmapCompoundDebugEnabled() {
    if (typeof window === 'undefined') return false;
    if (window.__MB_MINDMAP_COMPOUND_DEBUG__ === true) return true;
    try {
        return window.localStorage?.getItem(DEBUG_STORAGE_KEY) === '1';
    } catch (_) {
        return false;
    }
}

export function logMindmapCompoundDebug(eventName, payload) {
    if (!isMindmapCompoundDebugEnabled()) return;
    console.log(`[mindmap:compound] ${eventName}`, payload);
}
