/**
 * Тесты контракта перпендикулярного выхода из грани для elbow/bezier коннекторов.
 */
import { describe, it, expect } from 'vitest';
import { ConnectorBindingResolver } from '../../src/services/ConnectorBindingResolver.js';
import { buildPath, bezierControlPoints, ELBOW_STUB } from '../../src/services/ConnectorRouter.js';

/** Вспомогательный объект без поворота. */
function makeBox(x, y, w = 100, h = 80) {
    return { position: { x, y }, width: w, height: h, rotation: 0 };
}

const BOUND_CENTER = {
    boundId: 'obj',
    anchor: { x: 0.5, y: 0.5 },
    isPrecise: false,
    isExact: false,
};

// ---------------------------------------------------------------------------
// 1. Выбор стороны по расположению другого бокса
// ---------------------------------------------------------------------------
describe('resolveWithSide — выбор стороны', () => {
    it('другой бокс справа → правая грань, dir=(1,0)', () => {
        const target      = makeBox(0, 0, 100, 80);
        const otherCenter = { x: 300, y: 40 };
        const { point, dir } = ConnectorBindingResolver.resolveWithSide(
            BOUND_CENTER, target, otherCenter,
        );
        expect(dir.x).toBeCloseTo(1);
        expect(dir.y).toBeCloseTo(0);
        // правая кромка: x = 0 + 100 = 100; центр по y = 0 + 80/2 = 40
        expect(point.x).toBe(100);
        expect(point.y).toBe(40);
    });

    it('другой бокс слева → левая грань, dir=(-1,0)', () => {
        const target      = makeBox(200, 0, 100, 80);
        const otherCenter = { x: 0, y: 40 };
        const { dir } = ConnectorBindingResolver.resolveWithSide(
            BOUND_CENTER, target, otherCenter,
        );
        expect(dir.x).toBeCloseTo(-1);
        expect(dir.y).toBeCloseTo(0);
    });

    it('другой бокс снизу → нижняя грань, dir=(0,1)', () => {
        const target      = makeBox(0, 0, 100, 80);
        const otherCenter = { x: 50, y: 300 };
        const { dir } = ConnectorBindingResolver.resolveWithSide(
            BOUND_CENTER, target, otherCenter,
        );
        expect(dir.x).toBeCloseTo(0);
        expect(dir.y).toBeCloseTo(1);
    });

    it('другой бокс сверху → верхняя грань, dir=(0,-1)', () => {
        const target      = makeBox(0, 100, 100, 80);
        const otherCenter = { x: 50, y: 0 };
        const { dir } = ConnectorBindingResolver.resolveWithSide(
            BOUND_CENTER, target, otherCenter,
        );
        expect(dir.x).toBeCloseTo(0);
        expect(dir.y).toBeCloseTo(-1);
    });
});

