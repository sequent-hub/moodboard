/**
 * TextListRenderer — рендер контента текстового объекта как DOM-списка.
 * Вызывается из HtmlTextLayer вместо plain/markdown-пути,
 * когда listType !== 'none'.
 *
 * Безопасность: пользовательский текст добавляется только через textContent,
 * innerHTML не используется.
 */

/**
 * Строит DOM-список внутри переданного элемента.
 * @param {HTMLElement} el         - контейнер (очищается перед рендером)
 * @param {string}      content    - строки, разделённые \n
 * @param {'bullet'|'numbered'|'checkbox'} listType
 * @param {boolean[]}   listChecked - состояния чекбоксов по индексу строки
 * @param {function(number):void}  onToggle - вызывается при клике на чекбокс
 */
export function renderTextList(el, content, listType, listChecked, onToggle) {
    while (el.firstChild) el.removeChild(el.firstChild);

    const lines = typeof content === 'string' ? content.split('\n') : [''];

    if (listType === 'bullet') {
        _renderBullet(el, lines);
    } else if (listType === 'numbered') {
        _renderNumbered(el, lines);
    } else if (listType === 'checkbox') {
        _renderCheckbox(el, lines, listChecked, onToggle);
    }
}

// ─── bullet ──────────────────────────────────────────────────────────────────

function _renderBullet(el, lines) {
    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none;margin:0;padding:0;';

    lines.forEach((lineText) => {
        const item = document.createElement('li');
        item.style.cssText = 'display:flex;align-items:baseline;gap:0.4em;';

        const marker = document.createElement('span');
        marker.textContent = '•';
        marker.style.cssText = 'flex-shrink:0;user-select:none;';

        const text = document.createElement('span');
        text.textContent = lineText;

        item.appendChild(marker);
        item.appendChild(text);
        list.appendChild(item);
    });

    el.appendChild(list);
}

// ─── numbered ─────────────────────────────────────────────────────────────────

function _renderNumbered(el, lines) {
    const list = document.createElement('ol');
    list.style.cssText = 'list-style:none;margin:0;padding:0;';

    lines.forEach((lineText, idx) => {
        const item = document.createElement('li');
        item.style.cssText = 'display:flex;align-items:baseline;gap:0.4em;';

        const marker = document.createElement('span');
        marker.textContent = `${idx + 1}.`;
        marker.style.cssText = 'flex-shrink:0;user-select:none;min-width:1.8em;text-align:right;';

        const text = document.createElement('span');
        text.textContent = lineText;

        item.appendChild(marker);
        item.appendChild(text);
        list.appendChild(item);
    });

    el.appendChild(list);
}

// ─── checkbox ─────────────────────────────────────────────────────────────────

function _renderCheckbox(el, lines, listChecked, onToggle) {
    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none;margin:0;padding:0;';

    lines.forEach((lineText, idx) => {
        const checked = Array.isArray(listChecked) ? !!listChecked[idx] : false;

        const item = document.createElement('li');
        item.style.cssText = 'display:flex;align-items:center;gap:0.5em;';

        // pointer-events: auto — точечно только на чекбоксе.
        // Родительский .moodboard-html-layer имеет pointer-events: none.
        const box = document.createElement('span');
        box.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'width:1em',
            'height:1em',
            'min-width:1em',
            'border:1.5px solid currentColor',
            'border-radius:2px',
            'flex-shrink:0',
            'cursor:pointer',
            'user-select:none',
            'pointer-events:auto',  // ключевое включение
        ].join(';') + ';';

        if (checked) {
            const tick = document.createElement('span');
            tick.textContent = '✓';
            tick.style.cssText = 'font-size:0.75em;line-height:1;pointer-events:none;';
            box.appendChild(tick);
        }

        box.addEventListener('click', (e) => {
            // stopPropagation: клик не должен уходить в canvas (выделение/драг)
            e.stopPropagation();
            if (typeof onToggle === 'function') onToggle(idx);
        });

        const text = document.createElement('span');
        text.textContent = lineText;
        if (checked) {
            text.style.cssText = 'text-decoration:line-through;opacity:0.6;';
        }

        item.appendChild(box);
        item.appendChild(text);
        list.appendChild(item);
    });

    el.appendChild(list);
}
