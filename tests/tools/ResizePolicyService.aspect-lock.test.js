import { describe, it, expect } from 'vitest';
import {
    normalizeSingleResizeGeometry,
    resolveSingleResizeDominantAxis,
} from '../../src/services/ResizePolicyService.js';

function getRectAnchor(rect, handle) {
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    const centerX = rect.x + (rect.width / 2);
    const centerY = rect.y + (rect.height / 2);

    switch (handle) {
        case 'nw': return { x: right, y: bottom };
        case 'n': return { x: centerX, y: bottom };
        case 'ne': return { x: rect.x, y: bottom };
        case 'e': return { x: rect.x, y: centerY };
        case 'se': return { x: rect.x, y: rect.y };
        case 's': return { x: centerX, y: rect.y };
        case 'sw': return { x: right, y: rect.y };
        case 'w': return { x: right, y: centerY };
        default: return null;
    }
}

function getRawSizeForHandle(handle) {
    if (handle === 'e' || handle === 'w') {
        return { width: 260, height: 100 };
    }
    if (handle === 'n' || handle === 's') {
        return { width: 200, height: 160 };
    }
    return { width: 260, height: 170 };
}

describe('ResizePolicyService aspect-ratio normalization', () => {
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    const startRect = {
        x: 100,
        y: 200,
        width: 200,
        height: 100,
    };

    handles.forEach((handle) => {
        it(`keeps opposite anchor fixed for image handle "${handle}"`, () => {
            const beforeAnchor = getRectAnchor(startRect, handle);
            const normalized = normalizeSingleResizeGeometry({
                startSize: { width: startRect.width, height: startRect.height },
                startPosition: { x: startRect.x, y: startRect.y },
                handle,
                size: getRawSizeForHandle(handle),
                position: { x: startRect.x, y: startRect.y },
                objectType: 'image',
                properties: {},
            });

            expect(normalized.size.width / normalized.size.height).toBeCloseTo(2, 8);

            const afterRect = {
                x: normalized.position.x,
                y: normalized.position.y,
                width: normalized.size.width,
                height: normalized.size.height,
            };
            const afterAnchor = getRectAnchor(afterRect, handle);
            expect(afterAnchor).toEqual(beforeAnchor);
        });
    });

    handles.forEach((handle) => {
        it(`keeps opposite anchor fixed for locked frame handle "${handle}"`, () => {
            const beforeAnchor = getRectAnchor(startRect, handle);
            const normalized = normalizeSingleResizeGeometry({
                startSize: { width: startRect.width, height: startRect.height },
                startPosition: { x: startRect.x, y: startRect.y },
                handle,
                size: getRawSizeForHandle(handle),
                position: { x: startRect.x, y: startRect.y },
                objectType: 'frame',
                properties: { lockedAspect: true },
            });

            expect(normalized.size.width / normalized.size.height).toBeCloseTo(2, 8);

            const afterRect = {
                x: normalized.position.x,
                y: normalized.position.y,
                width: normalized.size.width,
                height: normalized.size.height,
            };
            const afterAnchor = getRectAnchor(afterRect, handle);
            expect(afterAnchor).toEqual(beforeAnchor);
        });
    });

    it('uses the same normalized geometry for update and end phases', () => {
        const params = {
            startSize: { width: 200, height: 100 },
            startPosition: { x: 100, y: 200 },
            handle: 'w',
            size: { width: 140, height: 100 },
            position: { x: 160, y: 200 },
            objectType: 'image',
            properties: {},
        };

        const updatePhase = normalizeSingleResizeGeometry(params);
        const endPhase = normalizeSingleResizeGeometry(params);

        expect(endPhase).toEqual(updatePhase);
    });

    it('applies frame minimum area after aspect normalization and keeps anchor', () => {
        const start = {
            x: 100,
            y: 200,
            width: 200,
            height: 100,
        };

        const normalized = normalizeSingleResizeGeometry({
            startSize: { width: start.width, height: start.height },
            startPosition: { x: start.x, y: start.y },
            handle: 'se',
            size: { width: 30, height: 15 },
            position: { x: start.x, y: start.y },
            objectType: 'frame',
            properties: { lockedAspect: true },
        });

        expect(normalized.size).toEqual({ width: 60, height: 30 });
        expect(normalized.position).toEqual({ x: 100, y: 200 });
    });

    it('keeps square note geometry centered on edge handle', () => {
        const normalized = normalizeSingleResizeGeometry({
            startSize: { width: 120, height: 120 },
            startPosition: { x: 50, y: 80 },
            handle: 'e',
            size: { width: 180, height: 120 },
            position: { x: 50, y: 80 },
            objectType: 'note',
            properties: {},
        });

        expect(normalized.size).toEqual({ width: 180, height: 180 });
        expect(normalized.position).toEqual({ x: 50, y: 50 });
    });

    it('resolves width-driven dominant axis on a large diagonal image trajectory', () => {
        const trajectory = [
            { width: 100, height: 50 },
            { width: 120, height: 90 },
            { width: 160, height: 100 },
        ];

        const dominantAxes = trajectory.map((size) => resolveSingleResizeDominantAxis({
            startSize: { width: 40, height: 20 },
            size,
            objectType: 'image',
            properties: {},
        }));

        expect(dominantAxes).toEqual(['width', 'width', 'width']);
    });

    it('keeps preferred dominant axis stable across neighboring raw sizes', () => {
        const frame1 = normalizeSingleResizeGeometry({
            startSize: { width: 500, height: 300 },
            startPosition: { x: 100, y: 100 },
            handle: 'se',
            size: { width: 560, height: 340 },
            position: { x: 100, y: 100 },
            objectType: 'image',
            properties: {},
            preferredDominantAxis: 'width',
        });

        const frame2 = normalizeSingleResizeGeometry({
            startSize: { width: 500, height: 300 },
            startPosition: { x: 100, y: 100 },
            handle: 'se',
            size: { width: 559, height: 361 },
            position: { x: 100, y: 100 },
            objectType: 'image',
            properties: {},
            preferredDominantAxis: 'width',
        });

        expect(frame1.size).toEqual({ width: 560, height: 336 });
        expect(frame2.size).toEqual({ width: 559, height: 335 });
    });
});
