import gsap from 'gsap';

/**
 * Кадры PIXI по активности вместо непрерывных 60 fps.
 *
 * PIXI.Application по умолчанию рендерит каждый кадр, даже когда доска
 * неподвижна: основной поток занят постоянно, на мобильной эмуляции это давало
 * загрузку процессора около 70% на статичной сцене.
 *
 * Активностью считаются: любое событие шины (значит состояние могло поменяться),
 * ввод в контейнер холста, идущие анимации GSAP и играющее видео. Пока активность
 * есть — кадр на каждый rAF. В покое остаётся редкий страховочный тик: изменение,
 * которое не прошло через наблюдаемые каналы (догрузка текстуры, кадр видео),
 * попадёт на экран в пределах IDLE_INTERVAL_MS, а не залипнет до следующего клика.
 *
 * Кадр выдаётся через ticker.update, а не app.render: у тикера есть и другие
 * подписчики (анимация плейсхолдера при перетаскивании файла, автообновление
 * видеотекстур PIXI), которым тоже нужен такт.
 */

const ACTIVE_WINDOW_MS = 400;
const IDLE_INTERVAL_MS = 200;
const BUSY_RECHECK_MS = 250;

const DOM_ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'dragover', 'drop'];
const DOC_ACTIVITY_EVENTS = ['keydown', 'keyup', 'pointerup'];

function nowMs() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
}

export class RenderLoopController {
    /**
     * @param {import('pixi.js').Application} app
     * @param {{ activeWindowMs?: number, idleIntervalMs?: number, isBusy?: () => boolean }} [options]
     */
    constructor(app, options = {}) {
        this.app = app;
        this.activeWindowMs = options.activeWindowMs ?? ACTIVE_WINDOW_MS;
        this.idleIntervalMs = options.idleIntervalMs ?? IDLE_INTERVAL_MS;
        this.isBusy = typeof options.isBusy === 'function' ? options.isBusy : null;

        this._rafId = 0;
        this._lastActivityAt = nowMs();
        this._lastFrameAt = 0;
        this._busyCheckedAt = 0;
        this._busyCached = false;
        /** Причины непрерывного режима: пока набор не пуст, кадр идёт каждый rAF */
        this._continuous = new Set();

        this._container = null;
        this._eventBus = null;
        this._onActivity = () => this.wake();
        this._frame = this._frame.bind(this);
    }

    attach(container, eventBus) {
        this._container = container || null;
        this._eventBus = eventBus || null;

        if (this._container) {
            DOM_ACTIVITY_EVENTS.forEach((type) => {
                this._container.addEventListener(type, this._onActivity, { passive: true });
            });
        }
        if (typeof document !== 'undefined') {
            DOC_ACTIVITY_EVENTS.forEach((type) => {
                document.addEventListener(type, this._onActivity, { passive: true });
            });
        }
        this._eventBus?.addEmitObserver?.(this._onActivity);

        this.wake();
        this._scheduleFrame();
    }

    /** Отмечает активность: следующие activeWindowMs кадры идут каждый rAF. */
    wake() {
        this._lastActivityAt = nowMs();
    }

    /** Держит непрерывный рендер, пока причина не снята (проигрывание, запись). */
    beginContinuous(reason) {
        this._continuous.add(reason);
        this.wake();
    }

    endContinuous(reason) {
        this._continuous.delete(reason);
    }

    destroy() {
        if (this._rafId && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this._rafId);
        }
        this._rafId = 0;

        if (this._container) {
            DOM_ACTIVITY_EVENTS.forEach((type) => {
                this._container.removeEventListener(type, this._onActivity);
            });
        }
        if (typeof document !== 'undefined') {
            DOC_ACTIVITY_EVENTS.forEach((type) => {
                document.removeEventListener(type, this._onActivity);
            });
        }
        this._eventBus?.removeEmitObserver?.(this._onActivity);

        this._continuous.clear();
        this._container = null;
        this._eventBus = null;
        this.app = null;
        this.isBusy = null;
    }

    _scheduleFrame() {
        if (typeof requestAnimationFrame !== 'function') return;
        this._rafId = requestAnimationFrame(this._frame);
    }

    _frame(timestamp) {
        if (!this.app) return;
        this._scheduleFrame();

        const now = typeof timestamp === 'number' ? timestamp : nowMs();
        if (!this._shouldRender(now)) return;

        this._lastFrameAt = now;
        this.app.ticker?.update?.(now);
    }

    _shouldRender(now) {
        if (this._continuous.size > 0) return true;
        if (now - this._lastActivityAt < this.activeWindowMs) return true;
        if (this._hasActiveTweens()) return true;
        if (this._hasTickerAnimations()) return true;
        if (this._checkBusy(now)) return true;
        return (now - this._lastFrameAt) >= this.idleIntervalMs;
    }

    /**
     * Идут ли анимации GSAP (hover-lift на PIXI-объектах и анимации оверлеев).
     * Подписка на gsap.ticker для этого не годится: добавленный слушатель сам
     * не даёт тикеру заснуть, и активность выглядела бы вечной. У globalTimeline
     * включено autoRemoveChildren, поэтому непустой список = живые твины.
     */
    _hasActiveTweens() {
        try {
            return gsap.globalTimeline.getChildren(true, true, false).length > 0;
        } catch (_) {
            return false;
        }
    }

    /**
     * Есть ли покадровые анимации на тикере приложения (шиммер плейсхолдера
     * загрузки и подобные). Application держит там ровно один свой обработчик —
     * рендер, поэтому любой лишний означает, что кадры нужны каждый rAF.
     */
    _hasTickerAnimations() {
        return (this.app.ticker?.count ?? 0) > 1;
    }

    /** Опрос «занятости» (играющее видео) реже кадра: в покое хватает четверти секунды. */
    _checkBusy(now) {
        if (!this.isBusy) return false;
        if (now - this._busyCheckedAt < BUSY_RECHECK_MS) return this._busyCached;
        this._busyCheckedAt = now;
        try {
            this._busyCached = !!this.isBusy();
        } catch (_) {
            this._busyCached = false;
        }
        return this._busyCached;
    }
}
