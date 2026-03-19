import { describe, expect, it } from 'vitest';

import {
    MINDMAP_BRANCH_COLOR_PALETTE,
    createChildMindmapIntentMetadata,
    createRootMindmapIntentMetadata,
    pickRandomMindmapBranchColor,
    pickRandomMindmapBranchColorExcluding,
    normalizeMindmapPropertiesForCreate,
} from '../../src/mindmap/MindmapCompoundContract.js';

describe('MindmapCompoundContract', () => {
    it('creates root intent metadata with root role', () => {
        expect(createRootMindmapIntentMetadata()).toEqual({
            compoundId: null,
            role: 'root',
            parentId: null,
            side: null,
            order: 0,
            branchOrder: 0,
            branchColor: null,
        });
    });

    it('creates child intent metadata from source mindmap', () => {
        const meta = createChildMindmapIntentMetadata({
            sourceObjectId: 'node-root',
            sourceProperties: { mindmap: { compoundId: 'compound-a' } },
            side: 'right',
        });

        expect(meta).toEqual({
            compoundId: 'compound-a',
            role: 'child',
            parentId: 'node-root',
            side: 'right',
            order: null,
            branchOrder: null,
            branchColor: null,
        });
    });

    it('supports bottom direction for nested child intent', () => {
        const meta = createChildMindmapIntentMetadata({
            sourceObjectId: 'node-child',
            sourceProperties: { mindmap: { compoundId: 'compound-a' } },
            side: 'bottom',
        });

        expect(meta.side).toBe('bottom');
        expect(meta.parentId).toBe('node-child');
        expect(meta.compoundId).toBe('compound-a');
        expect(meta.branchColor).toBe(null);
    });

    it('assigns random palette color for root-based child intent', () => {
        const meta = createChildMindmapIntentMetadata({
            sourceObjectId: 'root-node',
            sourceProperties: {
                strokeColor: 0x2563EB,
                mindmap: { role: 'root', compoundId: 'compound-a' },
            },
            side: 'right',
        });
        expect(MINDMAP_BRANCH_COLOR_PALETTE).toContain(meta.branchColor);
    });

    it('returns color from branch palette helper', () => {
        const color = pickRandomMindmapBranchColor(() => 0.5);
        expect(MINDMAP_BRANCH_COLOR_PALETTE).toContain(color);
    });

    it('returns color excluding already used palette entries', () => {
        const used = MINDMAP_BRANCH_COLOR_PALETTE.slice(0, 3);
        const color = pickRandomMindmapBranchColorExcluding({
            excludedColors: used,
            randomFn: () => 0,
        });
        expect(used).not.toContain(color);
        expect(MINDMAP_BRANCH_COLOR_PALETTE).toContain(color);
    });

    it('normalizes legacy mindmap to standalone root compound', () => {
        const normalized = normalizeMindmapPropertiesForCreate({
            type: 'mindmap',
            objectId: 'legacy-node',
            properties: { content: 'legacy' },
            existingObjects: [],
        });

        expect(normalized.mindmap).toEqual({
            compoundId: 'legacy-node',
            role: 'root',
            parentId: null,
            side: null,
            order: 0,
            branchOrder: 0,
            branchRootId: null,
            branchColor: null,
        });
    });

    it('normalizes child metadata and derives compound from parent', () => {
        const existing = [
            {
                id: 'root-1',
                type: 'mindmap',
                properties: { mindmap: { compoundId: 'compound-1', role: 'root' } },
            },
        ];

        const normalized = normalizeMindmapPropertiesForCreate({
            type: 'mindmap',
            objectId: 'child-1',
            properties: { mindmap: { role: 'child', parentId: 'root-1', side: 'left' } },
            existingObjects: existing,
        });

        expect(normalized.mindmap).toEqual({
            compoundId: 'compound-1',
            role: 'child',
            parentId: 'root-1',
            side: 'left',
            order: 0,
            branchOrder: null,
            branchRootId: 'child-1',
            branchColor: normalized.mindmap.branchColor,
        });
        expect(MINDMAP_BRANCH_COLOR_PALETTE).toContain(normalized.mindmap.branchColor);
    });

    it('falls back to root when child has no parent', () => {
        const normalized = normalizeMindmapPropertiesForCreate({
            type: 'mindmap',
            objectId: 'node-a',
            properties: { mindmap: { role: 'child' } },
            existingObjects: [],
        });

        expect(normalized.mindmap.role).toBe('root');
        expect(normalized.mindmap.parentId).toBe(null);
        expect(normalized.mindmap.compoundId).toBe('node-a');
    });

    it('does not modify non-mindmap properties', () => {
        const props = { content: 'note text' };
        const normalized = normalizeMindmapPropertiesForCreate({
            type: 'note',
            objectId: 'note-1',
            properties: props,
            existingObjects: [],
        });
        expect(normalized).toEqual(props);
    });
});
