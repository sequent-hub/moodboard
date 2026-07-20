import { getObjectProperties } from './TextPropertiesPanelMapper.js';

const ICON_LINK = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M10.5893 15.3024L9.4108 16.4809C7.78361 18.1081 5.14542 18.1081 3.51824 16.4809C1.89106 14.8537 1.89106 12.2155 3.51824 10.5883L4.69675 9.40982M15.3034 10.5883L16.4819 9.40982C18.109 7.78264 18.109 5.14445 16.4819 3.51726C14.8547 1.89008 12.2165 1.89008 10.5893 3.51726L9.4108 4.69577M7.08339 12.9157L12.9167 7.08239"></path></svg>`;

/**
 * Создаёт кнопку «Ссылка» с всплывающей формой ввода URL.
 *
 * Поведение:
 * - Кнопка disabled пока у объекта выключен MD-режим.
 * - Клик сохраняет selection в textarea, показывает форму рядом с textarea.
 * - Сабмит: если было выделение — [selected](url), иначе [весь текст](url).
 * - Автоматически добавляет https:// если схема не указана.
 * - Enter = OK, Esc = отмена, клик вне = отмена.
 *
 * @param {object} panelInstance - экземпляр TextPropertiesPanel
 * @returns {HTMLButtonElement} кнопка для вставки в панель
 */
export function createLinkButton(panelInstance) {
    const btn = document.createElement('button');
    btn.className = 'ipp-btn tpp-link-btn';
    btn.title = 'Добавить ссылку';
    btn.id = 'tpp-btn-link';
    btn.dataset.id = 'tpp-btn-link';
    btn.disabled = false;
    btn.innerHTML = ICON_LINK;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _openLinkForm(panelInstance, btn);
    });

    panelInstance._tppBtnLink = btn;
    return btn;
}

/**
 * Обновляет disabled-состояние кнопки в зависимости от MD-флага объекта.
 * При включённом MD-режиме кнопка недоступна — ссылки добавляются markdown-синтаксисом вручную.
 * Вызывается из TextPropertiesPanelBindings при смене markdownToggle.
 */
export function updateLinkButtonState(panelInstance, isMarkdown) {
    if (!panelInstance._tppBtnLink) return;
    const btn = panelInstance._tppBtnLink;
    btn.disabled = isMarkdown;
    btn.title = isMarkdown
        ? 'Ссылки в MD-режиме добавляются через синтаксис [текст](url)'
        : 'Добавить ссылку к тексту';
    btn.classList.toggle('tpp-link-btn--disabled', isMarkdown);
}

function _getActiveTextarea(panelInstance) {
    return panelInstance.core?.selectTool?.textEditor?.textarea ?? null;
}

function _normalizeUrl(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;
    return 'https://' + trimmed;
}

function _openLinkForm(panelInstance, triggerBtn) {
    // Закрываем предыдущую форму, если она уже открыта
    _closeExistingForm();

    const textarea = _getActiveTextarea(panelInstance);

    // Запоминаем id выделенного объекта ДО показа формы — фокус ухода в URL-input
    // или клик мимо canvas может сбросить выделение и panelInstance.currentId станет null
    const savedObjectId = panelInstance.currentId;

    // Запоминаем выделение ДО показа формы (фокус уйдёт на input)
    let savedStart = 0;
    let savedEnd = 0;
    let savedText = '';
    if (textarea) {
        savedStart = textarea.selectionStart ?? 0;
        savedEnd = textarea.selectionEnd ?? 0;
        savedText = textarea.value ?? '';
    } else {
        // Объект только выделен (без активного редактора) — применяем ссылку ко всему содержимому
        const props = getObjectProperties(panelInstance.eventBus, savedObjectId);
        savedText = props?.content ?? '';
    }
    const hasSelection = savedEnd > savedStart;

    const form = _buildForm(panelInstance, textarea, {
        savedStart,
        savedEnd,
        savedText,
        hasSelection,
        triggerBtn,
        savedObjectId,
    });

    document.body.appendChild(form);

    // Позиционируем форму рядом с textarea или рядом с кнопкой
    _positionForm(form, textarea, triggerBtn);

    const urlInput = form.querySelector('.tpp-link-input');
    urlInput.focus();

    // Закрытие по клику вне формы
    const closeOnOutside = (ev) => {
        if (!form.contains(ev.target) && ev.target !== triggerBtn) {
            _closeForm(form, closeOnOutside);
        }
    };
    setTimeout(() => document.addEventListener('mousedown', closeOnOutside), 0);
    form._closeOnOutside = closeOnOutside;
}

