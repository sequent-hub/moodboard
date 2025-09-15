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
    
    // 1. Загружаем стили (с автоматическим fallback для панелей)
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
    // Проверяем, не добавлены ли уже критичные стили
    if (document.getElementById('moodboard-critical-styles')) {
        console.log('⚠️ Критичные стили уже добавлены');
        return;
    }
    
    console.log('🎨 Добавляем критичные стили MoodBoard...');
    const criticalCSS = `
        /* Критичные стили для мгновенного отображения */
        .moodboard-workspace {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #f7fbff;
        }
        
        .moodboard-workspace__toolbar {
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 3000;
            pointer-events: none;
        }
        
        .moodboard-toolbar {
            background: white;
            border-radius: 999px;
            padding: 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
            border: 1px solid #e0e0e0;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            pointer-events: auto;            
            overflow: hidden;
            cursor: default;
        }
        
        .moodboard-topbar {
            position: absolute;
            top: 12px;
            left: 16px;            
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 10px;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 9999px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            z-index: 3000;
            pointer-events: auto;
        }
        
        .moodboard-html-handles {
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 999;
        }
        
        /* КРИТИЧНЫЕ СТИЛИ ПАНЕЛЕЙ - для корректного отображения */
        .text-properties-panel {
            position: absolute;
            pointer-events: auto;
            display: flex !important;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            padding: 12px 22px;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 9999px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
            font-size: 13px;
            font-family: 'Roboto', Arial, sans-serif;
            min-width: 320px !important;
            height: 36px !important;
            z-index: 1001;
        }
        
        .frame-properties-panel {
            position: absolute;
            pointer-events: auto;
            display: inline-flex !important;
            align-items: center;
            gap: 8px;
            padding: 12px 32px;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 9999px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
            font-size: 13px;
            font-family: 'Roboto', Arial, sans-serif;
            min-width: 320px !important;
            height: 36px !important;
            z-index: 1001;
        }
        
        .note-properties-panel {
            position: absolute;
            pointer-events: auto;
            display: inline-flex !important;
            align-items: center;
            gap: 8px;
            padding: 12px 22px;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 9999px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
            font-size: 13px;
            font-family: 'Roboto', Arial, sans-serif;
            min-width: 280px !important;
            height: 36px !important;
            z-index: 1001;
        }
        
        .file-properties-panel {
            position: absolute;
            pointer-events: auto;
            display: inline-flex !important;
            align-items: center;
            gap: 8px;
            padding: 12px 22px;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 9999px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
            font-size: 13px;
            font-family: 'Roboto', Arial, sans-serif;
            min-width: 250px !important;
            height: 36px !important;
            z-index: 1001;
        }
        
        /* Базовые стили для элементов панелей */
        .tpp-label, .fpp-label, .npp-label, .file-panel-label {
            font-family: 'Roboto', Arial, sans-serif;
            font-size: 12px;
            color: #666;
            font-weight: 500;
            white-space: nowrap;
        }
        
        .font-select, .font-size-select, .fpp-select, .fpp-input {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 13px;
            background-color: #fff;
            cursor: pointer;
            min-height: 20px;
        }
        
        .current-color-button, .current-bgcolor-button, .fpp-color-button {
            width: 28px !important;
            height: 28px !important;
            border: 1px solid #ddd;
            border-radius: 50%;
            cursor: pointer;
            margin: 0;
            padding: 0;
            display: block;
            box-sizing: border-box;
        }
        
        /* Скрыть до полной загрузки стилей */
        .moodboard-toolbar__popup {
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .moodboard-styles-loaded .moodboard-toolbar__popup {
            opacity: 1;
        }
    `;

    const style = document.createElement('style');
    style.id = 'moodboard-critical-styles';
    style.textContent = criticalCSS;
    document.head.appendChild(style);
    
    console.log('✅ Критичные стили добавлены в DOM');
    
    // Проверяем, применились ли стили панелей
    setTimeout(() => {
        const testPanel = document.querySelector('.text-properties-panel');
        if (testPanel) {
            const computedStyle = getComputedStyle(testPanel);
            console.log('📋 Стили панели применены:', {
                minWidth: computedStyle.minWidth,
                height: computedStyle.height,
                display: computedStyle.display,
                padding: computedStyle.padding
            });
        } else {
            console.log('📋 Панели пока не созданы, стили ожидают применения');
        }
    }, 100);
}

