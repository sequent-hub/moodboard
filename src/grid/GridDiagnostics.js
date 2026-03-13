const GLOBAL_DIAG_KEY = '__MOODBOARD_GRID_DIAGNOSTICS__';
const MAX_HISTORY = 500;

function getGlobalScope() {
    try {
        return globalThis;
    } catch (_) {
        return null;
    }
}

function normalizeEnabled(raw) {
    if (raw === true || raw === '1' || raw === 1) return true;
    if (raw === false || raw === '0' || raw === 0) return false;
    return false;
}

function ensureSink() {
    const scope = getGlobalScope();
    if (!scope) return null;
    const existing = scope[GLOBAL_DIAG_KEY];
    if (existing && typeof existing === 'object') {
        if (typeof existing.enabled !== 'boolean') existing.enabled = false;
        if (!existing.counters || typeof existing.counters !== 'object') existing.counters = {};
        if (!Array.isArray(existing.history)) existing.history = [];
        return existing;
    }
    const created = {
        enabled: false,
        counters: {},
        history: [],
    };
    scope[GLOBAL_DIAG_KEY] = created;
    return created;
}

export function isGridDiagnosticsEnabled() {
    const envEnabled = normalizeEnabled(
        (typeof process !== 'undefined' && process?.env?.MOODBOARD_GRID_DIAGNOSTICS) || false
    );
    if (envEnabled) return true;
    const sink = ensureSink();
    return !!sink?.enabled;
}

export function incrementGridDiagnosticCounter(counterName) {
    if (!counterName || !isGridDiagnosticsEnabled()) return;
    const sink = ensureSink();
    if (!sink) return;
    sink.counters[counterName] = (sink.counters[counterName] || 0) + 1;
}

export function logGridDiagnostic(scope, message, data = undefined) {
    if (!isGridDiagnosticsEnabled()) return;
    const sink = ensureSink();
    if (!sink) return;

    const entry = {
        ts: Date.now(),
        scope,
        message,
        data,
    };
    sink.history.push(entry);
    if (sink.history.length > MAX_HISTORY) {
        sink.history.splice(0, sink.history.length - MAX_HISTORY);
    }
}

export function getGridDiagnosticsSnapshot() {
    const sink = ensureSink();
    if (!sink) {
        return { enabled: false, counters: {}, history: [] };
    }
    return {
        enabled: !!sink.enabled,
        counters: { ...sink.counters },
        history: [...sink.history],
    };
}