// ---------------------------------------------------------------------------
// 2. elbow: первый и последний сегменты перпендикулярны грани
// ---------------------------------------------------------------------------
describe('elbow buildPath — перпендикулярный выход/вход', () => {
    /** Нормализованное направление сегмента pts[i-1]→pts[i]. */
    function segDir(pts, i) {
        const dx = pts[i].x - pts[i - 1].x;
        const dy = pts[i].y - pts[i - 1].y;
        const len = Math.hypot(dx, dy);
        return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
    }

    it('горизонтальное facing (right→left): выход и вход совпадают с dir', () => {
        const startDir = { x: 1, y: 0 };   // правая грань
        const endDir   = { x: -1, y: 0 };  // левая грань
        const pts = buildPath(
            { x: 100, y: 100 }, { x: 300, y: 200 },
            'elbow', startDir, endDir,
        );
        expect(pts.length).toBeGreaterThanOrEqual(2);
        const first = segDir(pts, 1);
        expect(first.x).toBeCloseTo(startDir.x, 1);
        expect(first.y).toBeCloseTo(startDir.y, 1);

        const n    = pts.length;
        const last = segDir(pts, n - 1);
        expect(last.x).toBeCloseTo(-endDir.x, 1);
        expect(last.y).toBeCloseTo(-endDir.y, 1);
    });

    it('L-shape (right→bottom): выход и вход совпадают с dir', () => {
        const startDir = { x: 1, y: 0 };
        const endDir   = { x: 0, y: 1 };
        const pts = buildPath(
            { x: 50, y: 200 }, { x: 300, y: 50 },
            'elbow', startDir, endDir,
        );
        expect(pts.length).toBeGreaterThanOrEqual(2);
        const first = segDir(pts, 1);
        expect(first.x).toBeCloseTo(startDir.x, 1);
        expect(first.y).toBeCloseTo(startDir.y, 1);

        const n    = pts.length;
        const last = segDir(pts, n - 1);
        expect(last.x).toBeCloseTo(-endDir.x, 1);
        expect(last.y).toBeCloseTo(-endDir.y, 1);
    });

    it('вертикальное facing (bottom→top): выход и вход совпадают с dir', () => {
        const startDir = { x: 0, y: 1 };
        const endDir   = { x: 0, y: -1 };
        const pts = buildPath(
            { x: 150, y: 100 }, { x: 200, y: 400 },
            'elbow', startDir, endDir,
        );
        const first = segDir(pts, 1);
        expect(first.x).toBeCloseTo(startDir.x, 1);
        expect(first.y).toBeCloseTo(startDir.y, 1);

        const n    = pts.length;
        const last = segDir(pts, n - 1);
        expect(last.x).toBeCloseTo(-endDir.x, 1);
        expect(last.y).toBeCloseTo(-endDir.y, 1);
    });
});

// ---------------------------------------------------------------------------
// 3. elbow: длина первого сегмента >= ELBOW_STUB
// ---------------------------------------------------------------------------
describe('elbow buildPath — длина stub', () => {
    it('длина startPoint→S` >= ELBOW_STUB', () => {
        const startDir = { x: 0, y: -1 };
        const endDir   = { x: 0, y: 1 };
        const pts = buildPath(
            { x: 150, y: 300 }, { x: 150, y: 100 },
            'elbow', startDir, endDir,
        );
        const len = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        expect(len).toBeGreaterThanOrEqual(ELBOW_STUB);
    });

    it('длина E`→endPoint >= ELBOW_STUB', () => {
        const startDir = { x: 1, y: 0 };
        const endDir   = { x: -1, y: 0 };
        const pts = buildPath(
            { x: 0, y: 0 }, { x: 300, y: 100 },
            'elbow', startDir, endDir,
        );
        const n   = pts.length;
        const len = Math.hypot(pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y);
        expect(len).toBeGreaterThanOrEqual(ELBOW_STUB);
    });
});