function _buildForm(panelInstance, textarea, ctx) {
    const { savedStart, savedEnd, savedText, hasSelection, triggerBtn, savedObjectId } = ctx;

    const form = document.createElement('div');
    form.className = 'tpp-link-form';
    form.id = 'tpp-link-form-active';

    const label = document.createElement('span');
    label.className = 'tpp-link-form-label';
    label.textContent = hasSelection ? `Ссылка для «${_truncate(savedText.slice(savedStart, savedEnd), 24)}»` : 'URL ссылки';
    form.appendChild(label);

    const row = document.createElement('div');
    row.className = 'tpp-link-form-row';

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.placeholder = 'https://example.com';
    urlInput.className = 'tpp-link-input';
    urlInput.autocomplete = 'url';

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'tpp-link-form-ok';
    okBtn.id = 'tpp-link-form-ok';
    okBtn.textContent = 'OK';

    row.appendChild(urlInput);
    row.appendChild(okBtn);
    form.appendChild(row);

    const submit = () => {
        const url = _normalizeUrl(urlInput.value);
        if (!url) {
            urlInput.classList.add('tpp-link-input--error');
            urlInput.focus();
            return;
        }
        urlInput.classList.remove('tpp-link-input--error');

        // Запись ссылки как диапазона в properties.links (не markdown-синтаксис).
        // objectId передаём явно — currentId на панели мог сброситься, пока пользователь
        // печатал URL и фокус был в input.
        if (typeof panelInstance._addLink === 'function') {
            const contentLen = (savedText || '').length;
            const start = hasSelection ? savedStart : 0;
            const end = hasSelection ? savedEnd : contentLen;
            panelInstance._addLink(url, start, end, savedObjectId);
        }

        _closeForm(form, form._closeOnOutside);
        // Возвращаем фокус в textarea
        if (textarea) {
            try { textarea.focus(); } catch (_) {}
        }
    };

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
        if (e.key === 'Escape') { e.preventDefault(); _closeForm(form, form._closeOnOutside); }
        urlInput.classList.remove('tpp-link-input--error');
    });

    okBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        submit();
    });

    return form;
}

function _insertLink(textarea, { savedStart, savedEnd, savedText, hasSelection, url }) {
    let newValue;
    let newCursorPos;

    if (hasSelection) {
        const selected = savedText.slice(savedStart, savedEnd);
        const mdLink = `[${selected}](${url})`;
        newValue = savedText.slice(0, savedStart) + mdLink + savedText.slice(savedEnd);
        newCursorPos = savedStart + mdLink.length;
    } else {
        const allText = savedText || url;
        const mdLink = `[${allText}](${url})`;
        newValue = mdLink;
        newCursorPos = mdLink.length;
    }

    textarea.value = newValue;
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    // Сигналим autoSize и commit-пайплайну
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function _positionForm(form, textarea, triggerBtn) {
    // Временно делаем видимым для измерения
    form.style.visibility = 'hidden';
    form.style.display = 'flex';

    const anchor = textarea ?? triggerBtn;
    const rect = anchor.getBoundingClientRect();
    const formH = form.offsetHeight || 80;
    const winH = window.innerHeight;

    let top;
    if (rect.bottom + formH + 8 < winH) {
        top = rect.bottom + 8;
    } else {
        top = rect.top - formH - 8;
    }

    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 280));

    form.style.top = `${Math.round(top)}px`;
    form.style.left = `${Math.round(left)}px`;
    form.style.visibility = '';
}

function _closeForm(form, outsideHandler) {
    if (outsideHandler) {
        document.removeEventListener('mousedown', outsideHandler);
    }
    if (form && form.parentNode) {
        form.parentNode.removeChild(form);
    }
}

function _closeExistingForm() {
    const existing = document.getElementById('tpp-link-form-active');
    if (existing) {
        if (existing._closeOnOutside) {
            document.removeEventListener('mousedown', existing._closeOnOutside);
        }
        existing.parentNode?.removeChild(existing);
    }
}

function _truncate(str, max) {
    if (str.length <= max) return str;
    return str.slice(0, max) + '…';
}
