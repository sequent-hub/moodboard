import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import {
    VIDEO_GENERATOR_TYPE,
    VIDEO_FOOTER_HEIGHT,
    VIDEO_MIN_WIDTH,
    VIDEO_MIN_BODY_HEIGHT,
    VIDEO_RESULT_STATUS,
    normalizeVideoGeneratorProperties,
    createDefaultVideoGeneratorProperties,
    getVideoGeneratorPorts,
    getReadyVideoResult,
} from '../services/ai/videoGeneratorContract.js';
import {
    PORT_PROMPT,
    PORT_FIRST_FRAME,
    PORT_LAST_FRAME,
    PORT_VIDEO_REFERENCE,
    PORT_VIDEO_OUT,
    PORT_FIRST_FRAME_OUT,
    PORT_LAST_FRAME_OUT,
    PORT_ICON_SIZE,
    PORT_CHIP_SIZE,
} from '../services/ai/generatorPorts.js';
// Геометрия «cover» одна на оба узла — держим её в одном месте.
import { coverFit } from '../services/ai/imageGeneratorContract.js';
import TEXT_PORT_ICON from '../assets/icons/text-port.svg?raw';
import IMAGE_PORT_ICON from '../assets/icons/apps-image.svg?raw';
import VIDEO_PORT_ICON from '../assets/icons/video-port.svg?raw';

const CARD_RADIUS = 20;

const COLOR_CARD = 0xFFFFFF;
const COLOR_BORDER = 0xE2E8F0;
const COLOR_BODY_EMPTY = 0xF1F5F9;
const COLOR_BODY_PENDING = 0xE2E8F0;
const COLOR_BODY_ERROR = 0xFEE2E2;
const COLOR_TEXT_MUTED = 0x64748B;
const COLOR_TEXT_ERROR = 0xDC2626;

const COLOR_PORT_ICON = '#B1B1B7';
/** hsl(0 0% 93%) — подложка под иконкой порта. */
const COLOR_PORT_CHIP = 0xEDEDED;
const COLOR_PORT_CHIP_BORDER = 0x8566DC;
const PORT_CHIP_BORDER_ALPHA = 0.3;
const PORT_CHIP_BORDER_WIDTH = 2;
/** Скрытое состояние подложки: из него идёт анимация появления. */
const PORT_CHIP_HIDDEN_SCALE = 0.8;
const PORT_CHIP_ANIM_SEC = 0.2;

/**
 * Прозрачность иконки порта, который объявлен, но связь пока не принимает.
 * Порт остаётся на виду: пользователь должен видеть, куда узел будет расти.
 */
const PORT_DISABLED_ALPHA = 0.35;

/**
 * Во сколько раз растр иконки крупнее её экранного размера.
 * SVG в PIXI попадает уже растром: рисуем с запасом, иначе на зуме > 100%
 * иконка мылится.
 */
const PORT_ICON_RASTER_SCALE = 4;

/** Иконки портов: идентификатор порта → исходный SVG. Знак равен типу данных. */
const PORT_ICON_SOURCES = {
    [PORT_PROMPT]: TEXT_PORT_ICON,
    [PORT_FIRST_FRAME]: IMAGE_PORT_ICON,
    [PORT_LAST_FRAME]: IMAGE_PORT_ICON,
    [PORT_VIDEO_REFERENCE]: VIDEO_PORT_ICON,
    [PORT_VIDEO_OUT]: VIDEO_PORT_ICON,
    [PORT_FIRST_FRAME_OUT]: IMAGE_PORT_ICON,
    [PORT_LAST_FRAME_OUT]: IMAGE_PORT_ICON,
};

/** Общие на все узлы текстуры иконок портов. Ключ — сам SVG: один глиф даёт один растр. */
const portIconTextures = new Map();

/**
 * @param {string} portId
 * @returns {PIXI.Texture|null}
 */