// ---------------------------------------------------------------------------
// Регрессия: грани смотрят ВРОЗЬ (C-shape обход без разворота)
// ---------------------------------------------------------------------------
describe('elbow buildPath — грани врозь (C-shape)', () => {
    /** Нормализованное направление сегмента pts[i-1]→pts[i]. */
    function segDir(pts, i) {
        const dx = pts[i].x - pts[i - 1].x;
        const dy = pts[i].y - pts[i - 1].y;
        const len = Math.hypot(dx, dy);
        return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
    }

    it('вертикаль «снизу вверх»: старт ниже (bottom-грань, dir вниз), цель выше (top-грань, dir вверх)', () => {
        // Старт выходит из нижней грани блока, который стоит НИЖЕ цели.
        // Грани смотрят ВРОЗЬ — ожидаем C-shape без разворота.
        const startDir = { x: 0, y: 1 };   // нижняя грань смотрит вниз
        const endDir   = { x: 0, y: -1 };  // верхняя грань смотрит вверх
        const startPt  = { x: 150, y: 400 }; // ниже
        const endPt    = { x: 200, y: 100 }; // выше

        const pts = buildPath(startPt, endPt, 'elbow', startDir, endDir);

        // Перпендикулярность первого сегмента
        const first = segDir(pts, 1);
        expect(first.x).toBeCloseTo(startDir.x, 1);
        expect(first.y).toBeCloseTo(startDir.y, 1);

        // Перпендикулярность последнего сегмента
        const n    = pts.length;
        const last = segDir(pts, n - 1);
        expect(last.x).toBeCloseTo(-endDir.x, 1);
        expect(last.y).toBeCloseTo(-endDir.y, 1);

        // Нет разворота: второй сегмент не уходит против startDir
        // (проекция направления pts[1]→pts[2] на startDir ≥ 0)
        if (pts.length >= 3) {
            const second = segDir(pts, 2);
            const dot = second.x * startDir.x + second.y * startDir.y;
            expect(dot).toBeGreaterThanOrEqual(-0.1); // допуск на округление
        }
    });

    it('горизонталь «правее к левее»: старт правее (right-грань, dir вправо), цель левее (left-грань, dir влево)', () => {
        const startDir = { x: 1, y: 0 };   // правая грань смотрит вправо
        const endDir   = { x: -1, y: 0 };  // левая грань смотрит влево
        const startPt  = { x: 400, y: 150 }; // правее
        const endPt    = { x: 100, y: 200 }; // левее

        const pts = buildPath(startPt, endPt, 'elbow', startDir, endDir);

        const first = segDir(pts, 1);
        expect(first.x).toBeCloseTo(startDir.x, 1);
        expect(first.y).toBeCloseTo(startDir.y, 1);

        const n    = pts.length;
        const last = segDir(pts, n - 1);
        expect(last.x).toBeCloseTo(-endDir.x, 1);
        expect(last.y).toBeCloseTo(-endDir.y, 1);

        if (pts.length >= 3) {
            const second = segDir(pts, 2);
            const dot = second.x * startDir.x + second.y * startDir.y;
            expect(dot).toBeGreaterThanOrEqual(-0.1);
        }
    });
});

// ---------------------------------------------------------------------------
// 4. bezier: контрольная точка смещена вдоль dir
// ---------------------------------------------------------------------------
describe('bezierControlPoints — смещение вдоль dir', () => {
    it('cp1 направлена вдоль startDir, cp2 — вдоль endDir', () => {
        const start    = { x: 0, y: 0 };
        const end      = { x: 0, y: 200 };
        const startDir = { x: 1, y: 0 };
        const endDir   = { x: -1, y: 0 };

        const { cp1, cp2 } = bezierControlPoints(start, end, startDir, endDir);

        // cp1 должна быть смещена от start в направлении startDir
        const d1  = { x: cp1.x - start.x, y: cp1.y - start.y };
        const l1  = Math.hypot(d1.x, d1.y);
        expect(l1).toBeGreaterThan(0);
        const dot1 = (d1.x / l1) * startDir.x + (d1.y / l1) * startDir.y;
        expect(dot1).toBeGreaterThan(0.9);

        // cp2 должна быть смещена от end в направлении endDir
        const d2  = { x: cp2.x - end.x, y: cp2.y - end.y };
        const l2  = Math.hypot(d2.x, d2.y);
        expect(l2).toBeGreaterThan(0);
        const dot2 = (d2.x / l2) * endDir.x + (d2.y / l2) * endDir.y;
        expect(dot2).toBeGreaterThan(0.9);
    });

    it('без dir — fallback по доминирующей оси (обратная совместимость)', () => {
        const start = { x: 0, y: 0 };
        const end   = { x: 200, y: 0 };
        const { cp1, cp2 } = bezierControlPoints(start, end);
        // cp1 правее start, cp2 левее end (горизонтальная ось доминирует)
        expect(cp1.x).toBeGreaterThan(start.x);
        expect(cp2.x).toBeLessThan(end.x);
    });
});
