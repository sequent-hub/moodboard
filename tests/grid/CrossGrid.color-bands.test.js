import { describe, expect, it } from 'vitest';
import { getCrossColor, updateCrossCheckpoint } from '../../src/grid/CrossGridZoomPhases.js';

describe('CrossGrid color bands', () => {
    it('uses configured default colors for 3 spacing bands', () => {
        // High band (spacing >= 52)
        expect(getCrossColor(1.15)).toBe(0xC2C2C2);
        // Mid band (spacing 30..50)
        expect(getCrossColor(1.03)).toBe(0xA7A7A7);
        // Small band (spacing <= 28)
        expect(getCrossColor(0.30)).toBe(0xCDCDCD);
    });

    it('updates only current band color via checkpoint patch', () => {
        const highBefore = getCrossColor(1.15);
        const midBefore = getCrossColor(1.03);
        const smallBefore = getCrossColor(0.30);

        // 103% belongs to mid band (spacing=50)
        const updated = updateCrossCheckpoint(103, { color: 0x112233 });
        expect(updated?.color).toBe(0x112233);

        expect(getCrossColor(1.03)).toBe(0x112233);
        expect(getCrossColor(0.58)).toBe(0x112233);
        expect(getCrossColor(1.15)).toBe(highBefore);
        expect(getCrossColor(0.30)).toBe(smallBefore);

        // restore
        updateCrossCheckpoint(103, { color: midBefore });
        expect(getCrossColor(1.15)).toBe(highBefore);
        expect(getCrossColor(1.03)).toBe(midBefore);
        expect(getCrossColor(0.30)).toBe(smallBefore);
    });
});