function getPortIconTexture(portId) {
    const source = PORT_ICON_SOURCES[portId];
    if (!source) return null;
    if (portIconTextures.has(source)) return portIconTextures.get(source);

    const raster = PORT_ICON_SIZE * PORT_ICON_RASTER_SCALE;
    const svg = source
        .replace(/currentColor/g, COLOR_PORT_ICON)
        .replace(/width="[^"]*"/, `width="${raster}"`)
        .replace(/height="[^"]*"/, `height="${raster}"`);

    const texture = PIXI.Texture.from(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    portIconTextures.set(source, texture);
    return texture;
}

/**
 * VideoGeneratorObject — узел генерации видео.
 *
 * Устроен так же, как узел генерации изображения: результат занимает карточку
 * целиком, панель управления лежит поверх него и живёт в DOM-слое
 * VideoGeneratorControlsLayer. Отличие одно — в теле карточки видео, а не
 * картинка, поэтому кадр показывает HTMLVideoElement через видео-текстуру.
 *
 * Порты объявляются методом getConnectionPorts(): их читают слой якорей и
 * подсистема коннекторов. Порты, которые мост пока не обслуживает, объявлены
 * погашенными — видны, но связь не принимают.
 */
export class VideoGeneratorObject {
    constructor(objectData = {}) {
        this.objectData = objectData;

        this.width = Math.max(VIDEO_MIN_WIDTH, Math.round(objectData.width || objectData.properties?.width || 380));
        this.height = Math.max(
            VIDEO_MIN_BODY_HEIGHT,
            Math.round(objectData.height || objectData.properties?.height || 214)
        );

        this.properties = normalizeVideoGeneratorProperties({
            ...createDefaultVideoGeneratorProperties(),
            ...(objectData.properties || {}),
        });

        this.container = new PIXI.Container();
        this.container.eventMode = 'static';
        this.container.interactiveChildren = false;
        this.container.sortableChildren = false;

        this.cardGraphics = new PIXI.Graphics();
        this.container.addChild(this.cardGraphics);

        // Содержимое доходит до граней узла, поэтому скругление задаёт общая маска.
        this.bodyContainer = new PIXI.Container();
        this.container.addChild(this.bodyContainer);

        this.overlayGraphics = new PIXI.Graphics();
        this.bodyContainer.addChild(this.overlayGraphics);

        this.bodyMask = new PIXI.Graphics();
        this.container.addChild(this.bodyMask);
        this.bodyContainer.mask = this.bodyMask;

        this.hintText = new PIXI.Text('', this._textStyle(13, COLOR_TEXT_MUTED));
        this.hintText.anchor.set(0.5, 0.5);
        this.container.addChild(this.hintText);

        // Рамка поверх содержимого: кадр лежит вплотную к граням и закрыл бы контур.
        this.frameGraphics = new PIXI.Graphics();
        this.container.addChild(this.frameGraphics);

        this.videoEl = null;
        this.videoSprite = null;
        this._renderedVideoUrl = null;

        this.portChips = new Map();
        Object.keys(PORT_ICON_SOURCES).forEach((portId) => {
            this.portChips.set(portId, this._createPortChip(portId));
        });

        // Порты вынесены за габарит карточки и попали бы в локальные границы,
        // из которых считается позиция объекта и рамка выделения.
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
            type: VIDEO_GENERATOR_TYPE,
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
        return getVideoGeneratorPorts({ width: this.width, height: this.height });
    }

    updateSize(size) {
        if (!size) return;

        this.width = Math.max(VIDEO_MIN_WIDTH, Math.round(size.width || this.width));
        this.height = Math.max(VIDEO_MIN_BODY_HEIGHT, Math.round(size.height || this.height));

        this._redraw();
    }

    /**
     * Принимает частичное обновление properties из Events.Object.StateChanged.
     * @param {object} patch
     */
    applyProperties(patch = {}) {
        this.properties = normalizeVideoGeneratorProperties({
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
        this._releaseVideo();
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

    /** Область под результат — весь узел: кадр идёт от грани до грани. */
    _bodyRect() {
        return { x: 0, y: 0, width: Math.max(1, this.width), height: Math.max(1, this.height) };
    }

    _redraw() {
        const w = this.width;
        const h = this.height;

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
        // хит-тест считаем в локальных координатах.
        this.container.containsPoint = (point) => {
            const local = this.container.toLocal(point);
            return local.x >= 0 && local.x <= w && local.y >= 0 && local.y <= h;
        };
    }

    _renderBody() {
        const body = this._bodyRect();
        const ready = getReadyVideoResult(this.properties);

        this.overlayGraphics.clear();

        if (ready) {
            this._setHint('', COLOR_TEXT_MUTED, body);
            this._renderVideo(ready.videoUrl, body);
            return;
        }

        this._releaseVideo();

        const results = Array.isArray(this.properties.results) ? this.properties.results : [];
        const failed = results.find((r) => r.status === VIDEO_RESULT_STATUS.Error);
        const pending = results.some((r) => r.status === VIDEO_RESULT_STATUS.Pending);

        const color = failed ? COLOR_BODY_ERROR : (pending ? COLOR_BODY_PENDING : COLOR_BODY_EMPTY);
        this.overlayGraphics.beginFill(color, 1);
        this.overlayGraphics.drawRect(body.x, body.y, body.width, body.height);
        this.overlayGraphics.endFill();

        if (failed) {
            this._setHint(failed.error || 'Ошибка', COLOR_TEXT_ERROR, body);
            return;
        }

        if (pending) {
            this._setHint('Генерация…', COLOR_TEXT_MUTED, body);
            return;
        }

        this._setHint('Подключите текст или первый кадр и нажмите «Сгенерировать»', COLOR_TEXT_MUTED, body);
    }

    /**
     * Кадр результата: HTMLVideoElement под видео-текстурой.
     *
     * Элемент переиспользуется, пока ссылка не сменилась: пересоздание на каждом
     * перерисовывании (а оно идёт на каждом изменении размера) сбрасывало бы
     * воспроизведение и заново тянуло файл.
     *
     * @param {string} url
     * @param {{x: number, y: number, width: number, height: number}} body
     */
    _renderVideo(url, body) {
        if (this._renderedVideoUrl !== url) {
            this._releaseVideo();

            const video = document.createElement('video');
            video.src = url;
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';
            video.preload = 'auto';

            const sprite = new PIXI.Sprite(PIXI.Texture.from(video, { resourceOptions: { autoPlay: true } }));
            const mask = new PIXI.Graphics();
            sprite.mask = mask;

            this.bodyContainer.addChild(mask);
            this.bodyContainer.addChild(sprite);

            this.videoEl = video;
            this.videoSprite = sprite;
            this.videoMask = mask;
            this._renderedVideoUrl = url;

            video.addEventListener('loadeddata', () => {
                try { sprite.texture.update(); } catch (_) {}
                this._fitVideo();
            }, { once: true });

            const play = video.play();
            if (play && typeof play.catch === 'function') play.catch(() => {});
        }

        this._fitVideo(body);
    }

    /**
     * @param {{x: number, y: number, width: number, height: number}} [body]
     */
    _fitVideo(body = this._bodyRect()) {
        const sprite = this.videoSprite;
        if (!sprite || sprite.destroyed) return;

        const mask = this.videoMask;
        if (mask && !mask.destroyed) {
            mask.clear();
            mask.beginFill(0xFFFFFF, 1);
            mask.drawRect(body.x, body.y, body.width, body.height);
            mask.endFill();
        }

        const texW = sprite.texture?.width || 1;
        const texH = sprite.texture?.height || 1;
        const box = coverFit(texW, texH, body);

        sprite.width = box.width;
        sprite.height = box.height;
        sprite.position.set(body.x + box.x, body.y + box.y);
    }

    /** Останавливает видео и снимает спрайт: без этого элемент тикает текстуру дальше. */
    _releaseVideo() {
        if (this.videoEl) {
            try {
                this.videoEl.pause();
                this.videoEl.removeAttribute('src');
                this.videoEl.load();
            } catch (_) {}
            this.videoEl = null;
        }

        [this.videoSprite, this.videoMask].forEach((display) => {
            try {
                if (display && !display.destroyed) display.destroy({ children: true });
            } catch (_) {}
        });

        this.videoSprite = null;
        this.videoMask = null;
        this._renderedVideoUrl = null;
    }

    /** Подсказку центрируем по свободной части узла — без полосы под панелью. */
    _setHint(text, color, body) {
        this.hintText.text = text;
        this.hintText.style.fill = color;
        this.hintText.style.wordWrapWidth = Math.max(40, body.width - 32);
        this.hintText.position.set(
            body.x + body.width / 2,
            body.y + (body.height - VIDEO_FOOTER_HEIGHT) / 2
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
     * Иконка порта и подложка под ней. Геометрия от размеров узла не зависит,
     * поэтому рисуется один раз; порт двигает только позиция контейнера.
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
     * Растр SVG-текстуры готов не сразу: до загрузки texture.width равен 1.
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
     * Подсветка порта — круглая подложка под иконкой.
     *
     * Состояние приходит извне: PIXI-объект не знает ни про связи, ни про жест
     * коннектора. Погашенный порт не зажигается никогда — подложка обещала бы
     * привязку, которой не будет.
     *
     * @param {boolean} active
     * @param {string} [reason='connected'] источник подсветки
     * @param {string|null} [portId=null] конкретный порт или все входные
     */
    setPortHighlight(active, reason = 'connected', portId = null) {
        const ports = this.getConnectionPorts().filter((port) => port.enabled !== false);
        const entries = portId
            ? ports.filter((port) => port.id === portId).map((port) => this.portChips?.get(port.id))
            : ports.filter((port) => port.kind === 'input').map((port) => this.portChips?.get(port.id));

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
        this.getConnectionPorts().forEach((port) => {
            const entry = this.portChips?.get(port.id);
            if (!entry) return;

            entry.container.position.set(port.anchor.x * this.width, port.anchor.y * this.height);
            entry.container.alpha = port.enabled === false ? PORT_DISABLED_ALPHA : 1;
        });
    }
}
