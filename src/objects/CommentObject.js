import * as PIXI from 'pixi.js';

/**
 * CommentObject — круглый маркер комментария с равнобедренным хвостиком в юго-западной области
 * Свойства (properties):
 * - fill?: number — цвет заливки формы
 * - stroke?: number — цвет обводки (по умолчанию тот же, что и fill)
 */
export class CommentObject {
    constructor(objectData = {}) {
        this.objectData = objectData;
        this.width = objectData.width || objectData.properties?.width || 72;
        this.height = objectData.height || objectData.properties?.height || 72;
        // Цвет по умолчанию — #B388FF
        const props = objectData.properties || {};
        this.fill = (typeof props.fill === 'number') ? props.fill : 0xB388FF;
        this.stroke = (typeof props.stroke === 'number') ? props.stroke : this.fill;

        // Основная графика формы
        this.graphics = new PIXI.Graphics();
        this.graphics._mb = {
            ...(this.graphics._mb || {}),
            type: 'comment',
            properties: { ...objectData.properties }
        };

        // Текстовая метка внутри (буква "A")
        this.label = new PIXI.Text('A', {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
            fontSize: 24,
            fontWeight: '700',
            fill: 0xFAFAFA,
            align: 'center',
            resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1
        });
        this.label.anchor.set(0.5);
        this.graphics.addChild(this.label);

        this._redraw();
    }

    getPixi() {
        return this.graphics;
    }

    updateSize(size) {
        if (!size) return;
        this.width = Math.max(12, size.width || this.width);
        this.height = Math.max(12, size.height || this.height);
        this._redraw();
    }

    _redraw() {
        const g = this.graphics;
        const w = this.width;
        const h = this.height;
        g.clear();

        // Круг
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.max(6, Math.min(w, h) / 2 - 4);

        // Помощник: точка на окружности с учётом экранной оси Y (вниз положительно)
        const pOnCircle = (deg, radius) => {
            const rad = (deg * Math.PI) / 180;
            return {
                x: cx + radius * Math.cos(rad),
                y: cy - radius * Math.sin(rad)
            };
        };

        // Хвостик: равнобедренный треугольник, направленный на 225° (юго-запад)
        const dir = 225; // центральное направление
        const baseHalf = 16; // половина угла основания
        const baseR = r * 0.94; // основание внутри круга, чтобы скрывалось
        const apexExtra = r * 0.45; // длина хвостика за пределы круга

        const b1 = pOnCircle(dir - baseHalf, baseR);
        const b2 = pOnCircle(dir + baseHalf, baseR);
        let apex = pOnCircle(dir, r + apexExtra);
        // Гарантируем, что вершина остаётся в пределах bbox объекта
        apex.x = Math.max(2, Math.min(w - 2, apex.x));
        apex.y = Math.max(2, Math.min(h - 2, apex.y));

        // 1) Рисуем треугольник хвостика (без обводки)
        g.beginFill(this.fill, 1);
        g.moveTo(b1.x, b1.y);
        g.lineTo(apex.x, apex.y);
        g.lineTo(b2.x, b2.y);
        g.closePath();
        g.endFill();

        // 2) Круг поверх
        g.lineStyle(2, this.stroke, 1);
        g.beginFill(this.fill, 1);
        g.drawCircle(cx, cy, r);
        g.endFill();

        // 3) Внутренний круг (на ~20% меньше)
        const innerR = Math.max(1, r * 0.8);
        g.lineStyle(0);
        g.beginFill(0x424242, 1);
        g.drawCircle(cx, cy, innerR);
        g.endFill();

        // 4) Текстовая метка в центре
        const targetFontSize = Math.round(innerR * 0.9);
        this.label.style.fill = 0xFAFAFA;
        this.label.style.fontSize = targetFontSize;
        this.label.position.set(cx, cy);
    }
}


