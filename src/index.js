// Основной экспорт пакета - готовый MoodBoard с UI
export { MoodBoard } from './moodboard/MoodBoard.js';

// Дополнительные экспорты для работы без bundler
export { initMoodBoardNoBundler, quickInitMoodBoard, injectCriticalStyles, forceInjectPanelStyles } from './initNoBundler.js';
export { StyleLoader } from './utils/styleLoader.js';
export { EmojiLoaderNoBundler } from './utils/emojiLoaderNoBundler.js';

/**
 * СУПЕР-АГРЕССИВНАЯ функция для исправления панелей в проектах с конфликтами CSS
 */
export function forceFixPanelStyles() {
    console.log('💪 СУПЕР-АГРЕССИВНОЕ исправление панелей (для проектов с конфликтами)...');
    
    const superForcedCSS = `
        /* МАКСИМАЛЬНО АГРЕССИВНЫЕ стили панелей */
        .text-properties-panel,
        div.text-properties-panel,
        [class*="text-properties-panel"] {
            min-width: 320px !important;
            max-width: none !important;
            width: auto !important;
            height: 36px !important;
            padding: 12px 22px !important;
            margin: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 13px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            position: absolute !important;
            pointer-events: auto !important;
            z-index: 10001 !important;
            box-sizing: border-box !important;
            transform: none !important;
            opacity: 1 !important;
            visibility: visible !important;
        }
        
        .frame-properties-panel,
        div.frame-properties-panel,
        [class*="frame-properties-panel"] {
            min-width: 320px !important;
            max-width: none !important;
            width: auto !important;
            height: 36px !important;
            padding: 12px 32px !important;
            margin: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 13px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            position: absolute !important;
            pointer-events: auto !important;
            z-index: 10001 !important;
            box-sizing: border-box !important;
            transform: none !important;
            opacity: 1 !important;
            visibility: visible !important;
        }
        
        .note-properties-panel,
        div.note-properties-panel,
        [class*="note-properties-panel"] {
            min-width: 280px !important;
            max-width: none !important;
            width: auto !important;
            height: 40px !important;
            padding: 8px 40px !important;
            margin: 0 !important;
            background: white !important;
            background-color: white !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16) !important;
            display: inline-flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 12px !important;
            font-family: Arial, sans-serif !important;
            position: absolute !important;
            pointer-events: auto !important;
            z-index: 10000 !important;
            box-sizing: border-box !important;
            backdrop-filter: blur(4px) !important;
            transform: none !important;
            opacity: 1 !important;
            visibility: visible !important;
        }
    `;

    // Удаляем предыдущие версии
    const existingStyles = document.querySelectorAll('#moodboard-universal-panel-fix, #moodboard-super-force-panel-fix');
    existingStyles.forEach(style => style.remove());

    const style = document.createElement('style');
    style.id = 'moodboard-super-force-panel-fix';
    style.textContent = superForcedCSS;
    
    // Вставляем в самый конец head для максимального приоритета
    document.head.appendChild(style);
    
    console.log('💪 Супер-агрессивные стили применены');
    
    // Проверяем все панели
    setTimeout(() => {
        const panels = document.querySelectorAll('.text-properties-panel, .frame-properties-panel, .note-properties-panel');
        panels.forEach((panel, index) => {
            const computedStyle = getComputedStyle(panel);
            const width = parseInt(computedStyle.minWidth);
            console.log(`📏 Панель ${index + 1}: minWidth = ${width}px`);
        });
    }, 200);
}

/**
 * Универсальная функция для исправления стилей панелей
 * Работает с любой версией MoodBoard (bundled и no-bundler)
 */
export function fixPanelStyles() {
    console.log('🔧 Исправляем стили панелей MoodBoard (универсальная версия)...');
    
    const forcedPanelCSS = `
        /* УНИВЕРСАЛЬНЫЕ принудительные стили панелей */
        .text-properties-panel {
            min-width: 320px !important;
            width: auto !important;
            height: 36px !important;
            padding: 12px 22px !important;
            background-color: #ffffff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 13px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            position: absolute !important;
            pointer-events: auto !important;
            z-index: 1001 !important;
        }
        
        .frame-properties-panel {
            min-width: 320px !important;
            width: auto !important;
            height: 36px !important;
            padding: 12px 32px !important;
            background-color: #ffffff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 13px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            position: absolute !important;
            pointer-events: auto !important;
            z-index: 1001 !important;
        }
        
        .note-properties-panel {
            min-width: 280px !important;
            width: auto !important;
            height: 36px !important;
            padding: 12px 22px !important;
            background-color: #ffffff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 9999px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 13px !important;
            font-family: 'Roboto', Arial, sans-serif !important;
            position: absolute !important;
            pointer-events: auto !important;
            z-index: 1001 !important;
        }
        
        .file-properties-panel, .moodboard-file-properties-panel {
            min-width: 250px !important;
            width: auto !important;
            height: 36px !important;
            padding: 8px 12px !important;
            background-color: #ffffff !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 14px !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            position: absolute !important;
            pointer-events: auto !important;
            z-index: 1000 !important;
        }
    `;

    // Проверяем, не добавлены ли уже стили
    if (document.getElementById('moodboard-universal-panel-fix')) {
        console.log('⚠️ Универсальные стили панелей уже добавлены');
        return;
    }

    const style = document.createElement('style');
    style.id = 'moodboard-universal-panel-fix';
    style.textContent = forcedPanelCSS;
    document.head.appendChild(style);
    
    console.log('✅ Универсальные стили панелей добавлены');
    
    // Проверяем результат через 100ms
    setTimeout(() => {
        const panel = document.querySelector('.text-properties-panel, .frame-properties-panel, .note-properties-panel');
        if (panel) {
            const computedStyle = getComputedStyle(panel);
            const width = parseInt(computedStyle.minWidth);
            console.log(`📏 Проверка панели: minWidth = ${width}px`);
            
            if (width >= 250) {
                console.log('✅ Стили панелей исправлены успешно!');
            } else {
                console.log('⚠️ Панель все еще узкая, возможны конфликты CSS');
            }
        }
    }, 100);
}
