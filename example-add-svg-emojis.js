/**
 * ПРИМЕР: Как добавить ваши SVG эмоджи в MoodBoard
 * 
 * Этот файл показывает, как встроить SVG код ваших эмоджи
 * прямо в MoodBoard, полностью избежав проблем с загрузкой файлов
 */

import { MoodBoard, bulkAddInlineSvgEmojis, addInlineSvgEmoji } from './src/index.js';

// СПОСОБ 1: Массовое добавление ваших SVG эмоджи
const yourSvgEmojis = {
    // Замените на ваш реальный SVG код
    '😎': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle fill="#FFCC4D" cx="18" cy="18" r="18"/>
        <!-- Ваш SVG код здесь -->
    </svg>`,
    
    '🔥': `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <path fill="#DD2E44" d="M..."/>
        <!-- Ваш SVG код здесь -->
    </svg>`,
    
    // Добавьте сколько нужно...
};

// СПОСОБ 2: Если у вас есть SVG файлы, конвертируйте их:
function loadSvgFromFiles() {
    // Для bundled версий можете импортировать SVG как строки:
    // import smileySvg from './assets/emojis/smiley.svg?raw';
    // import fireSvg from './assets/emojis/fire.svg?raw';
    
    const fileBasedEmojis = {
        // '😀': smileySvg,
        // '🔥': fireSvg,
    };
    
    return fileBasedEmojis;
}

// ИНИЦИАЛИЗАЦИЯ
async function initMoodBoardWithYourEmojis() {
    console.log('🚀 Добавляем ваши SVG эмоджи...');
    
    // Добавляем эмоджи ПЕРЕД созданием MoodBoard
    const addedCount = bulkAddInlineSvgEmojis(yourSvgEmojis);
    
    // Можете добавлять по одному:
    // addInlineSvgEmoji('🎨', '<svg>...</svg>');
    
    console.log(`✅ Добавлено ${addedCount} встроенных SVG эмоджи`);
    
    // Создаем MoodBoard как обычно
    const moodboard = new MoodBoard('#moodboard-container', {
        theme: 'light',
        // больше никаких emojiBasePath не нужно!
    });
    
    return moodboard;
}

// АВТОМАТИЧЕСКАЯ КОНВЕРТАЦИЯ ваших файлов (для Node.js окружения)
import fs from 'fs';
import path from 'path';

function convertYourSvgFilesToCode(svgDirectory) {
    const emojis = {};
    const files = fs.readdirSync(svgDirectory);
    
    files.forEach(file => {
        if (file.endsWith('.svg')) {
            const svgPath = path.join(svgDirectory, file);
            const svgContent = fs.readFileSync(svgPath, 'utf-8');
            
            // Маппинг имени файла на эмоджи символ
            // Настройте под ваши файлы:
            const emojiMapping = {
                'smiley.svg': '😀',
                'heart.svg': '❤️',
                'thumbs-up.svg': '👍',
                'fire.svg': '🔥',
                // добавьте ваши...
            };
            
            const emoji = emojiMapping[file];
            if (emoji) {
                emojis[emoji] = svgContent;
            }
        }
    });
    
    return emojis;
}

// ИСПОЛЬЗОВАНИЕ:
// const convertedEmojis = convertYourSvgFilesToCode('./path/to/your/svg/emojis/');
// bulkAddInlineSvgEmojis(convertedEmojis);

export { initMoodBoardWithYourEmojis };
