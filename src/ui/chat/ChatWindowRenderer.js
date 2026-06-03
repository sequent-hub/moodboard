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
 *         ├ .moodboard-chat__input-row     (textarea + prompt actions)
 *         └ .moodboard-chat__actions-row   (content type + pills + attach + send)
 */
export function buildChatDom() {
    const root = createDiv('moodboard-chat');

    const history = createDiv('moodboard-chat__history');
    history.setAttribute('role', 'log');
    history.setAttribute('aria-live', 'polite');

    const composer = createDiv('moodboard-chat__composer');

    const statusBar = createDiv('moodboard-chat__status-bar');
    statusBar.setAttribute('aria-live', 'polite');
    statusBar.setAttribute('aria-atomic', 'true');
    statusBar.innerHTML = '<span class="moodboard-chat__status-bar-text">Идёт процесс генерации изображения…</span>';

    const pendingImages = createDiv('moodboard-chat__pending-images');

    const rendererRefs = {
        root,
        history,
        composer,
        statusBar,
        pendingImages
    };

    composer.appendChild(buildInputRow(refs => Object.assign(rendererRefs, refs)));
    composer.appendChild(buildActionsRow(refs => Object.assign(rendererRefs, refs)));

    root.appendChild(history);
    root.appendChild(pendingImages);
    root.appendChild(statusBar);
    root.appendChild(composer);

    // input/actions добавили свои ссылки в rendererRefs через collect-callback'и выше.
    // На этом этапе rendererRefs уже содержит все ключи.
    return rendererRefs;
}

function buildInputRow(collect) {
    const row = createDiv('moodboard-chat__input-row');

    const attachmentsPreview = createDiv('moodboard-chat__attachments');

    const textareaRow = createDiv('moodboard-chat__textarea-row');

    const textarea = document.createElement('textarea');
    textarea.className = 'moodboard-chat__textarea';
    textarea.rows = 1;
    textarea.placeholder = 'Опишите то, что хотите сгенерировать';
    textarea.setAttribute('aria-label', 'Сообщение');

    const promptActionsWrapper = document.createElement('div');
    promptActionsWrapper.className = 'moodboard-chat__pill-wrapper';

    const extendPromptField = createInputIconButton(
        'extend-promt-field',
        'Развернуть поле ввода',
        ICONS.extendPromptField
    );

    promptActionsWrapper.appendChild(extendPromptField);
    textareaRow.appendChild(textarea);
    textareaRow.appendChild(promptActionsWrapper);
    row.appendChild(attachmentsPreview);
    row.appendChild(textareaRow);

    collect({ textarea, extendPromptField, attachmentsPreview });
    return row;
}

function buildActionsRow(collect) {
    const row = createDiv('moodboard-chat__actions-row');

    const pills = createDiv('moodboard-chat__pills');

    const contentTypeWrapper = pillWithMenu('Изображение', ICONS.image, 'chat-menu-content-type');
    contentTypeWrapper.pill.title = 'Тип генерируемого контента';
    contentTypeWrapper.pill.setAttribute('aria-label', 'Тип генерируемого контента');

    const modelWrapper = pillWithMenu('Алиса', ICONS.model, 'chat-menu-model');
    modelWrapper.pill.title = 'Модель ИИ';
    modelWrapper.pill.setAttribute('aria-label', 'Модель ИИ');

    const formatWrapper = pillWithMenu('Auto', ICONS.ratio, 'chat-menu-format');
    formatWrapper.pill.title = 'Формат изображения';
    formatWrapper.pill.setAttribute('aria-label', 'Формат изображения');
    formatWrapper.menu.classList.add('moodboard-chat__menu--grid');

    const countWrapper = pillWithMenu('Авто', ICONS.count, 'chat-menu-count');
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
    attach.title = 'Прикрепить файл';
    attach.setAttribute('aria-label', 'Прикрепить файл');
    attach.innerHTML = ICONS.attach;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,.pdf,.txt,.doc,.docx';
    fileInput.className = 'moodboard-chat__file-input';
    fileInput.setAttribute('aria-hidden', 'true');
    fileInput.setAttribute('tabindex', '-1');

    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'moodboard-chat__send';
    send.dataset.state = 'idle';
    send.setAttribute('aria-label', 'Отправить');
    send.innerHTML = ICONS.send;

    sendRow.appendChild(attach);
    sendRow.appendChild(fileInput);
    sendRow.appendChild(send);

    row.appendChild(pills);
    row.appendChild(sendRow);

    collect({
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
        fileInput,
        send
    });
    return row;
}

function pillWithMenu(label, iconSvg, menuId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'moodboard-chat__pill-wrapper';

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'moodboard-chat__pill';
    pill.setAttribute('aria-haspopup', 'menu');
    pill.setAttribute('aria-expanded', 'false');
    if (menuId) pill.setAttribute('aria-controls', menuId);

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
    if (menuId) menu.id = menuId;

    wrapper.appendChild(pill);
    wrapper.appendChild(menu);
    return { wrapper, pill, menu, labelEl, iconEl: iconSpan };
}

function createInputIconButton(name, ariaLabel, iconSvg) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `moodboard-chat__input-icon-btn moodboard-chat__input-icon-btn--${name}`;
    button.setAttribute('aria-label', ariaLabel);
    button.innerHTML = iconSvg;
    return button;
}

function createDiv(className) {
    const el = document.createElement('div');
    el.className = className;
    return el;
}
