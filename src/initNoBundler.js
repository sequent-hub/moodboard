/**
 * Инициализация MoodBoard для использования без bundler (в Laravel и др.)
 */
import { MoodBoard } from './moodboard/MoodBoard.js';
import { StyleLoader } from './utils/styleLoader.js';
import { EmojiLoaderNoBundler } from './utils/emojiLoaderNoBundler.js';

/**
 * Инициализирует MoodBoard с автоматической загрузкой стилей и ресурсов
 * @param {string|HTMLElement} container - контейнер для MoodBoard
 * @param {Object} options - опции MoodBoard
 * @param {string} basePath - базовый путь к пакету (например: '/node_modules/moodboard-futurello/')
 * @returns {Promise<MoodBoard>} готовый экземпляр MoodBoard
 */
export async function initMoodBoardNoBundler(container, options = {}, basePath = '') {
    
    // 1. Загружаем стили
    const styleLoader = new StyleLoader();
    await styleLoader.loadAllStyles(basePath);
    
    // 2. Инициализируем загрузчик эмоджи
    const emojiLoader = new EmojiLoaderNoBundler();
    emojiLoader.init(basePath);
    
    // 3. Загружаем эмоджи для использования в панели
    const emojiGroups = await emojiLoader.loadEmojis();
    
    // 4. Передаем загрузчик эмоджи в опции
    const enhancedOptions = {
        ...options,
        emojiLoader: emojiLoader,
        emojiGroups: emojiGroups,
        emojiBasePath: basePath ? `${basePath}src/assets/emodji/` : null,
        noBundler: true
    };
    
    // 5. Создаем MoodBoard
    const moodboard = new MoodBoard(container, enhancedOptions);
    
    
    return moodboard;
}

/**
 * Инжектирует критичные стили inline для мгновенного отображения
 */
export function injectCriticalStyles() {
    const criticalCSS = `
        /* Критичные стили для мгновенного отображения */
        .moodboard-workspace {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #f7fbff;
        }
        
        .moodboard-toolbar {
            position: absolute;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 1000;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .moodboard-topbar {
            position: absolute;
            top: 20px;
            left: 20px;
            right: 20px;
            z-index: 1000;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 8px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            height: 44px;
        }
        
        .moodboard-html-handles {
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 999;
        }
        
        /* Скрыть до полной загрузки стилей */
        .moodboard-toolbar__popup,
        .moodboard-properties-panel {
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .moodboard-styles-loaded .moodboard-toolbar__popup,
        .moodboard-styles-loaded .moodboard-properties-panel {
            opacity: 1;
        }
    `;

    const style = document.createElement('style');
    style.id = 'moodboard-critical-styles';
    style.textContent = criticalCSS;
    document.head.appendChild(style);
}

/**
 * Простая инициализация только с критичными стилями
 * Для быстрого запуска, полные стили загружаются асинхронно
 */
export function quickInitMoodBoard(container, options = {}, basePath = '') {
    // Инжектируем критичные стили сразу
    injectCriticalStyles();
    
    // Загружаем полные стили асинхронно
    const styleLoader = new StyleLoader();
    styleLoader.loadAllStyles(basePath).then(() => {
        // Добавляем класс для показа полностью загруженных стилей
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        if (container) {
            container.classList.add('moodboard-styles-loaded');
        }
    });
    
    // Создаем MoodBoard с fallback эмоджи
    const moodboard = new MoodBoard(container, {
        ...options,
        noBundler: true,
        skipEmojiLoader: true, // Пропускаем автозагрузку эмоджи
        emojiBasePath: basePath ? `${basePath}src/assets/emodji/` : null
    });
    
    return moodboard;
}
