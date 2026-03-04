import { describe, it, expect, vi } from 'vitest';
import { BaseTool } from '../../src/tools/BaseTool.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Контрактные тесты для событий координатного контура в BaseTool.emit().
 *
 * Зачем это нужно:
 * - инструменты шлют события в core через BaseTool;
 * - если здесь сломается маппинг/нейминг, координатные данные перестанут доходить
 *   до обработчиков, а поведение "сломается" неявно.
 */
describe('BaseTool coordinate event routing', () => {
    it('emit("rotate:start") sends tool:rotate:start even without explicit map entry', () => {
        // В текущей реализации rotate:start не зашит в map2,
        // поэтому должен сработать fallback `tool:${name}`.
        const eventBus = { emit: vi.fn() };
        const tool = new BaseTool('select', eventBus);

        tool.emit('rotate:start', { object: 'obj-1' });

        expect(eventBus.emit).toHaveBeenCalledWith('tool:rotate:start', {
            tool: 'select',
            object: 'obj-1',
        });
    });

    it('emit("get:object:position") uses pass-through payload mutation contract', () => {
        // Для get:* событий важно, что payload передается "как есть",
        // чтобы слушатель мог мутировать объект-ответ.
        const eventBus = { emit: vi.fn() };
        const tool = new BaseTool('select', eventBus);
        const req = { objectId: 'obj-1', position: null };

        tool.emit('get:object:position', req);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.Tool.GetObjectPosition, req);
    });
});

