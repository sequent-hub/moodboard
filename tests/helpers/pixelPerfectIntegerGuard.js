function formatValue(value) {
    return Number.isFinite(value) ? String(value) : JSON.stringify(value);
}

export function createIntegerGuard(scope) {
    const records = [];

    const collect = (name, value) => {
        records.push({ name, value });
    };

    const collectPair = (prefix, point) => {
        if (!point || typeof point !== 'object') return;
        collect(`${prefix}.x`, point.x);
        collect(`${prefix}.y`, point.y);
    };

    const assertNoFractions = () => {
        const issues = records.filter(({ value }) => !Number.isInteger(value));
        if (issues.length === 0) return;
        const details = issues
            .map(({ name, value }) => `${name}=${formatValue(value)}`)
            .join(', ');
        throw new Error(`[${scope}] fractional screen-space values detected: ${details}`);
    };

    return {
        collect,
        collectPair,
        assertNoFractions,
    };
}
