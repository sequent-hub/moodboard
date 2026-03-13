import { execSync } from 'node:child_process';

const TEST_TARGETS = [
    'tests/grid/ScreenIntegerContract.grid.test.js',
    'tests/ui/PixelPerfectIntegerContract.overlays.test.js',
    'tests/services/PixelPerfectIntegerContract.viewport.test.js',
];

try {
    const command = `npx vitest run ${TEST_TARGETS.join(' ')}`;
    execSync(command, { stdio: 'inherit' });
} catch (error) {
    process.exit(error?.status || 1);
}
