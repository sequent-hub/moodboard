import { Events } from '../../core/events/Events.js';
import { HandlesPositioningService } from '../handles/HandlesPositioningService.js';
import { commitGeneratorUpdates } from '../../services/ai/imageGeneratorState.js';

/** Ниже этого масштаба элементы управления не читаются — прячем их. */
export const MIN_VISIBLE_SCALE = 0.35;

/** Сколько иконок формата помещается в строку выпадающей сетки. */
export const RATIO_MENU_COLUMNS = 5;

/**
 * Сколько кадров ждём появления PIXI-объекта в реестре сцены, прежде чем сдаться.
 * Объект может не появиться вовсе (создание упало), поэтому повтор ограничен.
 */
const GEOMETRY_RETRY_FRAMES = 60;

/**
 * Общий DOM-слой с элементами управления узла-генератора.
 *
 * В PIXI нет ни выпадающих списков, ни фокуса, ни доступности, поэтому нижняя
 * панель карточки живёт в DOM поверх канваса и синхронизируется с миром по тем
 * же событиям, что и рамка выделения. Подложку панели рисует сам объект — здесь
 * только органы управления.
 *
 * Значения выбираются пилюлей с выпадающим меню (как в окне чата), а не через
 * <select>: нативный список не умеет показывать иконки форматов и количества.
 *
 * Общее для всех генераторов — жизненный цикл, геометрия и механика пилюль.
 * Наследник объявляет тип узла и содержимое панели: `nodeType`, `_buildFooter()`,
 * `_syncControls()` и нормализацию properties своего контракта.
 */
export class GeneratorControlsLayer {
    /**
     * @param {HTMLElement} container
     * @param {object} eventBus
     * @param {object} core
     */
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

    /** Тип объекта холста, который обслуживает слой. @returns {string} */
    get nodeType() {
        throw new Error('GeneratorControlsLayer: наследник обязан объявить nodeType');
    }

    /** Класс корневого элемента карточки и слоя. @returns {string} */
    get rootClassName() {
        return 'mb-imgen';
    }

    /**
     * Приводит properties узла к схеме своего контракта.
     * @param {object} props
     * @returns {object}
     */
    _normalize(props) {
        return props || {};
    }

    /**
     * Наполняет панель органами управления.
     * @param {HTMLElement} _footer
     * @param {string} _objectId
     * @returns {object} поля, которые наследник хочет видеть в entry
     */
    _buildFooter(_footer, _objectId) {
        return {};
    }

    /**
     * Приводит панель в соответствие состоянию узла.
     * @param {object} _entry
     * @param {object} _object
     */
    _syncControls(_entry, _object) {}

    attach() {
        if (!this.layer) {
            this.layer = document.createElement('div');
            this.layer.className = `${this.rootClassName}-layer`;
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

        const generators = this._objects().filter((obj) => obj?.type === this.nodeType);
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
        root.className = this.rootClassName;
        root.dataset.id = objectId;
        // До первого успешного _updateGeometry карточка не имеет ни позиции, ни
        // размера: показывать её в этот момент нечем и негде.
        root.style.display = 'none';

        // Новый узел — новая попытка дождаться его PIXI-объекта, даже если
        // предыдущая серия повторов уже исчерпала лимит кадров.
        this._geometryRetryFrames = 0;

        const scaleBox = document.createElement('div');
        scaleBox.className = `${this.rootClassName}__scale`;

        const footer = document.createElement('div');
        footer.className = `${this.rootClassName}__footer`;

        const controls = this._buildFooter(footer, objectId);

        scaleBox.append(footer);
        root.appendChild(scaleBox);
        this.layer.appendChild(root);

        // Канвас слушает указатель на общем контейнере: без остановки всплытия
        // клик по панели снимал бы выделение и начинал перетаскивание карточки.
        ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel'].forEach((type) => {
            root.addEventListener(type, (event) => event.stopPropagation());
        });

        const entry = { root, scaleBox, footer, ...controls };
        this._nodes.set(objectId, entry);
        return entry;
    }

    /**
     * Кнопка запуска генерации.
     *
     * @param {string} objectId
     * @param {string} runEvent имя события шины
     * @returns {HTMLButtonElement}
     */
    _createRunButton(objectId, runEvent) {
        const run = document.createElement('button');
        run.type = 'button';
        run.className = `${this.rootClassName}__run`;

        run.addEventListener('click', () => {
            this._closeMenu();
            this.eventBus.emit(runEvent, { objectId });
        });

        return run;
    }

    /**
     * Пилюля со значением и выпадающим меню.
     *
     * @param {string} objectId
     * @param {string} name модификатор класса
     * @param {string} title
     */
    _createPill(objectId, name, title) {
        const control = document.createElement('div');
        control.className = `${this.rootClassName}__control ${this.rootClassName}__control--${name}`;

        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `${this.rootClassName}__pill`;
        pill.title = title;
        pill.setAttribute('aria-label', title);
        pill.setAttribute('aria-haspopup', 'menu');
        pill.setAttribute('aria-expanded', 'false');

        const icon = document.createElement('span');
        icon.className = `${this.rootClassName}__pill-icon`;

        const label = document.createElement('span');
        label.className = `${this.rootClassName}__pill-label`;

        pill.append(icon, label);

        const menu = document.createElement('div');
        menu.className = `${this.rootClassName}__menu`;
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

    /**
     * Пересобирает панель, только если состояние узла изменилось.
     *
     * @param {string} objectId
     * @param {Array<*>} parts значения, от которых зависит вид панели
     * @returns {boolean} нужно ли перерисовывать
     */
    _shouldSync(objectId, parts) {
        const signature = JSON.stringify(parts);
        if (this._signatures.get(objectId) === signature) return false;

        this._signatures.set(objectId, signature);
        return true;
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
        const current = this._normalize(object?.properties).params;

        commitGeneratorUpdates(this.core, this.eventBus, objectId, {
            ...extraUpdates,
            properties: { params: { ...current, ...patch } },
        });
    }
}

/**
 * Обновляет значение пилюли и пересобирает пункты её меню.
 *
 * @param {{icon: HTMLElement, label: HTMLElement, menu: HTMLElement}} handle
 * @param {string} iconSvg
 * @param {string} labelText
 * @param {Array<{value: string, label: string, icon?: string, description?: string}>} options
 * @param {string} activeValue
 * @param {string} [prefix='mb-imgen'] префикс классов слоя
 */
export function setPill(handle, iconSvg, labelText, options, activeValue, prefix = 'mb-imgen') {
    handle.icon.innerHTML = iconSvg || '';
    handle.label.textContent = labelText;

    handle.menu.innerHTML = '';
    options.forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `${prefix}__menu-item`;
        item.setAttribute('role', 'menuitem');
        item.dataset.value = option.value;
        if (option.value === activeValue) item.dataset.active = 'true';
        if (option.description) item.title = `${option.label} · ${option.description}`;

        const icon = document.createElement('span');
        icon.className = `${prefix}__menu-item-icon`;
        icon.innerHTML = option.icon || '';

        const label = document.createElement('span');
        label.className = `${prefix}__menu-item-label`;
        label.textContent = option.label;

        item.append(icon, label);
        handle.menu.appendChild(item);
    });

    if (handle.menu.classList.contains(`${prefix}__menu--grid`)) {
        handle.menu.style.setProperty('--mb-imgen-menu-columns', String(Math.min(RATIO_MENU_COLUMNS, options.length)));
    }
}
