import { ICONS } from './icons.js';
import { ChatPillMenu } from './ChatPillMenu.js';
import { getVideoModelCapability } from '../../services/ai/videoModelCapabilities.js';

/**
 * Видео-настройки как пилюли тулбара (вместо отдельной всплывающей панели).
 *
 * Каждая пилюля видна только когда выбран тип «видео» и текущая модель
 * поддерживает соответствующий параметр (по capability.supports).
 *
 * Типы контролов:
 *   - тумблеры (Звук, Водяной знак) — клик переключает значение;
 *   - выбор (Люди) — пилюля-меню как формат/модель;
 *   - свободный ввод (Seed, CFG, Негатив) — пилюля с мини-поповером,
 *     привязанным к ней (тот же механизм, что у меню формата).
 *
 * Одна ответственность: построить/обновлять пилюли видео-настроек и
 * прокидывать изменения наружу через onChange.
 */
export class ChatVideoToolbarPills {
    /**
     * @param {HTMLElement} pillsContainer
     * @param {{
     *   getActive: () => boolean,
     *   getModelId: () => string,
     *   getState: () => { seed:number|null, negativePrompt:string, audio:boolean, watermark:boolean, cfgScale:number|null, personGeneration:string },
     *   onChange: (patch: object) => void
     * }} handlers
     */
    constructor(pillsContainer, handlers) {
        this._container = pillsContainer;
        this._h = handlers;
        this._listeners = [];
        this._entries = [];      // { flag, wrapper }
        this._pills = {};        // flag -> pill button
        this._toggleIcons = {};  // flag -> { span, on, off } для смены иконки тумблера
        this._labels = {};       // flag -> label span (для value-пилюль)
        this._inputs = {};       // flag -> input element
        this._personMenu = null;
        this._popover = null;    // { menu, pill }
        this._docHandler = null;
    }

    attach() {
        this._buildToggle('audio', 'Звук', ICONS.audio, {
            iconOff: ICONS.audioOff,
            title: 'Звук в видео: вкл / выкл',
        });
        this._buildToggle('watermark', 'Водяной знак', ICONS.watermark, {
            title: 'Водяной знак на видео: вкл / выкл',
        });
        this._buildPersonPill();
        this._buildSeedPill();
        this._buildCfgPill();
        this._buildNegativePill();
    }

    refresh() {
        const active = !!this._h.getActive?.();
        const cap = active ? getVideoModelCapability(this._h.getModelId?.()) : null;
        const sup = cap?.supports ?? {};
        const st = this._h.getState?.() ?? {};

        for (const { flag, wrapper } of this._entries) {
            wrapper.style.display = (active && sup[flag]) ? '' : 'none';
        }
        if (!active) {
            this._closePopover();
            return;
        }

        this._applyToggleState('audio', !!st.audio);
        this._applyToggleState('watermark', !!st.watermark);

        this._personMenu?.refresh();

        if (this._labels.seed) this._labels.seed.textContent = st.seed != null ? `Seed · ${st.seed}` : 'Seed';
        if (this._inputs.seed && document.activeElement !== this._inputs.seed) {
            this._inputs.seed.value = st.seed != null ? String(st.seed) : '';
        }

        if (this._labels.cfgScale) {
            this._labels.cfgScale.textContent = st.cfgScale != null ? `CFG · ${Number(st.cfgScale).toFixed(2)}` : 'CFG';
        }
        if (this._inputs.cfgScale) {
            this._inputs.cfgScale.value = st.cfgScale != null ? String(st.cfgScale) : '0.5';
        }

        const hasNeg = !!(st.negativePrompt && st.negativePrompt.trim());
        if (this._pills.negativePrompt) this._pills.negativePrompt.dataset.active = hasNeg ? 'true' : 'false';
        if (this._inputs.negativePrompt && document.activeElement !== this._inputs.negativePrompt) {
            this._inputs.negativePrompt.value = st.negativePrompt || '';
        }
    }

    destroy() {
        this._closePopover();
        for (const off of this._listeners) off();
        this._listeners = [];
        this._personMenu?.destroy();
        this._personMenu = null;
        for (const { wrapper } of this._entries) wrapper.remove();
        this._entries = [];
        this._pills = {};
        this._toggleIcons = {};
        this._labels = {};
        this._inputs = {};
    }

    _registerWrapper(flag, wrapper) {
        wrapper.style.display = 'none';
        this._container.appendChild(wrapper);
        this._entries.push({ flag, wrapper });
    }

    _makePill(icon, labelText) {
        const wrapper = document.createElement('div');
        wrapper.className = 'moodboard-chat__pill-wrapper';
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'moodboard-chat__pill';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'moodboard-chat__pill-icon-wrap';
        iconSpan.innerHTML = icon;
        const labelEl = document.createElement('span');
        labelEl.className = 'moodboard-chat__pill-label';
        labelEl.textContent = labelText;
        pill.appendChild(iconSpan);
        pill.appendChild(labelEl);
        wrapper.appendChild(pill);
        return { wrapper, pill, labelEl, iconSpan };
    }

    _buildToggle(flag, labelText, icon, opts = {}) {
        const { wrapper, pill, iconSpan } = this._makePill(icon, labelText);
        pill.classList.add('moodboard-chat__pill--toggle');
        pill.setAttribute('aria-pressed', 'false');
        if (opts.title) pill.title = opts.title;
        this._pills[flag] = pill;
        this._toggleIcons[flag] = { span: iconSpan, on: icon, off: opts.iconOff ?? icon };
        this._on(pill, 'click', () => {
            const st = this._h.getState?.() ?? {};
            this._h.onChange?.({ [flag]: !st[flag] });
        });
        this._registerWrapper(flag, wrapper);
    }

