/**
 * DOM-заглушка прогресса генерации 3D-модели.
 *
 * Одна ответственность: показывать стадии (геометрия / текстура) и прогресс-бар
 * поверх composer-контейнера. Не знает ни про сессию, ни про доску.
 *
 * Lifecycle: attach(container) → update(state)* → detach() → destroy()
 * attach/detach идемпотентны. Listeners не дублируются.
 */
export class Model3dProgressOverlay {
    constructor() {
        this._el = null;
        this._barFill = null;
        this._stageLabel = null;
        this._percentLabel = null;
        this._container = null;
    }

    /**
     * Добавляет оверлей в container.
     * @param {HTMLElement} container
     */
    attach(container) {
        if (this._el) return;
        this._container = container;

        const el = document.createElement('div');
        el.className = 'moodboard-chat__3d-overlay';

        const inner = document.createElement('div');
        inner.className = 'moodboard-chat__3d-overlay-inner';

        const stageLabel = document.createElement('span');
        stageLabel.className = 'moodboard-chat__3d-overlay-stage';
        stageLabel.textContent = 'Генерация геометрии…';

        const barWrap = document.createElement('div');
        barWrap.className = 'moodboard-chat__3d-overlay-bar-wrap';

        const barFill = document.createElement('div');
        barFill.className = 'moodboard-chat__3d-overlay-bar-fill';
        barFill.style.width = '0%';

        const percentLabel = document.createElement('span');
        percentLabel.className = 'moodboard-chat__3d-overlay-percent';
        percentLabel.textContent = '0%';

        barWrap.appendChild(barFill);
        inner.appendChild(stageLabel);
        inner.appendChild(barWrap);
        inner.appendChild(percentLabel);
        el.appendChild(inner);

        this._el = el;
        this._barFill = barFill;
        this._stageLabel = stageLabel;
        this._percentLabel = percentLabel;

        container.appendChild(el);
    }

    /**
     * Обновляет отображение по состоянию Model3dSessionController.
     * @param {{ status: string, progress: number, stage: string|null, error: string|null }} state
     */
    update(state) {
        if (!this._el) return;

        const { status, progress, stage, error } = state;

        if (status === 'error') {
            this._el.classList.add('is-error');
            this._stageLabel.textContent = error ? `Ошибка: ${error}` : 'Ошибка генерации';
            return;
        }

        this._el.classList.remove('is-error');

        const pct = Math.round(Math.min(100, Math.max(0, progress ?? 0)));

        // Пока прогресс равен нулю и API ещё не вернул данные (submitting / начало polling),
        // показываем indeterminate-полоску — пользователь видит активную работу, а не «0% = завис».
        const isIndeterminate = pct === 0;
        this._barFill.classList.toggle('is-indeterminate', isIndeterminate);
        if (!isIndeterminate) {
            this._barFill.style.width = `${pct}%`;
        }
        this._percentLabel.textContent = `${pct}%`;

        if (stage === 'texture') {
            this._stageLabel.textContent = 'Генерация текстуры…';
        } else if (status === 'submitting') {
            this._stageLabel.textContent = 'Отправка запроса…';
        } else {
            this._stageLabel.textContent = 'Генерация геометрии…';
        }
    }

    /** Убирает DOM-элемент из контейнера, не разрушая объект. */
    detach() {
        if (this._el && this._el.parentNode) {
            this._el.parentNode.removeChild(this._el);
        }
        this._el = null;
        this._barFill = null;
        this._stageLabel = null;
        this._percentLabel = null;
        this._container = null;
    }

    destroy() {
        this.detach();
    }
}
