import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import {
    IMAGE_GENERATOR_TYPE,
    GENERATOR_FOOTER_HEIGHT,
    GENERATOR_MIN_WIDTH,
    GENERATOR_MIN_BODY_HEIGHT,
    PORT_PROMPT,
    PORT_IMAGE_IN,
    PORT_ICON_SIZE,
    PORT_CHIP_SIZE,
    RESULT_STATUS,
    normalizeGeneratorProperties,
    createDefaultGeneratorProperties,
    migrateGeneratorSize,
    getGeneratorPorts,
    layoutResultCells,
    coverFit,
} from '../services/ai/imageGeneratorContract.js';
import TEXT_PORT_ICON from '../assets/icons/text-port.svg?raw';
import IMAGE_PORT_ICON from '../assets/icons/apps-image.svg?raw';

const CARD_RADIUS = 20;

const COLOR_CARD = 0xFFFFFF;
const COLOR_BORDER = 0xE2E8F0;
const COLOR_BODY_EMPTY = 0xF1F5F9;
const COLOR_BODY_PENDING = 0xE2E8F0;
const COLOR_TEXT_MUTED = 0x64748B;
const COLOR_TEXT_ERROR = 0xDC2626;
const COLOR_PORT_INPUT = 0x2563EB;
const COLOR_PORT_DISABLED = 0xCBD5E1;

const COLOR_PORT_ICON = '#B1B1B7';
/** hsl(0 0% 93%) — подложка под иконкой входного порта. */
const COLOR_PORT_CHIP = 0xEDEDED;
const COLOR_PORT_CHIP_BORDER = 0x8566DC;
const PORT_CHIP_BORDER_ALPHA = 0.3;
const PORT_CHIP_BORDER_WIDTH = 2;
/** Скрытое состояние подложки: из него идёт анимация появления. */
const PORT_CHIP_HIDDEN_SCALE = 0.8;
const PORT_CHIP_ANIM_SEC = 0.2;
/**
 * Во сколько раз растр иконки крупнее её экранного размера.
 * SVG в PIXI попадает уже растром: рисуем с запасом, иначе на зуме > 100%
 * иконка мылится.
 */
const PORT_ICON_RASTER_SCALE = 4;

/** Иконки входных портов: идентификатор порта → исходный SVG. */
const PORT_ICON_SOURCES = {
    [PORT_PROMPT]: TEXT_PORT_ICON,
    [PORT_IMAGE_IN]: IMAGE_PORT_ICON,
};

/** Общие на все узлы текстуры иконок портов. */
const portIconTextures = new Map();

/**
 * @param {string} portId
 * @returns {PIXI.Texture|null}
 */
