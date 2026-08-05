import { Events } from '../../core/events/Events.js';
import { HandlesPositioningService } from '../handles/HandlesPositioningService.js';
import { IMAGE_MODELS, getImageModelCapability } from '../../services/ai/imageModelCapabilities.js';
import { GENERATOR_RUN_EVENT } from '../../services/ai/ImageGeneratorRunner.js';
import { commitGeneratorUpdates } from '../../services/ai/imageGeneratorState.js';
import { ICONS, RATIO_ICONS, COUNT_ICONS } from '../chat/icons.js';
import RUN_PLAY_ICON from '../../assets/icons/circle-play.svg?raw';
import RUN_REFRESH_ICON from '../../assets/icons/refresh.svg?raw';
import {
    IMAGE_GENERATOR_TYPE,
    GENERATOR_RATIOS,
    GENERATOR_MAX_COUNT,
    RESULT_STATUS,
    normalizeGeneratorProperties,
    clampCount,
    isGeneratorRunning,
    getGeneratorError,
    heightForRatio,
} from '../../services/ai/imageGeneratorContract.js';

/** Ниже этого масштаба элементы управления не читаются — прячем их. */
const MIN_VISIBLE_SCALE = 0.35;

/** Сколько иконок формата помещается в строку выпадающей сетки. */
const RATIO_MENU_COLUMNS = 5;

/**
 * Сколько кадров ждём появления PIXI-объекта в реестре сцены, прежде чем сдаться.
 * Объект может не появиться вовсе (создание упало), поэтому повтор ограничен.
 */
const GEOMETRY_RETRY_FRAMES = 60;

/**
 * DOM-слой с элементами управления узла-генератора.
 *
 * В PIXI нет ни выпадающих списков, ни фокуса, ни доступности, поэтому нижняя
 * панель карточки (количество, модель, соотношение, кнопка запуска) живёт в DOM
 * поверх канваса и синхронизируется с миром по тем же событиям, что и рамка
 * выделения. Подложку панели рисует сам объект — здесь только органы управления.
 *
 * Значения выбираются пилюлей с выпадающим меню (как в окне чата), а не через
 * <select>: нативный список не умеет показывать иконки форматов и количества.
 */
export class ImageGeneratorControlsLayer {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;

        this.layer = null;
        this.positioningService = new HandlesPositioningService(this);

        this._nodes = new Map();
        this._signatures = new Map();
        this.subscriptions = [];
        this._eventsAttached = false;
        this._activeMenu = null;
        this._geometryRetryHandle = null;
        this._geometryRetryFrames = 0;