/**
 * Принудительно инжектирует стили панелей с !important
 * Используйте если панели отображаются узкими
 */
export function forceInjectPanelStyles() {
    console.log('🔧 Принудительно добавляем стили панелей...');
    
    const forcedPanelCSS = `
        /* ПРИНУДИТЕЛЬНЫЕ стили панелей - с !important */
        .text-properties-panel {
            position: absolute !important;
            pointer-events: auto !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            padding: 12px 22px !important;
            background-color: #ffffff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
            font-size: 13px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            min-width: 320px !important;
            width: auto !important;
            height: 36px !important;
            z-index: 1001 !important;
        }
        
        .frame-properties-panel {
            position: absolute !important;
            pointer-events: auto !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            padding: 12px 32px !important;
            background-color: #ffffff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
            font-size: 13px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            min-width: 320px !important;
            width: auto !important;
            height: 36px !important;
            z-index: 1001 !important;
        }
        
        .note-properties-panel {
            position: absolute !important;
            pointer-events: auto !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            padding: 12px 22px !important;
            background-color: #ffffff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
            font-size: 13px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            min-width: 280px !important;
            width: auto !important;
            height: 36px !important;
            z-index: 1001 !important;
        }
        
        .file-properties-panel {
            position: absolute !important;
            pointer-events: auto !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            padding: 12px 22px !important;
            background-color: #ffffff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
            font-size: 13px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            min-width: 250px !important;
            width: auto !important;
            height: 36px !important;
            z-index: 1001 !important;
        }
        
        /* Элементы панелей */
        .tpp-label, .fpp-label, .npp-label, .file-panel-label {
            font-family: 'Roboto', Arial, sans-serif !important;
            font-size: 12px !important;
            color: #666 !important;
            font-weight: 500 !important;
            white-space: nowrap !important;
        }
        
        .font-select, .font-size-select, .fpp-select, .fpp-input {
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            padding: 4px 8px !important;
            font-size: 13px !important;
            background-color: #fff !important;
            cursor: pointer !important;
            min-height: 20px !important;
        }
        
        .font-select { min-width: 110px !important; }
        .font-size-select { min-width: 56px !important; }
        
        .current-color-button, .current-bgcolor-button, .fpp-color-button {
            width: 28px !important;
            height: 28px !important;
            border: 1px solid #ddd !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            box-sizing: border-box !important;
        }
    `;

    const style = document.createElement('style');
    style.id = 'moodboard-forced-panel-styles';
    style.textContent = forcedPanelCSS;
    document.head.appendChild(style);
    
    console.log('🔧 Принудительные стили панелей добавлены');
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
    }).catch(error => {
        console.warn('⚠️ Не удалось загрузить полные стили, используем критичные:', error);
    });
    
    // Создаем MoodBoard с fallback эмоджи
    const moodboard = new MoodBoard(container, {
        ...options,
        noBundler: true,
        skipEmojiLoader: true, // Пропускаем автозагрузку эмоджи
        emojiBasePath: basePath ? `${basePath}src/assets/emodji/` : null
    });
    
    // Автоматическая проверка и исправление стилей панелей через 3 секунды
    setTimeout(() => {
        const panel = document.querySelector('.text-properties-panel, .frame-properties-panel, .note-properties-panel, .file-properties-panel');
        if (panel) {
            const computedStyle = getComputedStyle(panel);
            const width = parseInt(computedStyle.minWidth);
            
            if (width < 200) { // Если панель очень узкая
                console.log('🔧 Обнаружена узкая панель, автоматически исправляем стили...');
                forceInjectPanelStyles();
            }
        }
    }, 3000);
    
    return moodboard;
}