function getPortIconTexture(portId) {
    if (portIconTextures.has(portId)) return portIconTextures.get(portId);

    const source = PORT_ICON_SOURCES[portId];
    if (!source) return null;

    const raster = PORT_ICON_SIZE * PORT_ICON_RASTER_SCALE;
    const svg = source
        .replace(/currentColor/g, COLOR_PORT_ICON)
        .replace(/width="[^"]*"/, `width="${raster}"`)
        .replace(/height="[^"]*"/, `height="${raster}"`);

    const texture = PIXI.Texture.from(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    portIconTextures.set(portId, texture);
    return texture;
}

/**
 * ImageGeneratorObject — узел генерации изображения по тексту.
 *
 * Результаты занимают карточку целиком (картинки идут в ряд, обрезка cover),
 * панель управления лежит поверх них. Интерактивные элементы (количество,
 * модель, соотношение, кнопка запуска) живут в DOM-слое
 * ImageGeneratorControlsLayer — в PIXI нет ни выпадающих списков, ни фокуса.
 * Подложку под панель рисует тот же DOM-слой: в PIXI её пришлось бы держать
 * поверх картинки и она перекрывала бы результат.
 *
 * Порты объявляются методом getConnectionPorts(): их читают слой якорей
 * и подсистема коннекторов.
 */
export class ImageGeneratorObject {
    constructor(objectData = {}) {
        this.objectData = objectData;

        // Узлы со старых досок хранят высоту с запасом на панель. Правку пишем
        // в сам объект состояния: DOM-слой панели строит свой бокс по размеру
        // из состояния, и при расхождении панель уехала бы ниже картинки.
        const migrated = migrateGeneratorSize(objectData);
        if (migrated) objectData.height = migrated.height;

        this.width = Math.max(GENERATOR_MIN_WIDTH, Math.round(objectData.width || objectData.properties?.width || 380));
        this.height = Math.max(
            GENERATOR_MIN_BODY_HEIGHT,
            Math.round(objectData.height || objectData.properties?.height || 300)
        );

        this.properties = normalizeGeneratorProperties({
            ...createDefaultGeneratorProperties(),
            ...(objectData.properties || {}),
        });

        this.container = new PIXI.Container();
        this.container.eventMode = 'static';
        this.container.interactiveChildren = false;
        this.container.sortableChildren = false;

        this.cardGraphics = new PIXI.Graphics();
        this.container.addChild(this.cardGraphics);

        // Содержимое доходит до самых граней узла, поэтому скругление углов
        // задаёт общая маска: рисовать каждую ячейку скруглённой нельзя —
        // округлились бы и внутренние стыки между результатами.
        this.bodyContainer = new PIXI.Container();
        this.container.addChild(this.bodyContainer);

        this.cellsContainer = new PIXI.Container();
        this.bodyContainer.addChild(this.cellsContainer);

        this.overlayGraphics = new PIXI.Graphics();
        this.bodyContainer.addChild(this.overlayGraphics);

        this.bodyMask = new PIXI.Graphics();
        this.container.addChild(this.bodyMask);
        this.bodyContainer.mask = this.bodyMask;

        this.hintText = new PIXI.Text('', this._textStyle(13, COLOR_TEXT_MUTED));
        this.hintText.anchor.set(0.5, 0.5);
        this.container.addChild(this.hintText);

        // Рамка идёт поверх содержимого: картинка лежит вплотную к граням и
        // закрыла бы контур, нарисованный вместе с подложкой.
        this.frameGraphics = new PIXI.Graphics();
        this.container.addChild(this.frameGraphics);

        this.portsGraphics = new PIXI.Graphics();
        this.container.addChild(this.portsGraphics);

        // Входные порты — иконка на круглой подложке. Подложка отдельным
        // объектом: анимация масштаба должна идти от её центра, а не от точки
        // порта, и не задевать иконку.
        this.portChips = new Map();
        Object.keys(PORT_ICON_SOURCES).forEach((portId) => {
            this.portChips.set(portId, this._createPortChip(portId));
        });

        // Порты вынесены за габарит карточки и попадают в локальные границы,
        // а из них считаются container.width/height → позиция объекта
        // (position = x − width/2) и рамка выделения уехали бы влево.
        // getBounds не трогаем: из него hover-lift берёт область фильтра.
        this.container.getLocalBounds = (rect) => {
            const bounds = rect || new PIXI.Rectangle();
            bounds.x = 0;
            bounds.y = 0;
            bounds.width = this.width;
            bounds.height = this.height;
            return bounds;
        };

        this.container._mb = {
            ...(this.container._mb || {}),
            type: IMAGE_GENERATOR_TYPE,
            instance: this,
            properties: { ...this.properties },
        };

        this._redraw();
    }

    getPixi() {
        return this.container;
    }

    getProperties() {
        return this.properties;
    }

    /**
     * Порты в нормализованных координатах bbox — источник истины для якорей связей.
     * @returns {Array<object>}
     */
    getConnectionPorts() {
        return getGeneratorPorts({ width: this.width, height: this.height });
    }

    updateSize(size) {
        if (!size) return;

        this.width = Math.max(GENERATOR_MIN_WIDTH, Math.round(size.width || this.width));
        this.height = Math.max(GENERATOR_MIN_BODY_HEIGHT, Math.round(size.height || this.height));

        this._redraw();
    }

    /**
     * Принимает частичное обновление properties из Events.Object.StateChanged.
     * @param {object} patch
     */
    applyProperties(patch = {}) {
        this.properties = normalizeGeneratorProperties({
            ...this.properties,
            ...patch,
            params: { ...(this.properties.params || {}), ...(patch.params || {}) },
        });

        if (this.container._mb) {
            this.container._mb.properties = {
                ...(this.container._mb.properties || {}),
                ...this.properties,
            };
        }

        this._redraw();
    }

    destroy() {
        this._destroySprites();
        this.portChips?.forEach((entry) => {
            if (entry.chip) gsap.killTweensOf([entry.chip, entry.chip.scale]);
        });
        try {
            this.container.destroy({ children: true });
        } catch (_) {}
        this.portChips?.clear();
        this.portChips = null;
    }

    _textStyle(fontSize, fill) {
        return {
            fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Arial, sans-serif',
            fontSize,
            fill,
            align: 'center',
            wordWrap: true,
            breakWords: true,
            wordWrapWidth: Math.max(40, this.width - 48),
            resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1,
        };
    }

    /** Область под результаты — весь узел: картинка идёт от грани до грани. */
    _bodyRect() {
        return {
            x: 0,
            y: 0,
            width: Math.max(1, this.width),
            height: Math.max(1, this.height),
        };
    }

    _redraw() {
        const w = this.width;
        const h = this.height;

        // Подложка видна в пустом узле и в зазорах между результатами.
        const g = this.cardGraphics;
        g.clear();
        g.beginFill(COLOR_CARD, 1);
        g.drawRoundedRect(0, 0, w, h, CARD_RADIUS);
        g.endFill();

        const mask = this.bodyMask;
        mask.clear();
        mask.beginFill(0xFFFFFF, 1);
        mask.drawRoundedRect(0, 0, w, h, CARD_RADIUS);
        mask.endFill();

        this._renderBody();

        const frame = this.frameGraphics;
        frame.clear();
        frame.lineStyle({ width: 1, color: COLOR_BORDER, alignment: 0.5 });
        frame.drawRoundedRect(0.5, 0.5, w - 1, h - 1, CARD_RADIUS);

        this._renderPorts();

        this.container.pivot.set(w / 2, h / 2);
        this.container.hitArea = new PIXI.Rectangle(0, 0, w, h);
        // Порты вынесены за габарит карточки и попадают в getBounds(), поэтому
        // хит-тест считаем в локальных координатах — иначе клик рядом с портом
        // выделял бы карточку.
        this.container.containsPoint = (point) => {
            const local = this.container.toLocal(point);
            return local.x >= 0 && local.x <= w && local.y >= 0 && local.y <= h;
        };
    }

    _renderBody() {
        const body = this._bodyRect();
        const results = Array.isArray(this.properties.results) ? this.properties.results : [];

        this._destroySprites();
        this.overlayGraphics.clear();
        this.cellsContainer.position.set(body.x, body.y);

        if (results.length === 0) {
            this.overlayGraphics.beginFill(COLOR_BODY_EMPTY, 1);
            this.overlayGraphics.drawRect(body.x, body.y, body.width, body.height);
            this.overlayGraphics.endFill();

            this._setHint('Подключите текстовые объекты и нажмите «Сгенерировать»', COLOR_TEXT_MUTED, body);
            return;
        }

        this._setHint('', COLOR_TEXT_MUTED, body);

        const cells = layoutResultCells(results.length, body.width, body.height);

        results.forEach((result, index) => {
            const cell = cells[index];
            if (!cell) return;

            if (result.status === RESULT_STATUS.Done && result.imageUrl) {
                this._renderImageCell(result.imageUrl, cell);
                return;
            }

            const color = result.status === RESULT_STATUS.Error ? 0xFEE2E2 : COLOR_BODY_PENDING;
            this.overlayGraphics.beginFill(color, 1);
            this.overlayGraphics.drawRect(body.x + cell.x, body.y + cell.y, cell.width, cell.height);
            this.overlayGraphics.endFill();

            const label = result.status === RESULT_STATUS.Error
                ? (result.error || 'Ошибка')
                : 'Генерация…';
            this._addCellLabel(label, cell, result.status === RESULT_STATUS.Error ? COLOR_TEXT_ERROR : COLOR_TEXT_MUTED);
        });
    }

    _renderImageCell(url, cell) {
        const texture = PIXI.Texture.from(url);
        const sprite = new PIXI.Sprite(texture);

        // Обрезка cover выходит за ячейку: без маски широкий кадр залезал бы
        // на соседний результат. Углы узла скругляет общая маска тела.
        const mask = new PIXI.Graphics();
        mask.beginFill(0xFFFFFF, 1);
        mask.drawRect(cell.x, cell.y, cell.width, cell.height);
        mask.endFill();

        sprite.mask = mask;
        this.cellsContainer.addChild(mask);
        this.cellsContainer.addChild(sprite);
        this._sprites.push(sprite);

        const fit = () => {
            const texW = sprite.texture?.width || 1;
            const texH = sprite.texture?.height || 1;
            const box = coverFit(texW, texH, cell);
            sprite.width = box.width;
            sprite.height = box.height;
            sprite.position.set(cell.x + box.x, cell.y + box.y);
        };

        if (texture.baseTexture?.valid) {
            fit();
        } else {
            const onLoaded = () => fit();
            texture.baseTexture?.once('loaded', onLoaded);
            texture.baseTexture?.once('update', onLoaded);
            texture.baseTexture?.once('error', () => {
                sprite.texture = PIXI.Texture.WHITE;
                sprite.tint = 0xCBD5E1;
                fit();
            });
        }
    }

    _addCellLabel(text, cell, color) {
        const body = this._bodyRect();
        const label = new PIXI.Text(text, {
            ...this._textStyle(12, color),
            wordWrapWidth: Math.max(40, cell.width - 16),
        });
        label.anchor.set(0.5, 0.5);
        label.position.set(
            body.x + cell.x + cell.width / 2,
            body.y + cell.y + (cell.height - GENERATOR_FOOTER_HEIGHT) / 2
        );
        this.container.addChild(label);
        this._labels.push(label);
    }

    /** Подсказку центрируем по свободной части узла — без полосы под панелью. */
    _setHint(text, color, body) {
        this.hintText.text = text;
        this.hintText.style.fill = color;
        this.hintText.style.wordWrapWidth = Math.max(40, body.width - 32);
        this.hintText.position.set(
            body.x + body.width / 2,
            body.y + (body.height - GENERATOR_FOOTER_HEIGHT) / 2
        );
        this.hintText.visible = Boolean(text);
    }

    /**
     * @param {string} portId
     * @returns {{container: PIXI.Container, chip: PIXI.Graphics, icon: PIXI.Sprite, highlighted: boolean, reasons: Set<string>}}
     */
    _createPortChip(portId) {
        const container = new PIXI.Container();
        const chip = new PIXI.Graphics();
        const icon = new PIXI.Sprite(getPortIconTexture(portId));
        icon.anchor.set(0.5);

        container.addChild(chip);
        container.addChild(icon);
        this.container.addChild(container);

        const entry = { container, chip, icon, highlighted: false, reasons: new Set() };
        this._drawPortChip(entry);

        return entry;
    }

    /**
     * Иконка входного порта и подложка под ней. Геометрия от размеров узла не
     * зависит, поэтому рисуется один раз; порт двигает только позиция контейнера.
     *
     * @param {object} entry
     */
    _drawPortChip(entry) {
        const radius = PORT_CHIP_SIZE / 2 - PORT_CHIP_BORDER_WIDTH / 2;
        const g = entry.chip;

        g.clear();
        g.lineStyle({
            width: PORT_CHIP_BORDER_WIDTH,
            color: COLOR_PORT_CHIP_BORDER,
            alpha: PORT_CHIP_BORDER_ALPHA,
            alignment: 0.5,
        });
        g.beginFill(COLOR_PORT_CHIP, 1);
        g.drawCircle(0, 0, radius);
        g.endFill();

        g.alpha = 0;
        g.scale.set(PORT_CHIP_HIDDEN_SCALE);

        this._fitPortIcon(entry);
    }

    /**
     * Растр SVG-текстуры готов не сразу: до загрузки texture.width равен 1, и
     * заданный по нему размер спрайта пришлось бы пересчитывать после загрузки.
     *
     * @param {object} entry
     */
    _fitPortIcon(entry) {
        const sprite = entry.icon;
        if (!sprite) return;

        const apply = () => {
            if (sprite.destroyed) return;
            sprite.width = PORT_ICON_SIZE;
            sprite.height = PORT_ICON_SIZE;
        };

        apply();

        const base = sprite.texture?.baseTexture;
        if (base && !base.valid) {
            base.once('loaded', apply);
            base.once('update', apply);
        }
    }

    /**
     * Подсветка входного порта — круглая подложка под иконкой.
     *
     * Состояние приходит извне: PIXI-объект не знает ни про связи, ни про
     * жест коннектора. Причины независимы: подключённый коннектор
     * (`connected`, выставляет ConnectionAnchorsLayer) и наведение
     * протягиваемой связи (`connector`). Без учёта источника слой якорей
     * гасил бы подложку, зажжённую перетаскиванием, на своём update().
     *
     * Без portId подсветка идёт на все входные порты: жест коннектора наводится
     * на узел целиком и заранее не знает, в какой порт попадёт связь.
     *
     * @param {boolean} active
     * @param {string} [reason='connected'] источник подсветки
     * @param {string|null} [portId=null] конкретный порт или все входные
     */
    setPortHighlight(active, reason = 'connected', portId = null) {
        const entries = portId
            ? [this.portChips?.get(portId)]
            : Array.from(this.portChips?.values() || []);

        entries.forEach((entry) => {
            if (entry) this._applyPortHighlight(entry, active, reason);
        });
    }

    /**
     * @param {object} entry
     * @param {boolean} active
     * @param {string} reason
     */
    _applyPortHighlight(entry, active, reason) {
        if (active) {
            entry.reasons.add(reason);
        } else {
            entry.reasons.delete(reason);
        }

        const on = entry.reasons.size > 0;
        if (on === entry.highlighted) return;
        entry.highlighted = on;

        const chip = entry.chip;
        if (!chip || chip.destroyed) return;

        const scale = on ? 1 : PORT_CHIP_HIDDEN_SCALE;
        gsap.killTweensOf([chip, chip.scale]);
        gsap.to(chip, { alpha: on ? 1 : 0, duration: PORT_CHIP_ANIM_SEC, ease: 'power1.inOut' });
        gsap.to(chip.scale, { x: scale, y: scale, duration: PORT_CHIP_ANIM_SEC, ease: 'power1.inOut' });
    }

    _renderPorts() {
        const g = this.portsGraphics;
        g.clear();

        this.getConnectionPorts().forEach((port) => {
            const x = port.anchor.x * this.width;
            const y = port.anchor.y * this.height;

            // Входные порты рисуются иконкой с подложкой (_drawPortChip),
            // без кружка и ножки до кромки карточки.
            const chip = this.portChips?.get(port.id);
            if (chip) {
                chip.container.visible = port.enabled !== false;
                chip.container.position.set(x, y);
                return;
            }

            const fill = port.enabled ? COLOR_PORT_INPUT : COLOR_PORT_DISABLED;

            // Порт вынесен наружу: ножка до грани показывает, чей это порт.
            if (x < 0 || x > this.width) {
                g.lineStyle({ width: 1.5, color: fill, alignment: 0.5 });
                g.moveTo(x < 0 ? 0 : this.width, y);
                g.lineTo(x, y);
            }

            g.lineStyle({ width: 2, color: COLOR_CARD, alignment: 0.5 });
            g.beginFill(fill, 1);
            g.drawCircle(x, y, 6);
            g.endFill();
        });
    }

    _destroySprites() {
        if (!this._sprites) this._sprites = [];
        if (!this._labels) this._labels = [];

        this._sprites.forEach((sprite) => {
            try {
                if (sprite.mask) sprite.mask.destroy();
                sprite.destroy({ children: true, texture: false, baseTexture: false });
            } catch (_) {}
        });
        this._sprites = [];

        this._labels.forEach((label) => {
            try {
                label.destroy();
            } catch (_) {}
        });
        this._labels = [];

        this.cellsContainer.removeChildren();
    }
}