    _applyToggleState(flag, on) {
        const pill = this._pills[flag];
        if (!pill) return;
        pill.dataset.active = on ? 'true' : 'false';
        pill.setAttribute('aria-pressed', on ? 'true' : 'false');
        const ic = this._toggleIcons[flag];
        if (ic) ic.span.innerHTML = on ? ic.on : ic.off;
    }

    _buildPersonPill() {
        const { wrapper, pill, labelEl } = this._makePill(ICONS.users, 'Разрешить');
        pill.setAttribute('aria-haspopup', 'menu');
        pill.setAttribute('aria-expanded', 'false');
        const menu = document.createElement('div');
        menu.className = 'moodboard-chat__menu';
        menu.setAttribute('role', 'menu');
        wrapper.appendChild(menu);
        this._pills.personGeneration = pill;
        this._personMenu = new ChatPillMenu(
            { trigger: pill, menu, label: labelEl },
            {
                getOptions: () => [
                    { id: 'allow_all', label: 'Разрешить' },
                    { id: 'disallow', label: 'Запретить' },
                ],
                getActiveId: () => this._h.getState?.().personGeneration ?? 'allow_all',
                onSelect: (id) => this._h.onChange?.({ personGeneration: id }),
            }
        );
        this._personMenu.attach();
        this._registerWrapper('personGeneration', wrapper);
    }

    _buildSeedPill() {
        this._buildPopoverPill('seed', 'Seed', ICONS.seed, 'Зерно генерации', (body) => {
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.step = '1';
            input.placeholder = 'Случайно';
            input.className = 'moodboard-chat__settings-input';
            this._inputs.seed = input;
            this._on(input, 'input', () => {
                const raw = input.value.trim();
                const v = raw === '' ? null : Number.parseInt(raw, 10);
                this._h.onChange?.({ seed: (v != null && !Number.isNaN(v)) ? v : null });
            });
            body.appendChild(input);
            const hint = document.createElement('div');
            hint.className = 'moodboard-chat__settings-hint';
            hint.textContent = 'Число, фиксирующее случайность. Одно и то же число — похожий результат. Пусто — каждый раз по-новому.';
            body.appendChild(hint);
        }, { title: 'Seed — число для повторяемости результата' });
    }

    _buildCfgPill() {
        this._buildPopoverPill('cfgScale', 'CFG', ICONS.gauge, 'CFG Scale (0–1)', (body) => {
            const input = document.createElement('input');
            input.type = 'range';
            input.min = '0';
            input.max = '1';
            input.step = '0.05';
            input.className = 'moodboard-chat__settings-input';
            this._inputs.cfgScale = input;
            this._on(input, 'input', () => this._h.onChange?.({ cfgScale: Number(input.value) }));
            body.appendChild(input);
        });
    }

    _buildNegativePill() {
        this._buildPopoverPill('negativePrompt', 'Негатив', ICONS.negative, 'Негативный промпт', (body) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Что исключить';
            input.className = 'moodboard-chat__settings-input';
            this._inputs.negativePrompt = input;
            this._on(input, 'input', () => this._h.onChange?.({ negativePrompt: input.value }));
            body.appendChild(input);
        });
    }

    _buildPopoverPill(flag, labelText, icon, fieldLabel, buildBody, opts = {}) {
        const { wrapper, pill, labelEl } = this._makePill(icon, labelText);
        pill.setAttribute('aria-haspopup', 'dialog');
        pill.setAttribute('aria-expanded', 'false');
        if (opts.title) pill.title = opts.title;

        const menu = document.createElement('div');
        menu.className = 'moodboard-chat__menu moodboard-chat__pill-popover';

        const body = document.createElement('div');
        body.className = 'moodboard-chat__pill-popover-body';
        const label = document.createElement('div');
        label.className = 'moodboard-chat__settings-label';
        label.textContent = fieldLabel;
        body.appendChild(label);
        buildBody(body);
        menu.appendChild(body);
        wrapper.appendChild(menu);

        this._pills[flag] = pill;
        this._labels[flag] = labelEl;
        this._on(pill, 'click', (e) => {
            e.stopPropagation();
            if (this._popover?.menu === menu) this._closePopover();
            else this._openPopover(menu, pill);
        });
        this._registerWrapper(flag, wrapper);
    }

    _openPopover(menu, pill) {
        this._closePopover();
        menu.classList.add('is-open');
        pill.setAttribute('aria-expanded', 'true');
        this._popover = { menu, pill };
        this._docHandler = (e) => {
            if (!menu.contains(e.target) && !pill.contains(e.target)) this._closePopover();
        };
        document.addEventListener('mousedown', this._docHandler);
    }

    _closePopover() {
        if (!this._popover) return;
        this._popover.menu.classList.remove('is-open');
        this._popover.pill.setAttribute('aria-expanded', 'false');
        this._popover = null;
        if (this._docHandler) {
            document.removeEventListener('mousedown', this._docHandler);
            this._docHandler = null;
        }
    }

    _on(el, type, handler) {
        el.addEventListener(type, handler);
        this._listeners.push(() => el.removeEventListener(type, handler));
    }
}
