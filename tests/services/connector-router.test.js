import { describe, it, expect } from 'vitest';
import { buildPath, computeElbowWaypoints, sampleBezier, bezierControlPoints, BEZIER_SAMPLES } from '../../src/services/ConnectorRouter.js';

describe('ConnectorRouter', () => {
    describe('buildPath', () => {
        it('straight route returns [start, end]', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 100, y: 100 };
            const result = buildPath(start, end, 'straight');
            
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(start);
            expect(result[1]).toEqual(end);
        });

        it('elbow route returns 4 points with H-V-H scheme when |dx| >= |dy|', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 100, y: 40 };
            const result = buildPath(start, end, 'elbow');
            
            expect(result).toHaveLength(4);
            expect(result[0]).toEqual(start);
            expect(result[3]).toEqual(end);
            
            const midX = Math.round((start.x + end.x) / 2);
            expect(result[1].x).toBe(midX);
            expect(result[1].y).toBe(start.y);
            expect(result[2].x).toBe(midX);
            expect(result[2].y).toBe(end.y);
        });

        it('elbow route returns 4 points with V-H-V scheme when |dy| > |dx|', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 40, y: 100 };
            const result = buildPath(start, end, 'elbow');
            
            expect(result).toHaveLength(4);
            expect(result[0]).toEqual(start);
            expect(result[3]).toEqual(end);
            
            const midY = Math.round((start.y + end.y) / 2);
            expect(result[1].x).toBe(start.x);
            expect(result[1].y).toBe(midY);
            expect(result[2].x).toBe(end.x);
            expect(result[2].y).toBe(midY);
        });

        it('bezier route returns BEZIER_SAMPLES+1 points', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 100, y: 100 };
            const result = buildPath(start, end, 'bezier');
            
            expect(result).toHaveLength(BEZIER_SAMPLES + 1);
            expect(result[0]).toEqual(start);
            expect(result[result.length - 1]).toEqual(end);
        });

        it('bezier points are integers', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 100, y: 100 };
            const result = buildPath(start, end, 'bezier');
            
            result.forEach(point => {
                expect(Number.isInteger(point.x)).toBe(true);
                expect(Number.isInteger(point.y)).toBe(true);
            });
        });
    });

    describe('computeElbowWaypoints', () => {
        it('uses H-V-H scheme when |dx| >= |dy|', () => {
            const start = { x: 10, y: 20 };
            const end = { x: 110, y: 50 };
            const result = computeElbowWaypoints(start, end);
            
            const midX = Math.round((start.x + end.x) / 2);
            expect(result).toEqual([
                start,
                { x: midX, y: start.y },
                { x: midX, y: end.y },
                end,
            ]);
        });

        it('uses V-H-V scheme when |dy| > |dx|', () => {
            const start = { x: 10, y: 20 };
            const end = { x: 50, y: 120 };
            const result = computeElbowWaypoints(start, end);
            
            const midY = Math.round((start.y + end.y) / 2);
            expect(result).toEqual([
                start,
                { x: start.x, y: midY },
                { x: end.x, y: midY },
                end,
            ]);
        });
    });

    describe('bezierControlPoints', () => {
        it('returns control points offset along dominant axis (horizontal)', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 100, y: 20 };
            const { cp1, cp2 } = bezierControlPoints(start, end);
            
            expect(cp1.y).toBe(start.y);
            expect(cp2.y).toBe(end.y);
            expect(cp1.x).toBeGreaterThan(start.x);
            expect(cp2.x).toBeLessThan(end.x);
        });

        it('returns control points offset along dominant axis (vertical)', () => {
            const start = { x: 0, y: 0 };
            const end = { x: 20, y: 100 };
            const { cp1, cp2 } = bezierControlPoints(start, end);
            
            expect(cp1.x).toBe(start.x);
            expect(cp2.x).toBe(end.x);
            expect(cp1.y).toBeGreaterThan(start.y);
            expect(cp2.y).toBeLessThan(end.y);
        });
    });

    describe('sampleBezier', () => {
        it('returns start point when t=0', () => {
            const s = { x: 0, y: 0 };
            const cp1 = { x: 50, y: 50 };
            const cp2 = { x: 100, y: 50 };
            const e = { x: 100, y: 0 };
            
            const result = sampleBezier(s, cp1, cp2, e, 0);
            expect(result).toEqual(s);
        });

        it('returns end point when t=1', () => {
            const s = { x: 0, y: 0 };
            const cp1 = { x: 50, y: 50 };
            const cp2 = { x: 100, y: 50 };
            const e = { x: 100, y: 0 };
            
            const result = sampleBezier(s, cp1, cp2, e, 1);
            expect(result.x).toBeCloseTo(e.x, 5);
            expect(result.y).toBeCloseTo(e.y, 5);
        });
    });
});
