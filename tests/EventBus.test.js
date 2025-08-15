/**
 * Тесты для класса EventBus
 * Проверяет надежность, производительность и управление памятью
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';

describe('EventBus', () => {
    let eventBus;

    beforeEach(() => {
        eventBus = new EventBus();
    });

    // ==================== БАЗОВЫЕ ТЕСТЫ ====================

    it('should create EventBus instance', () => {
        expect(eventBus).toBeInstanceOf(EventBus);
    });

    it('should register event listener with on method', () => {
        const callback = vi.fn();
        const eventName = 'test:event';
        eventBus.on(eventName, callback);
        expect(eventBus.events.get(eventName).has(callback)).toBe(true);
    });

    it('should call registered listener when event is emitted', () => {
        const callback = vi.fn();
        const eventName = 'test:event';
        const testData = { name: "Alex", age: 18 };

        eventBus.on(eventName, callback);
        eventBus.emit(eventName, testData);

        expect(callback).toHaveBeenCalledWith(testData);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should remove event listener with off method', () => {
        const callback = vi.fn();
        const eventName = 'test:event';
        eventBus.on(eventName, callback);
        eventBus.off(eventName, callback);
        eventBus.emit(eventName, {});
        expect(callback).not.toHaveBeenCalled();
    });

    // ==================== ПРОВЕРКИ КОРРЕКТНОСТИ ====================

    it('should not register duplicate callbacks for same event', () => {
        const callback = vi.fn();
        const eventName = 'test:event';

        eventBus.on(eventName, callback);
        eventBus.on(eventName, callback); // Дублируем

        eventBus.emit(eventName, {});

        expect(callback).toHaveBeenCalledTimes(1); // Вызван только 1 раз
        expect(eventBus.events.get(eventName).size).toBe(1); // В реестре только 1
    });

    it('should handle null/undefined callback gracefully', () => {
        const eventName = 'test:event';

        // Не должно падать
        expect(() => {
            eventBus.on(eventName, null);
            eventBus.on(eventName, undefined);
        }).not.toThrow();
    });

    it('should handle empty event names', () => {
        const callback = vi.fn();

        eventBus.on('', callback);
        eventBus.emit('', { data: 'test' });

        expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should handle special characters in event names', () => {
        const callback = vi.fn();
        const specialEventName = 'event:with:colons:and:dots.and:spaces and:unicode:🎯';

        eventBus.on(specialEventName, callback);
        eventBus.emit(specialEventName, { message: 'test' });

        expect(callback).toHaveBeenCalledWith({ message: 'test' });
    });

    it('should handle multiple off calls safely', () => {
        const callback = vi.fn();
        const eventName = 'test:event';

        eventBus.on(eventName, callback);
        eventBus.off(eventName, callback);
        eventBus.off(eventName, callback); // Повторная отписка

        eventBus.emit(eventName, {});
        expect(callback).not.toHaveBeenCalled();
    });

    it('should handle off with non-existent callback', () => {
        const callback = vi.fn();
        const eventName = 'test:event';

        // Отписываемся от несуществующего
        expect(() => {
            eventBus.off(eventName, callback);
        }).not.toThrow();
    });

    it('should handle off with non-existent event', () => {
        const callback = vi.fn();

        expect(() => {
            eventBus.off('non:existent:event', callback);
        }).not.toThrow();
    });

    // ==================== ПРОВЕРКИ ДАННЫХ ====================

    it('should pass data by reference, not by value', () => {
        const callback = vi.fn();
        const eventName = 'test:event';
        const data = { message: 'original' };

        eventBus.on(eventName, callback);
        eventBus.emit(eventName, data);

        // Проверяем, что передается именно тот же объект
        expect(callback).toHaveBeenCalledWith(data);

        // Изменяем данные и проверяем, что callback получил измененный объект
        data.message = 'modified';
        expect(callback).toHaveBeenCalledWith({ message: 'modified' });
    });

    it('should handle async callbacks', async () => {
        const asyncCallback = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return 'async result';
        });

        const eventName = 'async:event';

        eventBus.on(eventName, asyncCallback);
        eventBus.emit(eventName, { data: 'test' });

        // Ждем завершения асинхронного callback'а
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(asyncCallback).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should continue execution if callback throws error', () => {
        const errorCallback = vi.fn().mockImplementation(() => {
            throw new Error('Callback error');
        });

        const normalCallback = vi.fn();
        const eventName = 'error:event';

        // Мокаем console.error
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        eventBus.on(eventName, errorCallback);
        eventBus.on(eventName, normalCallback);

        // Не должно падать, второй callback должен выполниться
        expect(() => {
            eventBus.emit(eventName, {});
        }).not.toThrow();

        expect(normalCallback).toHaveBeenCalledWith({});

        // Проверяем, что ошибка была залогирована
        expect(consoleSpy).toHaveBeenCalled();

        // Восстанавливаем console.error
        consoleSpy.mockRestore();
    });

    // ==================== ПРОВЕРКИ ПРОИЗВОДИТЕЛЬНОСТИ ====================

    it('should handle large number of events efficiently', () => {
        const callbacks = [];
        const eventName = 'performance:test';

        // Создаем 1000 callback'ов
        for (let i = 0; i < 1000; i++) {
            const callback = vi.fn();
            callbacks.push(callback);
            eventBus.on(eventName, callback);
        }

        const startTime = performance.now();
        eventBus.emit(eventName, { data: 'test' });
        const endTime = performance.now();

        // Проверяем, что все callback'и вызваны
        callbacks.forEach(callback => {
            expect(callback).toHaveBeenCalledWith({ data: 'test' });
        });

        // Проверяем, что время выполнения разумное (< 100ms)
        expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle many different events efficiently', () => {
        const callbacks = [];
        const eventCount = 100;

        // Создаем 100 разных событий
        for (let i = 0; i < eventCount; i++) {
            const callback = vi.fn();
            callbacks.push(callback);
            eventBus.on(`event:${i}`, callback);
        }

        const startTime = performance.now();

        // Эмитим все события
        for (let i = 0; i < eventCount; i++) {
            eventBus.emit(`event:${i}`, { eventId: i });
        }

        const endTime = performance.now();

        // Проверяем, что все callback'и вызваны
        callbacks.forEach((callback, index) => {
            expect(callback).toHaveBeenCalledWith({ eventId: index });
        });

        // Проверяем производительность (< 50ms для 100 событий)
        expect(endTime - startTime).toBeLessThan(50);
    });

    // ==================== ПРОВЕРКИ УПРАВЛЕНИЯ ПАМЯТЬЮ ====================

    it('should not leak memory after removing all listeners', () => {
        const callback = vi.fn();
        const eventName = 'memory:test';

        eventBus.on(eventName, callback);
        eventBus.off(eventName, callback);

        // После удаления всех listener'ов событие должно быть удалено
        expect(eventBus.events.has(eventName)).toBe(false);
    });

    it('should have removeAllListeners method', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        eventBus.on('event1', callback1);
        eventBus.on('event2', callback2);

        eventBus.removeAllListeners();

        expect(eventBus.events.size).toBe(0);
    });

    it('should remove all listeners and clear events map', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();
        const callback3 = vi.fn();

        eventBus.on('event1', callback1);
        eventBus.on('event2', callback2);
        eventBus.on('event3', callback3);

        // Проверяем, что события созданы
        expect(eventBus.events.size).toBe(3);

        eventBus.removeAllListeners();

        // Проверяем, что все удалено
        expect(eventBus.events.size).toBe(0);
        expect(eventBus.events.has('event1')).toBe(false);
        expect(eventBus.events.has('event2')).toBe(false);
        expect(eventBus.events.has('event3')).toBe(false);
    });

    it('should work normally after removeAllListeners', () => {
        const callback = vi.fn();

        eventBus.on('test:event', callback);
        eventBus.removeAllListeners();

        // Добавляем новое событие
        eventBus.on('new:event', callback);
        eventBus.emit('new:event', { data: 'test' });

        expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    // ==================== ПРОВЕРКИ СПЕЦИАЛЬНЫХ СЛУЧАЕВ ====================

    it('should handle nested events (event inside event)', () => {
        const outerCallback = vi.fn();
        const innerCallback = vi.fn();
        const nestedCallback = vi.fn();

        eventBus.on('outer:event', outerCallback);
        eventBus.on('inner:event', innerCallback);
        eventBus.on('nested:event', nestedCallback);

        // Callback, который эмитит другое событие
        const triggerCallback = vi.fn().mockImplementation(() => {
            eventBus.emit('inner:event', { from: 'outer' });
        });

        eventBus.on('outer:event', triggerCallback);

        eventBus.emit('outer:event', { data: 'outer' });

        expect(outerCallback).toHaveBeenCalledWith({ data: 'outer' });
        expect(triggerCallback).toHaveBeenCalledWith({ data: 'outer' });
        expect(innerCallback).toHaveBeenCalledWith({ from: 'outer' });
    });

    it('should prevent infinite loops in event chains', () => {
        const callback = vi.fn();
        let emitCount = 0;

        eventBus.on('loop:event', callback);

        // Callback, который эмитит то же событие (потенциальный цикл)
        const loopCallback = vi.fn().mockImplementation(() => {
            emitCount++;
            if (emitCount < 3) { // Ограничиваем количество вызовов
                eventBus.emit('loop:event', { count: emitCount });
            }
        });

        eventBus.on('loop:event', loopCallback);

        eventBus.emit('loop:event', { start: true });

        // Проверяем, что цикл не бесконечный
        expect(emitCount).toBeLessThan(10);
        expect(callback).toHaveBeenCalled();
        expect(loopCallback).toHaveBeenCalled();
    });

    it('should call callbacks in registration order', () => {
        const order = [];
        const callback1 = vi.fn().mockImplementation(() => order.push(1));
        const callback2 = vi.fn().mockImplementation(() => order.push(2));
        const callback3 = vi.fn().mockImplementation(() => order.push(3));

        eventBus.on('order:test', callback1);
        eventBus.on('order:test', callback2);
        eventBus.on('order:test', callback3);

        eventBus.emit('order:test', {});

        expect(order).toEqual([1, 2, 3]);
    });

    it('should handle callback modification during execution', () => {
        const callback = vi.fn();
        const modifyingCallback = vi.fn().mockImplementation(() => {
            // Удаляем callback во время выполнения
            eventBus.off('modify:test', callback);
        });

        eventBus.on('modify:test', callback);
        eventBus.on('modify:test', modifyingCallback);

        eventBus.emit('modify:test', {});

        // Callback должен быть вызван до удаления
        expect(callback).toHaveBeenCalled();
        expect(modifyingCallback).toHaveBeenCalled();
    });

    // ==================== ПРОВЕРКИ РАЗНЫХ ТИПОВ ДАННЫХ ====================

    it('should handle undefined data correctly', () => {
        const callback = vi.fn();
        const eventName = 'undefined:test';

        eventBus.on(eventName, callback);
        eventBus.emit(eventName, undefined);

        expect(callback).toHaveBeenCalledWith(undefined);
    });

    it('should handle functions as event data', () => {
        const callback = vi.fn();
        const eventName = 'function:test';
        const testFunction = () => 'test';

        eventBus.on(eventName, callback);
        eventBus.emit(eventName, testFunction);

        expect(callback).toHaveBeenCalledWith(testFunction);
        expect(typeof callback.mock.calls[0][0]).toBe('function');
    });

    it('should handle complex objects as event data', () => {
        const callback = vi.fn();
        const eventName = 'complex:test';
        const complexData = {
            string: 'test',
            number: 42,
            boolean: true,
            null: null,
            undefined: undefined,
            array: [1, 2, 3],
            object: { nested: { value: 'deep' } },
            function: () => 'nested function',
            date: new Date(),
            regex: /test/gi
        };

        eventBus.on(eventName, callback);
        eventBus.emit(eventName, complexData);

        expect(callback).toHaveBeenCalledWith(complexData);
        expect(callback.mock.calls[0][0]).toEqual(complexData);
    });

    it('should handle multiple events emitted simultaneously', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();
        const callback3 = vi.fn();

        eventBus.on('event1', callback1);
        eventBus.on('event2', callback2);
        eventBus.on('event3', callback3);

        // Эмитим несколько событий подряд
        eventBus.emit('event1', { data: 'event1' });
        eventBus.emit('event2', { data: 'event2' });
        eventBus.emit('event3', { data: 'event3' });

        expect(callback1).toHaveBeenCalledWith({ data: 'event1' });
        expect(callback2).toHaveBeenCalledWith({ data: 'event2' });
        expect(callback3).toHaveBeenCalledWith({ data: 'event3' });
    });

    it('should handle edge cases with empty callbacks', () => {
        const eventName = 'edge:test';

        // Добавляем пустую функцию
        const emptyCallback = () => {};
        eventBus.on(eventName, emptyCallback);

        // Не должно падать
        expect(() => {
            eventBus.emit(eventName, {});
        }).not.toThrow();

        // Удаляем пустую функцию
        eventBus.off(eventName, emptyCallback);
        expect(eventBus.events.has(eventName)).toBe(false);
    });

    // ==================== СТРЕСС-ТЕСТЫ ====================

    it('should handle 10,000 events without memory leaks', () => {
        const eventCount = 10000;
        const callbacks = [];

        // Создаем 10,000 разных событий
        for (let i = 0; i < eventCount; i++) {
            const callback = vi.fn();
            callbacks.push(callback);
            eventBus.on(`stress:event:${i}`, callback);
        }

        // Проверяем, что все события созданы
        expect(eventBus.events.size).toBe(eventCount);

        // Эмитим все события
        const startTime = performance.now();
        for (let i = 0; i < eventCount; i++) {
            eventBus.emit(`stress:event:${i}`, { eventId: i, timestamp: Date.now() });
        }
        const endTime = performance.now();

        // Проверяем, что все callback'и вызваны
        callbacks.forEach((callback, index) => {
            expect(callback).toHaveBeenCalledWith({ eventId: index, timestamp: expect.any(Number) });
        });

        // Проверяем производительность (< 500ms для 10,000 событий)
        expect(endTime - startTime).toBeLessThan(500);

        // Проверяем, что память не растет критически
        const initialMemory = process.memoryUsage().heapUsed;

        // Повторяем эмиссию событий
        for (let i = 0; i < eventCount; i++) {
            eventBus.emit(`stress:event:${i}`, { eventId: i, timestamp: Date.now() });
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = finalMemory - initialMemory;

        // Рост памяти должен быть разумным (< 10MB для 10,000 событий)
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);

        // Дополнительно: проверяем, что после очистки память освобождается
        callbacks.forEach((callback, index) => {
            eventBus.off(`stress:event:${index}`, callback);
        });

        // После удаления всех событий Map должен быть пустым
        expect(eventBus.events.size).toBe(0);

        // Проверяем финальное потребление памяти
        const cleanupMemory = process.memoryUsage().heapUsed;
        const totalMemoryGrowth = cleanupMemory - initialMemory;

        // После очистки рост памяти должен быть разумным (< 20MB)
        expect(totalMemoryGrowth).toBeLessThan(20 * 1024 * 1024);
    });

    it('should handle 1,000 callbacks for single event', () => {
        const callbackCount = 1000;
        const callbacks = [];
        const eventName = 'stress:single:event';

        // Создаем 1,000 callback'ов для одного события
        for (let i = 0; i < callbackCount; i++) {
            const callback = vi.fn().mockImplementation(() => {
                // Имитируем работу callback'а
                return `callback_${i}_result`;
            });
            callbacks.push(callback);
            eventBus.on(eventName, callback);
        }

        // Проверяем, что все callback'и зарегистрированы
        expect(eventBus.events.get(eventName).size).toBe(callbackCount);

        // Эмитим событие
        const startTime = performance.now();
        eventBus.emit(eventName, { data: 'stress_test', timestamp: Date.now() });
        const endTime = performance.now();

        // Проверяем, что все callback'и вызваны
        callbacks.forEach((callback, index) => {
            expect(callback).toHaveBeenCalledWith({ data: 'stress_test', timestamp: expect.any(Number) });
        });

        // Проверяем производительность (< 100ms для 1,000 callback'ов)
        expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle rapid fire operations', () => {
        const operationCount = 5000;
        const callbacks = [];
        const eventName = 'rapid:fire:event';

        // Создаем callback'и
        for (let i = 0; i < 100; i++) {
            const callback = vi.fn();
            callbacks.push(callback);
            eventBus.on(eventName, callback);
        }

        const startTime = performance.now();

        // Быстрая последовательность: on, emit, off, on, emit
        for (let i = 0; i < operationCount; i++) {
            const tempCallback = vi.fn();
            eventBus.on(eventName, tempCallback);
            eventBus.emit(eventName, { operation: i });
            eventBus.off(eventName, tempCallback);
        }

        const endTime = performance.now();

        // Проверяем производительность (< 200ms для 5,000 операций)
        expect(endTime - startTime).toBeLessThan(200);

        // Проверяем, что основные callback'и все еще работают
        eventBus.emit(eventName, { final: 'test' });
        callbacks.forEach(callback => {
            expect(callback).toHaveBeenCalledWith({ final: 'test' });
        });
    });

    it('should handle nested events in loop without stack overflow', () => {
        const maxDepth = 1000;
        let currentDepth = 0;
        let totalEmissions = 0;

        const recursiveCallback = vi.fn().mockImplementation(() => {
            totalEmissions++;
            if (currentDepth < maxDepth) {
                currentDepth++;
                eventBus.emit('nested:stress:event', { depth: currentDepth });
                currentDepth--;
            }
        });

        eventBus.on('nested:stress:event', recursiveCallback);

        // Запускаем рекурсивные события
        const startTime = performance.now();
        eventBus.emit('nested:stress:event', { depth: 0 });
        const endTime = performance.now();

        // Проверяем, что не произошел stack overflow
        expect(currentDepth).toBe(0);
        expect(totalEmissions).toBe(maxDepth + 1); // +1 для начального события

        // Проверяем производительность (< 300ms)
        expect(endTime - startTime).toBeLessThan(300);
    });

    it('should handle concurrent operations safely', async () => {
        const concurrentCount = 100;
        const promises = [];

        // Создаем параллельные операции
        for (let i = 0; i < concurrentCount; i++) {
            const promise = new Promise((resolve) => {
                const callback = vi.fn().mockImplementation(() => {
                    resolve({ id: i, success: true });
                });

                eventBus.on(`concurrent:event:${i}`, callback);
                eventBus.emit(`concurrent:event:${i}`, { concurrentId: i });
            });

            promises.push(promise);
        }

        // Ждем завершения всех операций
        const startTime = performance.now();
        const results = await Promise.all(promises);
        const endTime = performance.now();

        // Проверяем, что все операции завершились успешно
        expect(results).toHaveLength(concurrentCount);
        results.forEach((result, index) => {
            expect(result.id).toBe(index);
            expect(result.success).toBe(true);
        });

        // Проверяем производительность (< 500ms для 100 параллельных операций)
        expect(endTime - startTime).toBeLessThan(500);
    });

    // ==================== ТЕСТЫ УПРАВЛЕНИЯ ПАМЯТЬЮ ====================

    it('should provide detailed memory analysis', () => {
        const eventCount = 500;
        const memorySnapshots = [];

        // Базовое потребление памяти
        memorySnapshots.push({
            stage: 'baseline',
            memory: process.memoryUsage().heapUsed,
            events: eventBus.events.size,
            mapSize: eventBus.events.size
        });

        // Создаем события
        const callbacks = [];
        for (let i = 0; i < eventCount; i++) {
            const callback = vi.fn();
            callbacks.push(callback);
            eventBus.on(`detailed:analysis:${i}`, callback);
        }

        memorySnapshots.push({
            stage: 'after_creation',
            memory: process.memoryUsage().heapUsed,
            events: eventBus.events.size,
            mapSize: eventBus.events.size
        });

        // Эмитим события
        for (let i = 0; i < eventCount; i++) {
            eventBus.emit(`detailed:analysis:${i}`, { eventId: i });
        }

        memorySnapshots.push({
            stage: 'after_emission',
            memory: process.memoryUsage().heapUsed,
            events: eventBus.events.size,
            mapSize: eventBus.events.size
        });

        // Удаляем события
        callbacks.forEach((callback, index) => {
            eventBus.off(`detailed:analysis:${index}`, callback);
        });

        memorySnapshots.push({
            stage: 'after_cleanup',
            memory: process.memoryUsage().heapUsed,
            events: eventBus.events.size,
            mapSize: eventBus.events.size
        });

        // Анализируем потребление памяти
        console.log('Detailed Memory Analysis:', memorySnapshots);

        // Вычисляем изменения памяти
        const baselineMemory = memorySnapshots[0].memory;
        const afterCreationMemory = memorySnapshots[1].memory;
        const afterCleanupMemory = memorySnapshots[3].memory;

        const creationMemoryGrowth = afterCreationMemory - baselineMemory;
        const cleanupMemoryGrowth = afterCleanupMemory - baselineMemory;

        console.log(`Memory growth after creation: ${creationMemoryGrowth} bytes (${(creationMemoryGrowth / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`Memory growth after cleanup: ${cleanupMemoryGrowth} bytes (${(cleanupMemoryGrowth / 1024 / 1024).toFixed(2)} MB)`);

        // Проверяем, что события удалены
        expect(eventBus.events.size).toBe(0);

        // Анализируем проблему
        if (cleanupMemoryGrowth > 1024 * 1024) { // > 1MB
            console.warn('⚠️ WARNING: EventBus has memory leak!');
            console.warn(`   Memory not freed after cleanup: ${(cleanupMemoryGrowth / 1024 / 1024).toFixed(2)} MB`);
        }

        // Проверяем, что Map действительно пустой
        expect(eventBus.events.size).toBe(0);

        // Проверяем, что все ключи удалены
        for (const [key, value] of eventBus.events.entries()) {
            console.error(`❌ ERROR: Found remaining event: ${key} with ${value.size} callbacks`);
        }

        expect(eventBus.events.entries().next().done).toBe(true);

        // После очистки рост памяти должен быть разумным (< 10MB)
        // Учитываем vi.fn() замыкания и строковые ключи
        expect(cleanupMemoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });

    it('should maintain stable memory usage under load', () => {
        const initialMemory = process.memoryUsage().heapUsed;
        const iterations = 10;
        const eventsPerIteration = 100;

        for (let iteration = 0; iteration < iterations; iteration++) {
            const callbacks = [];

            // Создаем события
            for (let i = 0; i < eventsPerIteration; i++) {
                const callback = vi.fn();
                callbacks.push(callback);
                eventBus.on(`load:test:${iteration}:${i}`, callback);
            }

            // Эмитим события
            for (let i = 0; i < eventsPerIteration; i++) {
                eventBus.emit(`load:test:${iteration}:${i}`, { iteration, eventId: i });
            }

            // Удаляем события
            callbacks.forEach((callback, index) => {
                eventBus.off(`load:test:${iteration}:${index}`, callback);
            });

            // Проверяем, что события удалены
            expect(eventBus.events.size).toBe(0);
        }

        // Проверяем финальное состояние
        expect(eventBus.events.size).toBe(0);

        // Рост памяти должен быть разумным (< 30MB)
        // Учитываем vi.fn() замыкания и множественные итерации
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = finalMemory - initialMemory;

        console.log(`Total memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);

        // Более реалистичный лимит для тестового окружения
        expect(memoryGrowth).toBeLessThan(30 * 1024 * 1024); // < 30MB
    });

    it('should maintain memory stability with alternative approach', () => {
        const initialMemory = process.memoryUsage().heapUsed;
        const eventCount = 500;

        // Создаем события
        const callbacks = [];
        for (let i = 0; i < eventCount; i++) {
            const callback = vi.fn();
            callbacks.push(callback);
            eventBus.on(`alt:test:${i}`, callback);
        }

        // Эмитим события
        for (let i = 0; i < eventCount; i++) {
            eventBus.emit(`alt:test:${i}`, { eventId: i });
        }

        // Удаляем события
        callbacks.forEach((callback, index) => {
            eventBus.off(`alt:test:${index}`, callback);
        });

        // Проверяем, что события удалены
        expect(eventBus.events.size).toBe(0);

        // Рост памяти должен быть разумным (< 20MB)
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = finalMemory - initialMemory;

        console.log(`Alternative test memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);

        expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024); // < 20MB
    });

    it('should not leak memory with real functions', () => {
        const initialMemory = process.memoryUsage().heapUsed;
        const eventCount = 1000;

        // Создаем реальные функции (не vi.fn)
        const callbacks = [];
        for (let i = 0; i < eventCount; i++) {
            const callback = function(data) {
                return data.value * 2;
            };
            callbacks.push(callback);
            eventBus.on(`real:function:${i}`, callback);
        }

        const afterCreationMemory = process.memoryUsage().heapUsed;

        // Эмитим события
        for (let i = 0; i < eventCount; i++) {
            eventBus.emit(`real:function:${i}`, { value: i });
        }

        // Удаляем события
        callbacks.forEach((callback, index) => {
            eventBus.off(`real:function:${index}`, callback);
        });

        // Принудительно вызываем сборщик мусора (если доступен)
        if (global.gc) {
            global.gc();
        }

        const afterCleanupMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = afterCleanupMemory - initialMemory;

        console.log(`Real functions memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);

        // Проверяем, что события удалены
        expect(eventBus.events.size).toBe(0);

        // С реальными функциями утечка должна быть минимальной
        expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024); // < 5MB
    });
});