/**
 * Глобальные ссылки на слои (нужны хосту и отладке) в виде пар
 * [ключ window, поле board]. Единый источник правды для установки и снятия:
 * MoodBoardUiFactory расставляет ссылки, destroyMoodBoard снимает ровно эти же
 * ключи. Иначе уничтоженный экземпляр остаётся достижимым из window вместе с
 * открепленным DOM и слушателями — до перезагрузки страницы.
 *
 * Модуль сознательно без импортов: его подключает lifecycle-код, которому не
 * нужен весь UI-граф фабрики.
 * @type {ReadonlyArray<[string, string]>}
 */
export const LAYER_GLOBAL_REFS = [
    ['moodboardHtmlTextLayer', 'htmlTextLayer'],
    ['moodboardMindmapHtmlTextLayer', 'mindmapHtmlTextLayer'],
    ['moodboardMindmapConnectionLayer', 'mindmapConnectionLayer'],
    ['moodboardMindmapCollapseLayer', 'mindmapCollapseLayer'],
    ['moodboardConnectorLayer', 'connectorLayer'],
    ['moodboardConnectorLabelLayer', 'connectorLabelLayer'],
    ['moodboardConnectionAnchorsLayer', 'connectionAnchorsLayer'],
    ['moodboardConnectorHandlesLayer', 'connectorHandlesLayer'],
    ['moodboardHtmlHandlesLayer', 'htmlHandlesLayer'],
];
