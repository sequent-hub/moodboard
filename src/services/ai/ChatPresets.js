/**
 * Пресеты системного промпта для чата.
 *
 * Используются кнопками "Manual" / "Style" в композере.
 * Список можно расширять — основное правило: id уникален и стабилен,
 * label короткий (помещается в пилл).
 */

export const CHAT_PRESETS = [
    {
        id: 'default',
        label: 'Default',
        kind: 'manual',
        systemPrompt: 'Ты — ассистент внутри инструмента moodboard. Отвечай по делу, кратко и на русском.'
    },
    {
        id: 'design-helper',
        label: 'Design helper',
        kind: 'style',
        systemPrompt: 'Ты — ассистент по визуальному дизайну и мудбордам. Помогай с подбором палитр, сетки, типографики, референсов и подачи. Пиши кратко, давай конкретные значения (HEX, размеры, шрифты).'
    },
    {
        id: 'copywriter',
        label: 'Copywriter',
        kind: 'style',
        systemPrompt: 'Ты — ассистент-копирайтер. Помогай формулировать заголовки, описания, тексты для слайдов и презентаций. Сохраняй смысл, делай короче и яснее.'
    },
    {
        id: 'strict-editor',
        label: 'Strict editor',
        kind: 'manual',
        systemPrompt: 'Ты — строгий редактор. Проверяй текст на ошибки, тавтологии, штампы. Возвращай исправленный вариант и список изменений.'
    }
];

export const DEFAULT_PRESET_ID = 'default';

export function getPresetById(id) {
    return CHAT_PRESETS.find((p) => p.id === id) || CHAT_PRESETS[0];
}
