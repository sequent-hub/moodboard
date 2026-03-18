import { describe, expect, it } from 'vitest';

import {
    createChildMindmapIntentMetadata,
    createRootMindmapIntentMetadata,
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
            branchRootId: null,
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
            branchRootId: 'root-1',
        });
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
