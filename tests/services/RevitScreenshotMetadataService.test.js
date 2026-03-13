import { describe, expect, it } from 'vitest';
import { RevitScreenshotMetadataService } from '../../src/services/RevitScreenshotMetadataService.js';

function encodeToRgbaBytes(text) {
    const bytes = Array.from(text).map((ch) => ch.charCodeAt(0));
    const rgba = new Uint8ClampedArray(bytes.length * 4);
    for (let i = 0; i < bytes.length; i += 1) {
        const b = bytes[i];
        rgba[i * 4] = b & 0x07;
        rgba[i * 4 + 1] = (b >> 3) & 0x07;
        rgba[i * 4 + 2] = (b >> 6) & 0x03;
        rgba[i * 4 + 3] = 255;
    }
    return rgba;
}

describe('RevitScreenshotMetadataService', () => {
    it('extracts payload when START/END markers exist', () => {
        const service = new RevitScreenshotMetadataService({ info: () => {} });
        const stream = 'abcSTART_TEXT_{"doc":"x"}_END_TEXTzzz';
        const rgba = encodeToRgbaBytes(stream);

        const result = service._extractPayloadFromRgba(rgba, rgba.length / 4, 1, { source: 'unit' });
        expect(result.hasMetadata).toBe(true);
        expect(result.payload).toBe('{"doc":"x"}');
        expect(result.payloadLength).toBeGreaterThan(0);
    });

    it('returns no metadata when markers missing', () => {
        const service = new RevitScreenshotMetadataService({ info: () => {} });
        const rgba = encodeToRgbaBytes('just-random-stream');

        const result = service._extractPayloadFromRgba(rgba, rgba.length / 4, 1, { source: 'unit' });
        expect(result.hasMetadata).toBe(false);
        expect(result.payload).toBeNull();
        expect(result.reason).toBe('tokens-not-found');
    });
});

