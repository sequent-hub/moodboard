/**
 * Встроенная коллекция SVG эмоджи
 * SVG код встроен прямо в JavaScript для избежания проблем с загрузкой файлов
 */

// Встроенные SVG эмоджи как строки
export const INLINE_SVG_EMOJIS = {
    // Смайлики
    '😀': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle fill="#FFCC4D" cx="18" cy="18" r="18"/>
        <path fill="#664500" d="M10.515 23.621C10.56 23.8 11.683 28 18 28c6.318 0 7.44-4.2 7.485-4.379.055-.222-.025-.447-.204-.571-.18-.124-.403-.115-.571.024C24.629 23.145 22.112 25 18 25s-6.63-1.855-6.71-1.926c-.168-.139-.39-.148-.571-.024-.179.124-.259.349-.204.571z"/>
        <ellipse fill="#664500" cx="12" cy="13.5" rx="2.5" ry="3.5"/>
        <ellipse fill="#664500" cx="24" cy="13.5" rx="2.5" ry="3.5"/>
    </svg>`,
    
    '😊': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle fill="#FFCC4D" cx="18" cy="18" r="18"/>
        <path fill="#664500" d="M10.515 23.621C10.56 23.8 11.683 28 18 28c6.318 0 7.44-4.2 7.485-4.379.055-.222-.025-.447-.204-.571-.18-.124-.403-.115-.571.024C24.629 23.145 22.112 25 18 25s-6.63-1.855-6.71-1.926c-.168-.139-.39-.148-.571-.024-.179.124-.259.349-.204.571z"/>
        <ellipse fill="#664500" cx="12" cy="13.5" rx="2.5" ry="3.5"/>
        <ellipse fill="#664500" cx="24" cy="13.5" rx="2.5" ry="3.5"/>
        <circle fill="#F4900C" cx="18" cy="13" r="2"/>
    </svg>`,
    
    '😂': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle fill="#FFCC4D" cx="18" cy="18" r="18"/>
        <path fill="#664500" d="M10.515 23.621C10.56 23.8 11.683 28 18 28c6.318 0 7.44-4.2 7.485-4.379.055-.222-.025-.447-.204-.571-.18-.124-.403-.115-.571.024C24.629 23.145 22.112 25 18 25s-6.63-1.855-6.71-1.926c-.168-.139-.39-.148-.571-.024-.179.124-.259.349-.204.571z"/>
        <ellipse fill="#664500" cx="12" cy="13.5" rx="2.5" ry="3.5"/>
        <ellipse fill="#664500" cx="24" cy="13.5" rx="2.5" ry="3.5"/>
        <path fill="#55ACEE" d="M5 17c.552 0 1 .447 1 1v1c0 .552-.448 1-1 1s-1-.448-1-1v-1c0-.553.448-1 1-1z"/>
        <path fill="#55ACEE" d="M31 17c.553 0 1 .447 1 1v1c0 .552-.447 1-1 1-.553 0-1-.448-1-1v-1c0-.553.447-1 1-1z"/>
    </svg>`,
    
    '😎': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle fill="#FFCC4D" cx="18" cy="18" r="18"/>
        <path fill="#664500" d="M10.515 23.621C10.56 23.8 11.683 28 18 28c6.318 0 7.44-4.2 7.485-4.379.055-.222-.025-.447-.204-.571-.18-.124-.403-.115-.571.024C24.629 23.145 22.112 25 18 25s-6.63-1.855-6.71-1.926c-.168-.139-.39-.148-.571-.024-.179.124-.259.349-.204.571z"/>
        <path fill="#292F33" d="M31 13c0-3.866-3.134-7-7-7H12c-3.866 0-7 3.134-7 7v1c0 3.866 3.134 7 7 7h12c3.866 0 7-3.134 7-7v-1z"/>
        <circle fill="#F4900C" cx="12" cy="13.5" r="6"/>
        <circle fill="#F4900C" cx="24" cy="13.5" r="6"/>
    </svg>`,
    
    '🤔': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle fill="#FFCC4D" cx="18" cy="18" r="18"/>
        <path fill="#664500" d="M8 19.5c0 1.381 1.119 2.5 2.5 2.5s2.5-1.119 2.5-2.5S11.881 17 10.5 17 8 18.119 8 19.5z"/>
        <ellipse fill="#664500" cx="25" cy="19.5" rx="2.5" ry="1.5"/>
        <path fill="#664500" d="M22.313 12.062c-.511-.478-1.321-.444-1.799.069-.479.512-.444 1.321.068 1.8.718.671 1.359 1.284 1.359 2.069 0 .552.447 1 1 1s1-.448 1-1c0-1.429-.932-2.427-1.628-3.938z"/>
    </svg>`,
    
    '👍': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <path fill="#EF9645" d="M4.861 9.147c-.629-.628-.63-1.657-.001-2.286l.244-.244c.628-.628 1.656-.63 2.285-.001l1.903 1.902c.628.629.629 1.657.001 2.286l-.244.244c-.628.628-1.656.63-2.285.001L4.861 9.147z"/>
        <path fill="#FFDC5D" d="M3.968 21.892c-.628.629-1.657.628-2.285 0l-.244-.244c-.628-.628-.629-1.656-.001-2.285l1.902-1.903c.629-.628 1.657-.629 2.286-.001l.244.244c.628.628.629 1.656.001 2.285l-1.903 1.904z"/>
        <path fill="#FFAC33" d="M7 11c0 5.522-4.478 10-10 10s-10-4.478-10-10 4.478-10 10-10 10 4.478 10 10z"/>
    </svg>`,
    
    '👎': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <path fill="#EF9645" d="M31.139 26.853c.629.628.63 1.657.001 2.286l-.244.244c-.628.628-1.656.63-2.285.001l-1.903-1.902c-.628-.629-.629-1.657-.001-2.286l.244-.244c.628-.628 1.656-.63 2.285-.001l1.903 1.902z"/>
        <path fill="#FFDC5D" d="M32.032 14.108c.628-.629 1.657-.628 2.285 0l.244.244c.628.628.629 1.656.001 2.285l-1.902 1.903c-.629.628-1.657.629-2.286.001l-.244-.244c-.628-.628-.629-1.656-.001-2.285l1.903-1.904z"/>
        <path fill="#FFAC33" d="M29 25c0-5.522 4.478-10 10-10s10 4.478 10 10-4.478 10-10 10-10-4.478-10-10z"/>
    </svg>`,
    
    '❤️': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <path fill="#DD2E44" d="M35.885 11.833c0-5.45-4.418-9.868-9.867-9.868-3.308 0-6.227 1.633-8.018 4.129-1.791-2.496-4.71-4.129-8.017-4.129-5.45 0-9.868 4.417-9.868 9.868 0 .772.098 1.52.266 2.241C1.751 22.587 11.216 31.568 18 34.034c6.784-2.466 16.249-11.447 17.619-19.96.168-.721.266-1.469.266-2.241z"/>
    </svg>`,
    
    '🔥': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <path fill="#DD2E44" d="M18 10c-1.105 0-2 .895-2 2v8c0 1.105.895 2 2 2s2-.895 2-2v-8c0-1.105-.895-2-2-2z"/>
        <path fill="#F4900C" d="M18 6c-.553 0-1 .447-1 1v4c0 .553.447 1 1 1s1-.447 1-1V7c0-.553-.447-1-1-1z"/>
        <path fill="#FFAC33" d="M18 26c3.314 0 6-2.686 6-6 0-3.314-2.686-6-6-6s-6 2.686-6 6c0 3.314 2.686 6 6 6z"/>
    </svg>`,
    
    '🎉': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <path fill="#FFCC4D" d="M36 17c0 1.104-.896 2-2 2H2c-1.104 0-2-.896-2-2s.896-2 2-2h32c1.104 0 2 .896 2 2z"/>
        <path fill="#DD2E44" d="M35.5 9c0 .828-.672 1.5-1.5 1.5s-1.5-.672-1.5-1.5.672-1.5 1.5-1.5 1.5.672 1.5 1.5z"/>
        <path fill="#55ACEE" d="M3.5 27c0 .828-.672 1.5-1.5 1.5S.5 27.828.5 27s.672-1.5 1.5-1.5 1.5.672 1.5 1.5z"/>
        <path fill="#F4900C" d="M31 25c.552 0 1 .447 1 1v4c0 .552-.448 1-1 1s-1-.448-1-1v-4c0-.553.448-1 1-1z"/>
    </svg>`
};

