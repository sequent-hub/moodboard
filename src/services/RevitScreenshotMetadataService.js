export class RevitScreenshotMetadataService {
    constructor(_logger = console, _options = {}) {
        this.startToken = 'START_TEXT_';
        this.endToken = '_END_TEXT';
    }

    async extractFromFile(file, _context = {}) {
        if (!file) return this._emptyResult('no-file');
        return this.extractFromBlob(file);
    }

    async extractFromImageSource(src, _context = {}) {
        if (!src || typeof src !== 'string') return this._emptyResult('no-src');
        try {
            const response = await fetch(src);
            if (!response.ok) {
                return this._emptyResult('source-fetch-failed');
            }
            const blob = await response.blob();
            return this.extractFromBlob(blob);
        } catch (_) {
            return this._emptyResult('source-fetch-error');
        }
    }

    async extractFromBlob(blob) {
        if (!blob) return this._emptyResult('no-blob');

        let bitmap = null;
        let canvas = null;
        try {
            bitmap = await createImageBitmap(blob);
            canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return this._emptyResult('no-2d-context');
            ctx.drawImage(bitmap, 0, 0);

            const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return this._extractPayloadFromRgba(data, canvas.width, canvas.height);
        } catch (_) {
            return this._emptyResult('decode-error');
        } finally {
            if (bitmap && typeof bitmap.close === 'function') {
                try { bitmap.close(); } catch (_) {}
            }
            if (canvas) {
                canvas.width = 0;
                canvas.height = 0;
            }
        }
    }

    _extractPayloadFromRgba(rgbaData, width, height) {
        let stream = '';
        for (let i = 0; i < rgbaData.length; i += 4) {
            const r = rgbaData[i];
            const g = rgbaData[i + 1];
            const b = rgbaData[i + 2];
            const byte = (r & 0x07) | ((g & 0x07) << 3) | ((b & 0x03) << 6);
            if (byte === 0) continue;
            stream += String.fromCharCode(byte);
        }

        const start = stream.indexOf(this.startToken);
        const end = stream.indexOf(this.endToken, start + this.startToken.length);

        if (start === -1 || end === -1 || end <= start) {
            return this._emptyResult('tokens-not-found', { start, end, width, height });
        }

        const rawPayload = stream.slice(start + this.startToken.length, end);
        if (!rawPayload || rawPayload.length === 0) {
            return this._emptyResult('empty-payload', { start, end, width, height });
        }

        const bytes = Uint8Array.from([...rawPayload].map((ch) => ch.charCodeAt(0)));
        let payload = rawPayload;
        try {
            payload = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        } catch (_) {
            payload = rawPayload;
        }

        return {
            hasMetadata: true,
            payload,
            payloadLength: payload.length,
            start,
            end,
            width,
            height,
            reason: null
        };
    }

    _emptyResult(reason, extra = {}) {
        return {
            hasMetadata: false,
            payload: null,
            payloadLength: 0,
            start: extra.start ?? -1,
            end: extra.end ?? -1,
            width: extra.width ?? null,
            height: extra.height ?? null,
            reason
        };
    }
}

