// Основной экспорт пакета - готовый MoodBoard с UI
export { MoodBoard } from './moodboard/MoodBoard.js';

/**
 * БЫСТРОЕ ИСПРАВЛЕНИЕ эмоджи для Vite/bundled версий
 * Устанавливает правильный базовый путь к ассетам пакета
 */
export function fixEmojiPaths(packageName = null) {
    if (packageName) {
        // Если указано имя пакета - используем его
        window.MOODBOARD_BASE_PATH = `${window.location.origin}/node_modules/${packageName}/`;
        console.log('🔧 Установлен базовый путь для эмоджи:', window.MOODBOARD_BASE_PATH);
    } else {
        // Автоопределение - используем стандартное имя пакета
        const detectedPackage = '@sequent-org/moodboard';
        window.MOODBOARD_BASE_PATH = `${window.location.origin}/node_modules/${detectedPackage}/`;
        console.log('🔧 Автоопределен базовый путь для эмоджи:', window.MOODBOARD_BASE_PATH);
    }
    
    return window.MOODBOARD_BASE_PATH;
}

/**
 * Диагностика конфликтов CSS для панелей
 * Находит что именно переопределяет ширину панелей
 */
export function diagnosePanelConflicts() {
    console.log('🔍 ДИАГНОСТИКА: поиск конфликтов стилей панелей...');
    
    const panel = document.querySelector('.text-properties-panel, .frame-properties-panel');
    if (!panel) {
        console.log('❌ Панели не найдены. Создайте объект и выберите его.');
        return;
    }
    
    console.log('📋 Найдена панель:', panel.className);
    
    // Получаем все применяемые стили
    const computedStyle = getComputedStyle(panel);
    console.log('📏 Текущие размеры панели:');
    console.log('  - width:', computedStyle.width);
    console.log('  - min-width:', computedStyle.minWidth);
    console.log('  - max-width:', computedStyle.maxWidth);
    console.log('  - height:', computedStyle.height);
    console.log('  - padding:', computedStyle.padding);
    console.log('  - display:', computedStyle.display);
    console.log('  - position:', computedStyle.position);
    
    // Проверяем inline стили
    if (panel.style.cssText) {
        console.log('⚠️ НАЙДЕНЫ inline стили на панели:', panel.style.cssText);
    } else {
        console.log('✅ Inline стилей нет');
    }
    
    // Ищем все CSS правила, которые могут влиять на панель
    console.log('🔍 Поиск CSS правил, влияющих на панель...');
    
    // Проверяем основные подозрительные свойства
    const suspiciousProperties = ['width', 'min-width', 'max-width', 'height', 'padding', 'display'];
    
    suspiciousProperties.forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        console.log(`📌 ${prop}: ${value}`);
        
        // Проверяем приоритет
        const priority = computedStyle.getPropertyPriority(prop);
        if (priority) {
            console.log(`   ⚡ Приоритет: ${priority}`);
        }
    });
    
    // Проверяем классы родительских элементов
    let parent = panel.parentElement;
    let level = 1;
    console.log('🔗 Родительские элементы:');
    while (parent && level <= 5) {
        const parentStyles = getComputedStyle(parent);
        console.log(`  ${level}. ${parent.tagName}${parent.className ? '.' + parent.className : ''}`);
        console.log(`     width: ${parentStyles.width}, display: ${parentStyles.display}`);
        parent = parent.parentElement;
        level++;
    }
    
    // Ищем потенциальные конфликтующие CSS классы
    console.log('⚠️ Поиск потенциальных конфликтов:');
    
    const possibleConflicts = [
        'bootstrap', 'tailwind', 'flex', 'grid', 'container', 'row', 'col',
        'w-', 'width', 'min-w', 'max-w', 'panel', 'modal', 'popup'
    ];
    
    const allClasses = panel.className.split(' ');
    const parentClasses = panel.parentElement?.className?.split(' ') || [];
    
    [...allClasses, ...parentClasses].forEach(cls => {
        possibleConflicts.forEach(conflict => {
            if (cls.includes(conflict)) {
                console.log(`🚨 Подозрительный класс: "${cls}" (содержит "${conflict}")`);
            }
        });
    });
    
    return {
        element: panel,
        computedStyle: computedStyle,
        currentWidth: computedStyle.width,
        currentMinWidth: computedStyle.minWidth,
        hasInlineStyles: !!panel.style.cssText
    };
}

/**
 * Хирургическое исправление конкретных свойств панелей
 * Исправляет только width и min-width, не трогая остальное
 */
export function surgicalPanelFix() {
    console.log('🔧 ХИРУРГИЧЕСКОЕ исправление размеров панелей...');
    
    const targetPanels = document.querySelectorAll(`
        .text-properties-panel, 
        .frame-properties-panel, 
        .note-properties-panel,
        .file-properties-panel,
        .moodboard-file-properties-panel
    `);
    
    if (targetPanels.length === 0) {
        console.log('❌ Панели не найдены');
        return;
    }
    
    targetPanels.forEach((panel, index) => {
        console.log(`🔧 Исправляем панель ${index + 1}: ${panel.className}`);
        
        // Запоминаем текущие значения для диагностики
        const beforeWidth = getComputedStyle(panel).width;
        const beforeMinWidth = getComputedStyle(panel).minWidth;
        
        // Применяем ТОЛЬКО минимально необходимые исправления
        if (panel.classList.contains('text-properties-panel') || 
            panel.classList.contains('frame-properties-panel')) {
            panel.style.setProperty('min-width', '320px', 'important');
            panel.style.setProperty('width', 'auto', 'important');
        } else if (panel.classList.contains('note-properties-panel')) {
            panel.style.setProperty('min-width', '280px', 'important');
            panel.style.setProperty('width', 'auto', 'important');
        } else if (panel.classList.contains('file-properties-panel') || 
                   panel.classList.contains('moodboard-file-properties-panel')) {
            panel.style.setProperty('min-width', '250px', 'important');
            panel.style.setProperty('width', 'auto', 'important');
        }
        
        // Проверяем результат
        setTimeout(() => {
            const afterWidth = getComputedStyle(panel).width;
            const afterMinWidth = getComputedStyle(panel).minWidth;
            
            console.log(`📏 Панель ${index + 1} результат:`);
            console.log(`   До:  width: ${beforeWidth}, min-width: ${beforeMinWidth}`);
            console.log(`   После: width: ${afterWidth}, min-width: ${afterMinWidth}`);
            
            if (parseInt(afterMinWidth) >= 250) {
                console.log(`✅ Панель ${index + 1} исправлена успешно!`);
            } else {
                console.log(`❌ Панель ${index + 1} все еще имеет проблемы`);
            }
        }, 50);
    });
}

// Дополнительные экспорты для работы без bundler
export { initMoodBoardNoBundler, quickInitMoodBoard, injectCriticalStyles, forceInjectPanelStyles } from './initNoBundler.js';
export { StyleLoader } from './utils/styleLoader.js';
export { EmojiLoaderNoBundler } from './utils/emojiLoaderNoBundler.js';

// Экспорт встроенных эмоджи (PNG data URL)
export { 
    getInlinePngEmojiUrl,
    getAvailableInlinePngEmojis,
    hasInlinePngEmoji
} from './utils/inlinePngEmojis.js';

// Экспорт встроенных SVG эмоджи (для пользователей, которые хотят добавить свои)
export { 
    addInlineSvgEmoji, 
    bulkAddInlineSvgEmojis, 
    getAvailableInlineEmojis,
    isInlineSvgEmoji,
    getInlineEmojiByCode
} from './utils/inlineSvgEmojis.js';

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
