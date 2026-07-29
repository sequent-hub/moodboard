/**
 * Палитра и payload размещения записки.
 * Общий источник для кнопки note-add и образцов цвета: кнопка включает режим
 * размещения с цветом по умолчанию, образец лишь переопределяет цвет.
 */

export const NOTE_COLORS = [
    { name: 'Жёлтый', hex: '#FCF3AF', border: '#ECDD85' },
    { name: 'Оранжевый', hex: '#FFC291', border: '#ED8A5C' },
    { name: 'Лососевый', hex: '#F9C6C6', border: '#EB9091' },
    { name: 'Розовый', hex: '#F3C6E2', border: '#E38EC3' },
    { name: 'Синий', hex: '#B7D9F8', border: '#5E93EF' },
    { name: 'Фиолетовый', hex: '#E3CCF4', border: '#BE93E4' },
    { name: 'Голубой', hex: '#A5DCED', border: '#46B8D8' },
    { name: 'Барвинок', hex: '#C6D4F9', border: '#8DA4EF' },
    { name: 'Зелёный', hex: '#C6DE99', border: '#9AB654' },
    { name: 'Мятный', hex: '#B0E0CC', border: '#56BA9F' },
    { name: 'Белый', hex: '#F1F1F1', border: '#D4D4D4' },
    { name: 'Серый', hex: '#DDDDDD', border: '#B3B3B3' },
];

export const DEFAULT_NOTE_COLOR = NOTE_COLORS[0];

export const DEFAULT_NOTE_BACKGROUND_COLOR = parseInt(DEFAULT_NOTE_COLOR.hex.slice(1), 16);

export function createNotePlacementPayload(backgroundColor = DEFAULT_NOTE_BACKGROUND_COLOR) {
    return {
        type: 'note',
        properties: {
            content: '',
            fontFamily: 'Caveat, Arial, cursive',
            fontSize: 32,
            width: 250,
            height: 250,
            backgroundColor,
            // Явный left только для новых записок: NoteObject по умолчанию центрирует,
            // поэтому ранее созданные записки без сохранённого textAlign не меняют вид.
            textAlign: 'left',
        },
    };
}