/**
 * Конвертирует SVG строку в Data URL для использования с PIXI.Texture
 * @param {string} svgString - SVG код
 * @returns {string} Data URL
 */
export function svgToDataUrl(svgString) {
    // Очищаем SVG от лишних пробелов и переносов
    const cleanSvg = svgString.replace(/\s+/g, ' ').trim();
    
    // Кодируем в base64 или используем URL encoding
    const encoded = encodeURIComponent(cleanSvg);
    
    return `data:image/svg+xml,${encoded}`;
}

/**
 * Получает Data URL для эмоджи по символу
 * @param {string} emoji - символ эмоджи
 * @returns {string|null} Data URL или null если эмоджи не найден
 */
export function getInlineEmojiUrl(emoji) {
    const svgCode = INLINE_SVG_EMOJIS[emoji];
    if (!svgCode) return null;
    
    return svgToDataUrl(svgCode);
}

/**
 * Получает список всех доступных встроенных эмоджи
 * @returns {string[]} массив символов эмоджи
 */
export function getAvailableInlineEmojis() {
    return Object.keys(INLINE_SVG_EMOJIS);
}

/**
 * Проверяет, поддерживается ли эмоджи как встроенный SVG
 * @param {string} emoji - символ эмоджи  
 * @returns {boolean}
 */
export function isInlineSvgEmoji(emoji) {
    return emoji in INLINE_SVG_EMOJIS;
}

/**
 * Добавляет новый SVG эмоджи в коллекцию
 * @param {string} emoji - символ эмоджи
 * @param {string} svgCode - SVG код
 * @returns {boolean} успех операции
 */
export function addInlineSvgEmoji(emoji, svgCode) {
    try {
        if (!emoji || !svgCode) return false;
        INLINE_SVG_EMOJIS[emoji] = svgCode;
        console.log('✅ Добавлен встроенный SVG эмоджи:', emoji);
        return true;
    } catch (error) {
        console.error('❌ Ошибка добавления SVG эмоджи:', error);
        return false;
    }
}

/**
 * МАССОВОЕ ДОБАВЛЕНИЕ эмоджи из вашего проекта
 * @param {Object} emojiMap - объект {emoji: svgCode, ...}
 * @returns {number} количество добавленных эмоджи
 */
export function bulkAddInlineSvgEmojis(emojiMap) {
    let added = 0;
    try {
        for (const [emoji, svgCode] of Object.entries(emojiMap)) {
            if (addInlineSvgEmoji(emoji, svgCode)) {
                added++;
            }
        }
        console.log(`✅ Массово добавлено ${added} встроенных SVG эмоджи`);
        return added;
    } catch (error) {
        console.error('❌ Ошибка массового добавления эмоджи:', error);
        return added;
    }
}
