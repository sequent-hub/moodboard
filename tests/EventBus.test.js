// tests/EventBus.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';

describe('EventBus', () => {
    let eventBus;

    beforeEach(() => {
        eventBus = new EventBus();
    });

    it('should create EventBus instance', () => {
        expect(eventBus).toBeInstanceOf(EventBus);
    });
});