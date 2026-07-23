// SVG-иконки для панели свойств mindmap. Стиль (stroke=currentColor, 22×22)
// согласован с иконками панели Фигуры (ShapePropertiesPanelDom.js).

const wrap = (inner) =>
    `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// ── Форма рамки (кнопка 1) ──────────────────────────────────────────────────
export const ICON_SHAPE = {
    none: wrap('<circle cx="11" cy="11" r="8"/><line x1="5.3" y1="5.3" x2="16.7" y2="16.7"/>'),
    pill: wrap('<rect x="2" y="7" width="18" height="8" rx="4"/>'),
    rounded: wrap('<rect x="3.5" y="5" width="15" height="12" rx="4"/>'),
    rect: wrap('<rect x="3.5" y="5" width="15" height="12" rx="0.5"/>'),
};
export const ICON_SHAPE_TRIGGERS = ICON_SHAPE;

// ── Направление ветвления (кнопка 2) ────────────────────────────────────────
// Иконки tree-horizontal.svg / tree-vertikal.svg из src/assets/icons.
export const ICON_DIRECTION = {
    horizontal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M11 16v-3H3v-2h8V8c0-1.747.6-3.085 1.794-3.939C13.92 3.256 15.424 3 17 3h4v2h-4c-1.423 0-2.421.243-3.044.688C13.4 6.085 13 6.747 13 8v3h8v2h-8v3c0 1.253.4 1.915.956 2.311.623.445 1.62.689 3.044.689h4v2h-4c-1.577 0-3.079-.257-4.206-1.062C11.6 19.085 11 17.746 11 16Z"/></svg>',
    vertical: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M8 11h3V3h2v8h3c1.747 0 3.085.6 3.939 1.794C20.744 13.92 21 15.424 21 17v4h-2v-4c0-1.423-.244-2.421-.688-3.044C17.915 13.4 17.253 13 16 13h-3v8h-2v-8H8c-1.253 0-1.915.4-2.311.956C5.244 14.58 5 15.576 5 17v4H3v-4c0-1.577.257-3.079 1.062-4.206C4.915 11.6 6.253 11 8 11Z"/></svg>',
};
export const ICON_DIRECTION_TRIGGERS = ICON_DIRECTION;

// ── Стиль рамки (кнопка 3) ──────────────────────────────────────────────────
export const ICON_FRAME_STYLE =
    '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><circle cx="7.5" cy="9" r="1.1" fill="currentColor" stroke="none"/><circle cx="11" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="9" r="1.1" fill="currentColor" stroke="none"/></svg>';

// Триггер «Стиль рамки»: диск залит цветом капсулы (превью), тёмная обводка
// #193042 держит силуэт видимым на светлом тулбаре даже для очень светлых цветов.
export function frameFillIcon(hex = '#193042', opacity = 0.8) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><g fill-rule="evenodd" transform="translate(1 1)"><circle cx="11" cy="11" r="11" fill="${hex}" fill-opacity="${opacity}" stroke="#193042" stroke-opacity="0.65" stroke-width="1.1"/><path fill="#193042" fill-opacity="0.22" d="M17 20.221V17h3.221A11.06 11.06 0 0 1 17 20.221zm-12 0A11.06 11.06 0 0 1 1.779 17H5v3.221zM20.221 5H17V1.779A11.06 11.06 0 0 1 20.221 5zM9 .181V1H6.411A10.919 10.919 0 0 1 9 .181zM15.589 1H13V.181c.907.167 1.775.445 2.589.819zM13 21.819V21h2.589c-.814.374-1.682.652-2.589.819zm-4 0A10.919 10.919 0 0 1 6.411 21H9v.819zm-8-6.23A10.919 10.919 0 0 1 .181 13H1v2.589zm0-9.178V9H.181C.348 8.093.626 7.225 1 6.411zM21.819 9H21V6.411c.374.814.652 1.682.819 2.589zM21 15.589V13h.819A10.919 10.919 0 0 1 21 15.589zM5 1.779V5H1.779A11.06 11.06 0 0 1 5 1.779zM5 13h4v4H5v-4zm8 0h4v4h-4v-4zM5 5h4v4H5V5zm8 0h4v4h-4V5zm0 12v4H9v-4h4zm8-8v4h-4V9h4zm-8 0v4H9V9h4zM5 9v4H1V9h4zm8-8v4H9V1h4z"/></g></svg>`;
}

export const ICON_LINE = {
    solid: '<svg width="22" height="14" viewBox="0 0 22 14"><line x1="1" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2"/></svg>',
    dashed: '<svg width="22" height="14" viewBox="0 0 22 14"><line x1="1" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/></svg>',
    dotted: '<svg width="22" height="14" viewBox="0 0 22 14"><line x1="1" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2" stroke-dasharray="1 3.5" stroke-linecap="round"/></svg>',
};

// ── Стиль текста (кнопка 4) ─────────────────────────────────────────────────
// Иконки согласованы с инструментами Текста (TextFormatControls.js: SVG_BOLD/ITALIC/UNDERLINE/STRIKE).
export const ICON_TEXT_STYLE = {
    bold: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.92188 12H13.1719C14.8978 12 16.2969 10.6009 16.2969 8.875C16.2969 7.14911 14.8978 5.75 13.1719 5.75H6.92188V12ZM6.92188 12H13.9531C15.679 12 17.0781 13.3991 17.0781 15.125C17.0781 16.8509 15.679 18.25 13.9531 18.25H6.92188V12Z"></path></svg>',
    italic: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.4688 5.75H10.4375M13.5625 18.25H6.53125M14.3438 5.75L9.65625 18.25"></path></svg>',
    underline: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>',
    strike: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.3125 15.125C7.3125 16.8509 8.71161 18.25 10.4375 18.25H13.5625C15.2884 18.25 16.6875 16.8509 16.6875 15.125C16.6875 13.3991 15.2884 12 13.5625 12M16.6875 8.875C16.6875 7.14911 15.2884 5.75 13.5625 5.75H10.4375C8.71161 5.75 7.3125 7.14911 7.3125 8.875M4.96875 12H19.0312"></path></svg>',
};
export const ICON_TEXT = ICON_TEXT_STYLE.bold;

// ── Выравнивание текста (кнопка 5) ──────────────────────────────────────────
export const ICON_ALIGN = {
    left: '<svg width="18" height="16" viewBox="0 0 18 16"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="1.6"/><line x1="2" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1.6"/><line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.6"/></svg>',
    center: '<svg width="18" height="16" viewBox="0 0 18 16"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="1.6"/><line x1="5" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="1.6"/><line x1="3" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.6"/></svg>',
    right: '<svg width="18" height="16" viewBox="0 0 18 16"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="1.6"/><line x1="7" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="1.6"/><line x1="4" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="1.6"/></svg>',
};
