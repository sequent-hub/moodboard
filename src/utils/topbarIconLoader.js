/**
 * Загрузчик SVG иконок для верхней панели
 */
export class TopbarIconLoader {
    constructor() {
        this.icons = new Map();
        this.init();
    }

    async init() {
        try {
            // Всегда используем встроенные иконки для надежности
            // Это гарантирует работу в любом окружении (npm пакет, CDN, локальная разработка)
            this.loadBuiltInIcons();
            
            console.log('✅ Иконки верхней панели загружены успешно');
            
        } catch (error) {
            console.error('❌ Критическая ошибка загрузки иконок верхней панели:', error);
            // Даже в случае ошибки пытаемся загрузить встроенные иконки
            this.loadBuiltInIcons();
        }
    }

    loadBuiltInIcons() {
        // Встроенные иконки как основной источник
        const builtInIcons = {
            'grid-line': `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2H16V4H2V2Z" fill="currentColor"/>
                <path d="M2 7H16V9H2V7Z" fill="currentColor"/>
                <path d="M2 12H16V14H2V12Z" fill="currentColor"/>
                <path d="M2 2V16H4V2H2Z" fill="currentColor"/>
                <path d="M7 2V16H9V2H7Z" fill="currentColor"/>
                <path d="M12 2V16H14V2H12Z" fill="currentColor"/>
            </svg>`,
            'grid-dot': `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="4" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="9" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="14" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="4" cy="9" r="1.5" fill="currentColor"/>
                <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
                <circle cx="14" cy="9" r="1.5" fill="currentColor"/>
                <circle cx="4" cy="14" r="1.5" fill="currentColor"/>
                <circle cx="9" cy="14" r="1.5" fill="currentColor"/>
                <circle cx="14" cy="14" r="1.5" fill="currentColor"/>
            </svg>`,
            'grid-cross': `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3L6 6M6 3L3 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M9 3L12 6M12 3L9 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M3 9L6 12M6 9L3 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M9 9L12 12M12 9L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M15 3L18 6M18 3L15 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M15 9L18 12M18 9L15 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M3 15L6 18M6 15L3 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M9 15L12 18M12 15L9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M15 15L18 18M18 15L15 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>`,
            'grid-off': `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2H16V4H2V2Z" fill="currentColor" opacity="0.3"/>
                <path d="M2 7H16V9H2V7Z" fill="currentColor" opacity="0.3"/>
                <path d="M2 12H16V14H2V12Z" fill="currentColor" opacity="0.3"/>
                <path d="M2 2V16H4V2H2Z" fill="currentColor" opacity="0.3"/>
                <path d="M7 2V16H9V2H7Z" fill="currentColor" opacity="0.3"/>
                <path d="M12 2V16H14V2H12Z" fill="currentColor" opacity="0.3"/>
                <path d="M1 17L17 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
            'paint': `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 3H10L13 6V13A2 2 0 0 1 11 15H6A2 2 0 0 1 4 13V3Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                <path d="M10 3V6H13" stroke="currentColor" stroke-width="1.5"/>
                <path d="M14 10S15.5 11.5 15.5 13A1.5 1.5 0 0 1 13 13C13 11.5 14 10 14 10Z" fill="currentColor" stroke="currentColor" stroke-width="0.5"/>
            </svg>`
        };

        // Загружаем иконки статически
        for (const [iconName, svgContent] of Object.entries(builtInIcons)) {
            this.icons.set(iconName, svgContent);
        }
        
        console.log(`📦 Загружено ${this.icons.size} встроенных иконок верхней панели`);
    }

    getIcon(name) {
        return this.icons.get(name);
    }

    /**
     * Загружает все иконки и возвращает их как объект
     */
    async loadAllIcons() {
        const result = {};
        this.icons.forEach((content, name) => {
            result[name] = content;
        });
        return result;
    }

    reloadIcon(name) {
        // Перезагружаем конкретную иконку
        this.init();
    }

    clearCache() {
        this.icons.clear();
    }
}
