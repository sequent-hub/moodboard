import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Source-контракты для payload, формируемых в CoreMoodBoard.
 *
 * Эти тесты фиксируют проблемные места передачи координат в команды,
 * чтобы они были видны как явные провалы диагностики.
 */
describe('Core payload source contracts', () => {
    it('GroupResize snapshot position should be stored as top-left, not PIXI center', () => {
        // В state позиция хранится как top-left.
        // Если snapshot пишет pixi center, дальше легко получить
        // смешение систем координат в GroupResizeCommand.
        const source = readFileSync(resolve('src/core/index.js'), 'utf8');
        expect(source).not.toContain('position: { x: pixiObj.x, y: pixiObj.y }');
    });

    it('GroupRotateEnd toPos should not be written from raw PIXI center', () => {
        // В GroupRotateEnd команда получает toPos.
        // Контрактный риск: если toPos передается как raw pixi center,
        // а downstream трактует как top-left, будет смещение.
        const source = readFileSync(resolve('src/core/index.js'), 'utf8');
        expect(source).not.toContain('const toPos = { x: pixiObject.x, y: pixiObject.y };');
    });

    it('GroupRotateUpdate should not silently fallback to center {0,0}', () => {
        // Молчаливый fallback скрывает источник ошибки в цепочке start payload.
        // Для диагностики хотим фиксировать такие места как явный контрактный риск.
        const source = readFileSync(resolve('src/core/index.js'), 'utf8');
        expect(source).not.toContain('const center = this._groupRotateCenter || { x: 0, y: 0 };');
    });
});