        this._onDocumentPointerDown = (event) => {
            if (!this._activeMenu) return;
            if (this._activeMenu.control.contains(event.target)) return;
            this._closeMenu();
        };
        this._onDocumentKeyDown = (event) => {
            if (event.key === 'Escape') this._closeMenu();
        };
    }

    attach() {
        if (!this.layer) {
            this.layer = document.createElement('div');
            this.layer.className = 'mb-imgen-layer';
            Object.assign(this.layer.style, {
                position: 'absolute',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: '30',
            });
            this.container.appendChild(this.layer);
        }

        this._attachEvents();
        this.update();
    }

    destroy() {
        this._detachEvents();
        this._cancelGeometryRetry();

        this._nodes.forEach((entry) => entry.root.remove());
        this._nodes.clear();
        this._signatures.clear();
        this._activeMenu = null;

        if (this.layer?.parentNode) {
            this.layer.parentNode.removeChild(this.layer);
        }

        this.layer = null;
        this.eventBus = null;
        this.core = null;
        this.container = null;
    }

    _attachEvents() {
        if (this._eventsAttached) return;

        const rebuild = () => this.update();
        const reposition = () => this._updateGeometry();

        const bindings = [
            [Events.Object.Created, rebuild],
            [Events.Object.Deleted, rebuild],
            [Events.Object.Updated, rebuild],
            [Events.Object.StateChanged, rebuild],
            [Events.Board.Loaded, rebuild],
            [Events.History.Changed, rebuild],
            [Events.Tool.DragUpdate, reposition],
            [Events.Tool.DragEnd, reposition],
            [Events.Tool.ResizeUpdate, reposition],
            [Events.Tool.ResizeEnd, rebuild],
            [Events.Tool.GroupDragUpdate, reposition],
            [Events.Tool.GroupResizeUpdate, reposition],
            [Events.Tool.RotateUpdate, reposition],
            [Events.Tool.PanUpdate, reposition],
            [Events.Viewport.Changed, reposition],
            [Events.UI.ZoomPercent, reposition],
        ];

        bindings.forEach(([event, handler]) => {
            this.eventBus.on(event, handler);
            this.subscriptions.push([event, handler]);
        });

        // Панель гасит всплытие своих событий, поэтому закрытие по клику мимо
        // ловим на фазе перехвата.
        document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
        document.addEventListener('keydown', this._onDocumentKeyDown, true);

        this._eventsAttached = true;
    }

    _detachEvents() {
        if (typeof this.eventBus?.off === 'function') {
            this.subscriptions.forEach(([event, handler]) => this.eventBus.off(event, handler));
        }
        this.subscriptions = [];

        document.removeEventListener('pointerdown', this._onDocumentPointerDown, true);
        document.removeEventListener('keydown', this._onDocumentKeyDown, true);

        this._eventsAttached = false;
    }

    _objects() {
        try {
            return this.core?.state?.getObjects?.() || [];
        } catch (_) {
            return [];
        }
    }

    update() {
        if (!this.layer) return;

        const generators = this._objects().filter((obj) => obj?.type === IMAGE_GENERATOR_TYPE);
        const alive = new Set(generators.map((obj) => obj.id));

        this._nodes.forEach((entry, id) => {
            if (alive.has(id)) return;
            if (this._activeMenu?.objectId === id) this._activeMenu = null;
            entry.root.remove();
            this._nodes.delete(id);
            this._signatures.delete(id);
        });

        generators.forEach((object) => {
            const entry = this._nodes.get(object.id) || this._createNode(object.id);
            this._syncControls(entry, object);
        });

        this._updateGeometry();
    }

    _createNode(objectId) {
        const root = document.createElement('div');
        root.className = 'mb-imgen';
        root.dataset.id = objectId;
        // До первого успешного _updateGeometry карточка не имеет ни позиции, ни
        // размера: показывать её в этот момент нечем и негде.
        root.style.display = 'none';

        // Новый узел — новая попытка дождаться его PIXI-объекта, даже если
        // предыдущая серия повторов уже исчерпала лимит кадров.
        this._geometryRetryFrames = 0;

        const scaleBox = document.createElement('div');
        scaleBox.className = 'mb-imgen__scale';

        const footer = document.createElement('div');
        footer.className = 'mb-imgen__footer';

        const count = this._createPill(objectId, 'count', 'Количество изображений');
        const model = this._createPill(objectId, 'model', 'Модель');
        const ratio = this._createPill(objectId, 'ratio', 'Соотношение сторон');
        ratio.menu.classList.add('mb-imgen__menu--grid');

        const run = document.createElement('button');
        run.type = 'button';
        run.className = 'mb-imgen__run';

        footer.append(count.control, model.control, ratio.control, run);
        scaleBox.append(footer);
        root.appendChild(scaleBox);
        this.layer.appendChild(root);

        // Канвас слушает указатель на общем контейнере: без остановки всплытия
        // клик по панели снимал бы выделение и начинал перетаскивание карточки.
        ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel'].forEach((type) => {
            root.addEventListener(type, (event) => event.stopPropagation());
        });

        count.onSelect = (value) => this._patchParams(objectId, { count: clampCount(value) });
        model.onSelect = (value) => this._onModelChange(objectId, value);
        ratio.onSelect = (value) => this._onRatioChange(objectId, value);

        run.addEventListener('click', () => {
            this._closeMenu();
            this.eventBus.emit(GENERATOR_RUN_EVENT, { objectId });
        });

        const entry = { root, scaleBox, footer, count, model, ratio, run };
        this._nodes.set(objectId, entry);
        return entry;
    }

    /**
     * Пилюля со значением и выпадающим меню.
     *
     * @param {string} objectId
     * @param {string} name count | model | ratio
     * @param {string} title
     */
    _createPill(objectId, name, title) {
        const control = document.createElement('div');
        control.className = `mb-imgen__control mb-imgen__control--${name}`;

        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'mb-imgen__pill';
        pill.title = title;
        pill.setAttribute('aria-label', title);
        pill.setAttribute('aria-haspopup', 'menu');
        pill.setAttribute('aria-expanded', 'false');

        const icon = document.createElement('span');
        icon.className = 'mb-imgen__pill-icon';

        const label = document.createElement('span');
        label.className = 'mb-imgen__pill-label';

        pill.append(icon, label);

        const menu = document.createElement('div');
        menu.className = 'mb-imgen__menu';
        menu.setAttribute('role', 'menu');

        control.append(pill, menu);

        const handle = { control, pill, icon, label, menu, objectId, onSelect: null };

        pill.addEventListener('click', () => {
            if (this._activeMenu?.menu === menu) {
                this._closeMenu();
                return;
            }
            this._openMenu(handle);
        });

        menu.addEventListener('click', (event) => {
            const item = event.target.closest('[data-value]');
            if (!item || item.disabled) return;
            this._closeMenu();
            handle.onSelect?.(item.dataset.value);
        });

        return handle;
    }

    _openMenu(handle) {
        this._closeMenu();
        handle.menu.classList.add('is-open');
        handle.pill.setAttribute('aria-expanded', 'true');
        this._activeMenu = handle;
    }

    _closeMenu() {
        if (!this._activeMenu) return;
        this._activeMenu.menu.classList.remove('is-open');
        this._activeMenu.pill.setAttribute('aria-expanded', 'false');
        this._activeMenu = null;
    }

    _syncControls(entry, object) {
        const props = normalizeGeneratorProperties(object.properties);
        const capability = getImageModelCapability(props.params.modelId) || IMAGE_MODELS[0] || null;
        const running = isGeneratorRunning(props);
        const error = getGeneratorError(props);

        const signature = JSON.stringify([
            props.params.modelId,
            props.params.count,
            props.params.ratio,
            running,
            error,
            props.results.length,
        ]);

        if (this._signatures.get(object.id) === signature) return;
        this._signatures.set(object.id, signature);

        const maxCount = Math.min(GENERATOR_MAX_COUNT, capability?.maxCount ?? 4);
        const count = Math.min(props.params.count, maxCount);
        setPill(
            entry.count,
            countIcon(count),
            String(count),
            Array.from({ length: maxCount }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
                icon: countIcon(i + 1),
            })),
            String(count)
        );

        setPill(
            entry.model,
            iconForProvider(capability?.provider),
            capability?.label || 'Модель',
            IMAGE_MODELS.map((m) => ({
                value: m.id,
                label: m.label,
                icon: iconForProvider(m.provider),
                description: m.description,
            })),
            capability?.id || ''
        );

        const supported = supportedRatios(capability);
        const ratio = supported.includes(props.params.ratio) ? props.params.ratio : 'auto';
        setPill(
            entry.ratio,
            RATIO_ICONS[ratio] || RATIO_ICONS.auto,
            ratio === 'auto' ? 'Авто' : ratio,
            supported.map((id) => ({
                value: id,
                label: id === 'auto' ? 'Авто' : id,
                icon: RATIO_ICONS[id] || RATIO_ICONS.auto,
            })),
            ratio
        );

        const done = props.results.some((r) => r.status === RESULT_STATUS.Done);
        const title = running ? 'Генерация…' : (done ? 'Обновить' : 'Сгенерировать');

        entry.run.innerHTML = running || done ? RUN_REFRESH_ICON : RUN_PLAY_ICON;
        entry.run.title = title;
        entry.run.setAttribute('aria-label', title);
        entry.run.disabled = running;
        entry.run.classList.toggle('mb-imgen__run--busy', running);
    }

    _updateGeometry() {
        if (!this.layer) return;

        let awaitingPixi = false;

        this._nodes.forEach((entry, objectId) => {
            const object = this._objects().find((obj) => obj?.id === objectId);
            if (!object) return;

            const req = { objectId, pixiObject: null };
            this.eventBus.emit(Events.Tool.GetObjectPixi, req);
            // На Object.Created слой вызывается раньше, чем PIXI-объект попал
            // в реестр сцены: без него границы не посчитать. Ждать следующего
            // события нельзя — после постановки узла кнопкой панели инструментов
            // не приходит ни драг, ни смена вьюпорта, и карточка осталась бы без
            // геометрии до первого случайного взаимодействия. Пробуем в следующем кадре.
            if (!req.pixiObject) {
                awaitingPixi = true;
                return;
            }

            const worldBounds = this._worldBoundsFromState(object, req.pixiObject);
            if (!worldBounds) return;

            const cssRect = this.positioningService.worldBoundsToCssRect(worldBounds);
            const objectWidth = worldBounds.width;
            const objectHeight = worldBounds.height;
            const scale = cssRect.width / objectWidth;

            const rotationData = { objectId, rotation: 0 };
            this.eventBus.emit(Events.Tool.GetObjectRotation, rotationData);

            Object.assign(entry.root.style, {
                position: 'absolute',
                left: `${Math.round(cssRect.left)}px`,
                top: `${Math.round(cssRect.top)}px`,
                width: `${Math.round(cssRect.width)}px`,
                height: `${Math.round(cssRect.height)}px`,
                pointerEvents: 'none',
                transformOrigin: 'center center',
                transform: `rotate(${rotationData.rotation || 0}deg)`,
                display: scale < MIN_VISIBLE_SCALE ? 'none' : 'block',
            });

            Object.assign(entry.scaleBox.style, {
                position: 'absolute',
                left: '0',
                top: '0',
                width: `${objectWidth}px`,
                height: `${objectHeight}px`,
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
                pointerEvents: 'none',
            });
        });

        if (awaitingPixi) {
            this._scheduleGeometryRetry();
        } else {
            this._cancelGeometryRetry();
        }
    }

    /**
     * Логический бокс узла в world-координатах: позиция и размер только из
     * состояния.
     *
     * Из живого PIXI-объекта бокс брать нельзя (это делает
     * HandlesPositioningService.getSingleSelectionWorldBounds): позицию он считает
     * как `pixi.x − pixi.width / 2`, а `width` у контейнера домножен на
     * `scale`, который анимирует hover-lift (для узла ≥120×80 это scale 1.02 и
     * подъём 4 screen-px). Размер при этом приходит из состояния и остаётся
     * неотмасштабированным, поэтому на наведении бокс уезжал вверх-влево на
     * половину прибавки масштаба плюс подъём, и панель управления перестаёт
     * совпадать с подложкой футера, которую рисует сам узел. Во время генерации
     * это видно постоянно: опрос задачи шлёт Object.StateChanged каждые 2.5 с и
     * пересчитывает геометрию, пока курсор висит над карточкой.
     *
     * @param {object} object объект из состояния
     * @param {object} pixiObject PIXI-объект узла — источник размера, если в
     *   состоянии его ещё нет (берём с инстанса, он не масштабируется hover-ом)
     * @returns {{x: number, y: number, width: number, height: number}|null}
     */
    _worldBoundsFromState(object, pixiObject) {
        const position = object?.position;
        if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;

        const instance = pixiObject?._mb?.instance || null;
        const width = Number(object.width) || Number(instance?.width) || 0;
        const height = Number(object.height) || Number(instance?.height) || 0;
        if (width <= 0 || height <= 0) return null;

        return { x: position.x, y: position.y, width, height };
    }

    /** Повтор расчёта в следующем кадре — ждём регистрации PIXI-объекта. */
    _scheduleGeometryRetry() {
        if (this._geometryRetryHandle !== null) return;
        if (this._geometryRetryFrames >= GEOMETRY_RETRY_FRAMES) return;

        this._geometryRetryHandle = requestAnimationFrame(() => {
            this._geometryRetryHandle = null;
            this._geometryRetryFrames += 1;
            this._updateGeometry();
        });
    }

    _cancelGeometryRetry() {
        if (this._geometryRetryHandle !== null) {
            cancelAnimationFrame(this._geometryRetryHandle);
            this._geometryRetryHandle = null;
        }
        this._geometryRetryFrames = 0;
    }

    /**
     * Обновление параметров всегда уходит целым объектом params: слияние
     * свойств в состоянии поверхностное, частичный patch затёр бы соседние ключи.
     */
    _patchParams(objectId, patch, extraUpdates = {}) {
        const object = this._objects().find((obj) => obj?.id === objectId);
        const current = normalizeGeneratorProperties(object?.properties).params;

        commitGeneratorUpdates(this.core, this.eventBus, objectId, {
            ...extraUpdates,
            properties: { params: { ...current, ...patch } },
        });
    }

    _onModelChange(objectId, modelId) {
        const capability = getImageModelCapability(modelId);
        const object = this._objects().find((obj) => obj?.id === objectId);
        const props = normalizeGeneratorProperties(object?.properties);

        const maxCount = Math.min(GENERATOR_MAX_COUNT, capability?.maxCount ?? 4);
        const ratios = supportedRatios(capability);

        this._patchParams(objectId, {
            modelId,
            count: Math.min(props.params.count, maxCount),
            ratio: ratios.includes(props.params.ratio) ? props.params.ratio : 'auto',
        });
    }

    _onRatioChange(objectId, ratio) {
        const object = this._objects().find((obj) => obj?.id === objectId);
        if (!object) return;

        const width = Math.max(1, object.width || 380);
        const height = heightForRatio(ratio, width, object.height || 300);

        // Соотношение сторон меняет и параметр, и высоту карточки — одним патчем,
        // иначе в историю уходят две записи и промежуточное состояние сохраняется.
        this._patchParams(objectId, { ratio }, height === object.height ? {} : { height });
    }
}

