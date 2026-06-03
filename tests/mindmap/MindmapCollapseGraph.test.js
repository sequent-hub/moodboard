import { describe, expect, it } from 'vitest';
import {
    buildChildrenIndex,
    getDescendantIds,
    isHiddenByCollapsedAncestor,
    countVisibleDescendantsForBadge,
    getChildrenSidesWithChildren,
} from '../../src/ui/mindmap/MindmapCollapseGraph.js';

function makeMindmap(id, { role = 'child', parentId = null, side = 'right', compoundId = 'c1', collapsed = false } = {}) {
    return {
        id,
        type: 'mindmap',
        position: { x: 0, y: 0 },
        width: 100,
        height: 40,
        properties: {
            mindmap: { role, parentId, side, compoundId, collapsed },
        },
    };
}

const ROOT = makeMindmap('root', { role: 'root', parentId: null, compoundId: 'c1' });
const CHILD_A = makeMindmap('childA', { role: 'child', parentId: 'root', side: 'right', compoundId: 'c1' });
const CHILD_B = makeMindmap('childB', { role: 'child', parentId: 'root', side: 'left', compoundId: 'c1' });
const GRANDCHILD = makeMindmap('grandchild', { role: 'child', parentId: 'childA', side: 'right', compoundId: 'c1' });

describe('buildChildrenIndex', () => {
    it('maps root to its direct children', () => {
        const index = buildChildrenIndex([ROOT, CHILD_A, CHILD_B, GRANDCHILD]);
        expect(index.get('root').map((n) => n.id)).toEqual(expect.arrayContaining(['childA', 'childB']));
        expect(index.get('childA').map((n) => n.id)).toEqual(['grandchild']);
    });

    it('returns empty map for empty input', () => {
        expect(buildChildrenIndex([]).size).toBe(0);
    });

    it('ignores non-mindmap objects', () => {
        const nonMindmap = { id: 'shape1', type: 'shape', properties: {} };
        const index = buildChildrenIndex([ROOT, CHILD_A, nonMindmap]);
        expect(index.has('shape1')).toBe(false);
    });
});

describe('getDescendantIds', () => {
    const objects = [ROOT, CHILD_A, CHILD_B, GRANDCHILD];

    it('returns all descendants of root', () => {
        const ids = getDescendantIds(objects, 'root');
        expect(ids).toEqual(expect.arrayContaining(['childA', 'childB', 'grandchild']));
        expect(ids).toHaveLength(3);
    });

    it('returns direct child and its descendants', () => {
        const ids = getDescendantIds(objects, 'childA');
        expect(ids).toEqual(['grandchild']);
    });

    it('returns empty array for leaf node', () => {
        expect(getDescendantIds(objects, 'grandchild')).toEqual([]);
    });

    it('returns empty array for unknown node', () => {
        expect(getDescendantIds(objects, 'nonexistent')).toEqual([]);
    });

    it('handles cycle guard (parentId === id)', () => {
        const cycleNode = makeMindmap('cycle', { role: 'child', parentId: 'cycle', compoundId: 'c2' });
        expect(() => getDescendantIds([cycleNode], 'cycle')).not.toThrow();
    });
});

describe('isHiddenByCollapsedAncestor', () => {
    it('returns false for child of non-collapsed parent', () => {
        const objects = [ROOT, CHILD_A];
        expect(isHiddenByCollapsedAncestor(objects, 'childA')).toBe(false);
    });

    it('returns true for child of collapsed parent', () => {
        const collapsedRoot = makeMindmap('root', { role: 'root', parentId: null, compoundId: 'c1', collapsed: true });
        const objects = [collapsedRoot, CHILD_A];
        expect(isHiddenByCollapsedAncestor(objects, 'childA')).toBe(true);
    });

    it('returns true for grandchild when grandparent is collapsed', () => {
        const collapsedRoot = makeMindmap('root', { role: 'root', parentId: null, compoundId: 'c1', collapsed: true });
        const objects = [collapsedRoot, CHILD_A, GRANDCHILD];
        expect(isHiddenByCollapsedAncestor(objects, 'grandchild')).toBe(true);
    });

    it('returns true for grandchild when middle parent is collapsed', () => {
        const collapsedChildA = makeMindmap('childA', { role: 'child', parentId: 'root', side: 'right', compoundId: 'c1', collapsed: true });
        const objects = [ROOT, collapsedChildA, GRANDCHILD];
        expect(isHiddenByCollapsedAncestor(objects, 'grandchild')).toBe(true);
    });

    it('returns false for root node (no ancestors)', () => {
        const objects = [ROOT, CHILD_A];
        expect(isHiddenByCollapsedAncestor(objects, 'root')).toBe(false);
    });

    it('returns false for unknown node', () => {
        expect(isHiddenByCollapsedAncestor([ROOT], 'nonexistent')).toBe(false);
    });

    it('handles broken parentId without throwing', () => {
        const orphan = makeMindmap('orphan', { role: 'child', parentId: 'missing-parent', compoundId: 'c1' });
        expect(() => isHiddenByCollapsedAncestor([orphan], 'orphan')).not.toThrow();
        expect(isHiddenByCollapsedAncestor([orphan], 'orphan')).toBe(false);
    });
});

describe('countVisibleDescendantsForBadge', () => {
    it('counts all descendants', () => {
        const objects = [ROOT, CHILD_A, CHILD_B, GRANDCHILD];
        expect(countVisibleDescendantsForBadge(objects, 'root')).toBe(3);
    });

    it('returns 0 for leaf', () => {
        expect(countVisibleDescendantsForBadge([ROOT, CHILD_A], 'childA')).toBe(0);
    });
});

describe('getChildrenSidesWithChildren', () => {
    it('returns sides where children exist', () => {
        const objects = [ROOT, CHILD_A, CHILD_B, GRANDCHILD];
        const sides = getChildrenSidesWithChildren(objects, 'root');
        expect(sides.has('right')).toBe(true);
        expect(sides.has('left')).toBe(true);
        expect(sides.has('bottom')).toBe(false);
    });

    it('returns single side for childA', () => {
        const objects = [ROOT, CHILD_A, GRANDCHILD];
        const sides = getChildrenSidesWithChildren(objects, 'childA');
        expect(sides.has('right')).toBe(true);
        expect(sides.size).toBe(1);
    });

    it('returns empty set for leaf node', () => {
        const objects = [ROOT, CHILD_A];
        expect(getChildrenSidesWithChildren(objects, 'childA').size).toBe(0);
    });
});
