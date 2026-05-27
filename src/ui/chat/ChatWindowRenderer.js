import { ICONS } from './icons.js';

/**
 * Чистый билд DOM-разметки чата.
 *
 * Одна ответственность: построить дерево узлов и вернуть ссылки на
 * ключевые элементы. Никаких listeners, никакого состояния, никаких
 * бизнес-правил — этим занимается ChatWindowController.
 *
 * Структура соответствует макету:
 *   .moodboard-chat
 *     ├ .moodboard-chat__history
 *     └ .moodboard-chat__composer
 *         ├ .moodboard-chat__input-row     (textarea + settings)
 *         └ .moodboard-chat__actions-row   (content type + pills + attach + send)
 */
export function buildChatDom() {
    const root = createDiv('moodboard-chat');

    const history = createDiv('moodboard-chat__history');
    history.setAttribute('role', 'log');
    history.setAttribute('aria-live', 'polite');

    const composer = createDiv('moodboard-chat__composer');

    const rendererRefs = {
        root,
        history,
        composer
    };

    composer.appendChild(buildInputRow(refs => Object.assign(rendererRefs, refs)));
    composer.appendChild(buildActionsRow(refs => Object.assign(rendererRefs, refs)));

    root.appendChild(history);
    root.appendChild(composer);

    // input/actions добавили свои ссылки в rendererRefs через collect-callback'и выше.
    // На этом этапе rendererRefs уже содержит все ключи.
    return rendererRefs;
}

function buildInputRow(collect) {
    const row = createDiv('moodboard-chat__input-row');

    const textarea = document.createElement('textarea');
    textarea.className = 'moodboard-chat__textarea';
    textarea.rows = 1;
    textarea.placeholder = 'Describe what you want to generate';
    textarea.setAttribute('aria-label', 'Сообщение');
    row.appendChild(textarea);

    const settingsTriggerWrapper = document.createElement('div');
    settingsTriggerWrapper.className = 'moodboard-chat__pill-wrapper';

    const settingsTrigger = document.createElement('button');
    settingsTrigger.type = 'button';
    settingsTrigger.className = 'moodboard-chat__settings-trigger';
    settingsTrigger.setAttribute('aria-label', 'Настройки чата');
    settingsTrigger.innerHTML = ICONS.sliders;
    settingsTriggerWrapper.appendChild(settingsTrigger);

    const settingsPopup = createDiv('moodboard-chat__settings-popup');
    settingsTriggerWrapper.appendChild(settingsPopup);

    row.appendChild(settingsTriggerWrapper);

    collect({ textarea, settingsTrigger, settingsPopup });
    return row;
}

function buildActionsRow(collect) {
    const row = createDiv('moodboard-chat__actions-row');

    const pills = createDiv('moodboard-chat__pills');

    const contentTypeWrapper = pillWithMenu('Изображение', ICONS.image);
    contentTypeWrapper.pill.title = 'Тип генерируемого контента';
    contentTypeWrapper.pill.setAttribute('aria-label', 'Тип генерируемого контента');

    const modelWrapper = pillWithMenu('Алиса', ICONS.model);
    modelWrapper.pill.title = 'Модель ИИ';
    modelWrapper.pill.setAttribute('aria-label', 'Модель ИИ');

    const formatWrapper = pillWithMenu('Auto', ICONS.ratio);
    formatWrapper.pill.title = 'Формат изображения';
    formatWrapper.pill.setAttribute('aria-label', 'Формат изображения');
    formatWrapper.menu.classList.add('moodboard-chat__menu--grid');

    const countWrapper = pillWithMenu('Авто', ICONS.count);
    countWrapper.pill.title = 'Количество изображений';
    countWrapper.pill.setAttribute('aria-label', 'Количество изображений');

    pills.appendChild(contentTypeWrapper.wrapper);
    pills.appendChild(modelWrapper.wrapper);
    pills.appendChild(formatWrapper.wrapper);
    pills.appendChild(countWrapper.wrapper);

    const sendRow = createDiv('moodboard-chat__send-row');

    const attach = document.createElement('button');
    attach.type = 'button';
    attach.className = 'moodboard-chat__attach';
    attach.disabled = true;
    attach.title = 'Вложения появятся позже';
    attach.setAttribute('aria-label', 'Вложение (недоступно)');
    attach.innerHTML = ICONS.paperclip;

    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'moodboard-chat__send';
    send.dataset.state = 'idle';
    send.setAttribute('aria-label', 'Отправить');
    send.innerHTML = ICONS.arrowUp;

    sendRow.appendChild(attach);
    sendRow.appendChild(send);

    row.appendChild(pills);
    row.appendChild(sendRow);

    collect({
        pills,
        contentTypePill: contentTypeWrapper.pill,
        contentTypeMenu: contentTypeWrapper.menu,
        contentTypeLabel: contentTypeWrapper.labelEl,
        contentTypeIcon: contentTypeWrapper.iconEl,
        modelPill: modelWrapper.pill,
        modelMenu: modelWrapper.menu,
        modelLabel: modelWrapper.labelEl,
        modelIcon: modelWrapper.iconEl,
        formatPill: formatWrapper.pill,
        formatMenu: formatWrapper.menu,
        formatLabel: formatWrapper.labelEl,
        countPill: countWrapper.pill,
        countMenu: countWrapper.menu,
        countLabel: countWrapper.labelEl,
        countIcon: countWrapper.iconEl,
        attach,
        send
    });
    return row;
}

function pillWithMenu(label, iconSvg) {
    const wrapper = document.createElement('div');
    wrapper.className = 'moodboard-chat__pill-wrapper';

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'moodboard-chat__pill';
    pill.setAttribute('aria-haspopup', 'menu');
    pill.setAttribute('aria-expanded', 'false');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'moodboard-chat__pill-icon-wrap';
    iconSpan.innerHTML = iconSvg;

    const labelEl = document.createElement('span');
    labelEl.className = 'moodboard-chat__pill-label';
    labelEl.textContent = label;

    pill.appendChild(iconSpan);
    pill.appendChild(labelEl);

    const menu = createDiv('moodboard-chat__menu');
    menu.setAttribute('role', 'menu');

    wrapper.appendChild(pill);
    wrapper.appendChild(menu);
    return { wrapper, pill, menu, labelEl, iconEl: iconSpan };
}

function createDiv(className) {
    const el = document.createElement('div');
    el.className = className;
    return el;
}
