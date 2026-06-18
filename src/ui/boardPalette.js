/**
 * Палитра фонов доски.
 * Первый элемент используется как фон по умолчанию при создании/первом открытии доски.
 * btnHex — цвет кнопки в Topbar; board — реальный цвет фона canvas.
 */
export const BOARD_PALETTE = [
    { id: 1, name: 'default-light', btnHex: '#d6e8f7', board: '#f0f6fc', gridColor: '#d4d4d4' },
    { id: 2, name: 'mint-light',    btnHex: '#E8F5E9', board: '#f8fff7' },
    { id: 3, name: 'peach-light',   btnHex: '#FFF3E0', board: '#fffcf7' },
    { id: 4, name: 'gray-light',    btnHex: '#f5f5f5', board: '#f5f5f5' },
    { id: 5, name: 'white',         btnHex: '#ffffff', board: '#ffffff' },
];
