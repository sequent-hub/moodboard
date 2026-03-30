export function isV2ImageDownloadUrl(url) {
    if (typeof url !== 'string') return false;
    const raw = url.trim();
    if (!raw) return false;
    if (/^\/api\/v2\/images\/[^/]+\/download$/i.test(raw)) return true;
    try {
        const parsed = new URL(raw);
        return /^\/api\/v2\/images\/[^/]+\/download$/i.test(parsed.pathname);
    } catch (_) {
        return false;
    }
}

export function isV2FileDownloadUrl(url) {
    if (typeof url !== 'string') return false;
    const raw = url.trim();
    if (!raw) return false;
    if (/^\/api\/v2\/files\/[^/]+\/download$/i.test(raw)) return true;
    try {
        const parsed = new URL(raw);
        return /^\/api\/v2\/files\/[^/]+\/download$/i.test(parsed.pathname);
    } catch (_) {
        return false;
    }
}