/**
 * @param {object|null} capability
 * @returns {string[]}
 */
function supportedRatios(capability) {
    if (!capability || !Array.isArray(capability.ratios) || capability.ratios.length === 0) {
        return GENERATOR_RATIOS;
    }
    return GENERATOR_RATIOS.filter((id) => id === 'auto' || capability.ratios.includes(id));
}

/** Иконка провайдера модели — та же, что в пилюле модели в чате. */
function iconForProvider(provider) {
    switch (provider) {
        case 'gemini-image': return ICONS.modelGoogle;
        case 'openai-image': return ICONS.modelGpt;
        case 'qwen-image':   return ICONS.modelQwen;
        default:             return ICONS.model;
    }
}

/** Набор иконок количества заканчивается на 4 — дальше повторяем последнюю. */
function countIcon(count) {
    return COUNT_ICONS[Math.min(4, Math.max(1, Number(count) || 1))];
}

/**
 * Обновляет значение пилюли и пересобирает пункты её меню.
 *
 * @param {{icon: HTMLElement, label: HTMLElement, menu: HTMLElement}} handle
 * @param {string} iconSvg
 * @param {string} labelText
 * @param {Array<{value: string, label: string, icon: string, description?: string}>} options
 * @param {string} activeValue
 */
function setPill(handle, iconSvg, labelText, options, activeValue) {
    handle.icon.innerHTML = iconSvg || '';
    handle.label.textContent = labelText;

    handle.menu.innerHTML = '';
    options.forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'mb-imgen__menu-item';
        item.setAttribute('role', 'menuitem');
        item.dataset.value = option.value;
        if (option.value === activeValue) item.dataset.active = 'true';
        if (option.description) item.title = `${option.label} · ${option.description}`;

        const icon = document.createElement('span');
        icon.className = 'mb-imgen__menu-item-icon';
        icon.innerHTML = option.icon || '';

        const label = document.createElement('span');
        label.className = 'mb-imgen__menu-item-label';
        label.textContent = option.label;

        item.append(icon, label);
        handle.menu.appendChild(item);
    });

    if (handle.menu.classList.contains('mb-imgen__menu--grid')) {
        handle.menu.style.setProperty('--mb-imgen-menu-columns', String(Math.min(RATIO_MENU_COLUMNS, options.length)));
    }
}
