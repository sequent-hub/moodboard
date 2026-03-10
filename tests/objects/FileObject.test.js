import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('pixi.js', () => {
    const createGraphics = () => ({
        clear: vi.fn(), beginFill: vi.fn(), endFill: vi.fn(), drawRect: vi.fn(),
        drawRoundedRect: vi.fn(), lineStyle: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
        x: 0, y: 0, alpha: 1, filters: null,
    });
    const createText = (content, style) => ({
        text: content || '', anchor: { set: vi.fn(), x: 0, y: 0 }, x: 0, y: 0,
        style: { wordWrap: false, breakWords: false, wordWrapWidth: 0, ...style },
        updateText: vi.fn(), destroy: vi.fn(), height: 12, width: 50,
    });
    const createContainer = () => {
        const children = [];
        const c = {
            addChild: vi.fn((child) => { children.push(child); if (child) child.parent = c; }),
            removeChild: vi.fn((child) => {
                const i = children.indexOf(child);
                if (i >= 0) children.splice(i, 1);
                if (child) child.parent = null;
                return child;
            }),
            get children() { return children; },
            pivot: { set: vi.fn(), x: 0, y: 0 }, hitArea: null, containsPoint: null,
            eventMode: 'none', interactiveChildren: false,
            getBounds: vi.fn(() => ({ x: 0, y: 0, width: 120, height: 140 })),
            _mb: null,
        };
        return c;
    };

    const Graphics = vi.fn().mockImplementation(createGraphics);
    const Text = vi.fn().mockImplementation((content, style) => createText(content, style));
    const Rectangle = vi.fn().mockImplementation((x, y, w, h) => ({ x, y, width: w, height: h }));

    const Container = vi.fn().mockImplementation(createContainer);

    return {
        Container,
        Graphics,
        Text,
        Rectangle,
        filters: { BlurFilter: vi.fn(() => ({})) },
    };
});

import { FileObject } from '../../src/objects/FileObject.js';

describe('FileObject', () => {
    describe('_redraw / _drawFileIcon', () => {
        it('повторные вызовы _redraw не накапливают extensionText (нет утечки)', () => {
            const obj = new FileObject({
                properties: { fileName: 'doc.pdf', fileSize: 1024 },
                width: 120,
                height: 140,
            });

            const countBefore = obj.container.children.length;

            for (let i = 0; i < 5; i++) {
                obj.updateSize({ width: 120, height: 140 });
            }

            const countAfter = obj.container.children.length;
            expect(countAfter).toBe(countBefore);
        });

        it('_formatFileSize форматирует размеры корректно', () => {
            const obj = new FileObject({ properties: { fileName: 'x.txt' } });
            expect(obj._formatFileSize(0)).toBe('0 B');
            expect(obj._formatFileSize(500)).toBe('500 B');
            expect(obj._formatFileSize(1024)).toBe('1 KB');
            expect(obj._formatFileSize(1536)).toBe('1.5 KB');
        });

        it('_getIconColor возвращает цвет по расширению', () => {
            const obj = new FileObject({ properties: { fileName: 'doc.pdf' } });
            const pdfColor = obj._getIconColor('pdf');
            expect(typeof pdfColor).toBe('number');
            expect(pdfColor).toBe(0xdc2626);
        });
    });
});
