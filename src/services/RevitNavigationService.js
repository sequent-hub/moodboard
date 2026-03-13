export class RevitNavigationService {
    constructor(_logger = console, options = {}) {
        this.host = options.host || '127.0.0.1';
        this.portStart = Number.isFinite(options.portStart) ? options.portStart : 11210;
        this.portEnd = Number.isFinite(options.portEnd) ? options.portEnd : 11220;
        this.requestTimeoutMs = Number.isFinite(options.requestTimeoutMs) ? options.requestTimeoutMs : 1500;
    }

    async showInModel(payload, _context = {}) {
        if (!payload || typeof payload !== 'string') {
            return { ok: false, reason: 'invalid-payload', attempts: [] };
        }

        const attempts = [];
        for (let port = this.portStart; port <= this.portEnd; port += 1) {
            const url = `http://${this.host}:${port}`;
            const result = await this._postWithTimeout(url, payload);
            attempts.push({ port, ...result });
            if (result.ok) {
                return { ok: true, port, attempts };
            }
        }

        return { ok: false, reason: 'no-port-accepted', attempts };
    }

    async _postWithTimeout(url, payload) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            try { controller.abort(); } catch (_) {}
        }, this.requestTimeoutMs);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: payload,
                signal: controller.signal
            });
            const responseText = await response.text().catch(() => '');
            return {
                ok: response.ok,
                status: response.status,
                responsePreview: responseText.slice(0, 120)
            };
        } catch (error) {
            return {
                ok: false,
                status: null,
                error: error?.message || String(error)
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

