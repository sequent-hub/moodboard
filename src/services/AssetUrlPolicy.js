export function isV2ImageDownloadUrl(url) {
    return typeof url === 'string' && /^\/api\/v2\/images\/[^/]+\/download$/i.test(url.trim());
}

export function isV2FileDownloadUrl(url) {
    return typeof url === 'string' && /^\/api\/v2\/files\/[^/]+\/download$/i.test(url.trim());
}

