/**
 * Загрузчик SVG иконок для верхней панели
 * Работает точно так же как IconLoader для левой панели
 */
export class TopbarIconLoader {
    constructor() {
        this.cache = new Map();
        this.icons = {};
    }

    /**
     * Инициализирует иконки при создании экземпляра
     */
    async init() {
        // Импортируем все SVG файлы статически, как в IconLoader
        try {
            // Используем динамический импорт для всех иконок topbar
            const iconModules = await Promise.all([
                import('../assets/icons/grid-line.svg?raw'),
                import('../assets/icons/grid-dot.svg?raw'),
                import('../assets/icons/grid-cross.svg?raw'),
                import('../assets/icons/grid-off.svg?raw'),
                import('../assets/icons/paint.svg?raw')
            ]);

            // Сохраняем иконки в кэш
            const iconNames = ['grid-line', 'grid-dot', 'grid-cross', 'grid-off', 'paint'];

            iconNames.forEach((name, index) => {
                if (iconModules[index] && iconModules[index].default) {
                    this.icons[name] = iconModules[index].default;
                    this.cache.set(name, iconModules[index].default);
                } else {
                    console.warn(`⚠️ Иконка ${name} не загружена, используем fallback`);
                    this.icons[name] = this.getFallbackIcon(name);
                }
            });

        } catch (error) {
            console.error('❌ Ошибка статической загрузки иконок topbar:', error);
            // В случае ошибки загружаем встроенные SVG иконки
            this.loadBuiltInIcons();
        }
    }

    /**
     * Загружает встроенные SVG иконки (резервный метод)
     */
    loadBuiltInIcons() {
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

        Object.keys(builtInIcons).forEach(name => {
            this.icons[name] = builtInIcons[name];
            this.cache.set(name, builtInIcons[name]);
        });

        
    }

    /**
     * Загружает SVG иконку по имени
     * @param {string} iconName - имя иконки без расширения
     * @returns {Promise<string>} SVG содержимое
     */
    async loadIcon(iconName) {
        if (this.cache.has(iconName)) {
            return this.cache.get(iconName);
        }

        // Если иконка уже загружена статически
        if (this.icons[iconName]) {
            return this.icons[iconName];
        }

        // Возвращаем fallback
        console.warn(`⚠️ Иконка ${iconName} не найдена, используем fallback`);
        return this.getFallbackIcon(iconName);
    }

    /**
     * Загружает все иконки для topbar
     * @returns {Promise<Object>} объект с иконками
     */
    async loadAllIcons() {
        // Если иконки еще не инициализированы
        if (Object.keys(this.icons).length === 0) {
            await this.init();
        }

        return this.icons;
    }

    /**
     * Возвращает fallback иконку если загрузка не удалась
     * @param {string} iconName - имя иконки
     * @returns {string} fallback SVG
     */
    getFallbackIcon(iconName) {
        // Простые fallback иконки в виде геометрических фигур
        const fallbacks = {
            'grid-line': '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M2 2H16V4H2V2Z" fill="currentColor"/><path d="M2 7H16V9H2V7Z" fill="currentColor"/><path d="M2 12H16V14H2V12Z" fill="currentColor"/><path d="M2 2V16H4V2H2Z" fill="currentColor"/><path d="M7 2V16H9V2H7Z" fill="currentColor"/><path d="M12 2V16H14V2H12Z" fill="currentColor"/></svg>',
            'grid-dot': '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="4" cy="4" r="1.5" fill="currentColor"/><circle cx="9" cy="4" r="1.5" fill="currentColor"/><circle cx="14" cy="4" r="1.5" fill="currentColor"/><circle cx="4" cy="9" r="1.5" fill="currentColor"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="14" cy="9" r="1.5" fill="currentColor"/><circle cx="4" cy="14" r="1.5" fill="currentColor"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="14" cy="14" r="1.5" fill="currentColor"/></svg>',
            'grid-cross': '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 3L6 6M6 3L3 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 3L12 6M12 3L9 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3 9L6 12M6 9L3 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 9L12 12M12 9L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
            'grid-off': '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M2 2H16V4H2V2Z" fill="currentColor" opacity="0.3"/><path d="M2 7H16V9H2V7Z" fill="currentColor" opacity="0.3"/><path d="M2 12H16V14H2V12Z" fill="currentColor" opacity="0.3"/><path d="M2 2V16H4V2H2Z" fill="currentColor" opacity="0.3"/><path d="M7 2V16H9V2H7Z" fill="currentColor" opacity="0.3"/><path d="M12 2V16H14V2H12Z" fill="currentColor" opacity="0.3"/><path d="M1 17L17 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
            'paint': '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 3H10L13 6V13A2 2 0 0 1 11 15H6A2 2 0 0 1 4 13V3Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M10 3V6H13" stroke="currentColor" stroke-width="1.5"/><path d="M14 10S15.5 11.5 15.5 13A1.5 1.5 0 0 1 13 13C13 11.5 14 10 14 10Z" fill="currentColor" stroke="currentColor" stroke-width="0.5"/></svg>'
        };

        return fallbacks[iconName] || fallbacks['grid-line'];
    }

    /**
     * Очищает кэш иконок
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Принудительно перезагружает иконку (игнорируя кэш)
     * @param {string} iconName - имя иконки без расширения
     * @returns {Promise<string>} SVG содержимое
     */
    async reloadIcon(iconName) {
        // Удаляем из кэша
        
        this.cache.delete(iconName);
        
        try {
            // Пробуем переимпортировать иконку
            const iconModule = await import(`../assets/icons/${iconName}.svg?raw`);
            if (iconModule && iconModule.default) {
                const svgContent = iconModule.default;
                this.icons[iconName] = svgContent;
                this.cache.set(iconName, svgContent);
                return svgContent;
            } else {
                throw new Error(`Failed to reload icon: ${iconName}`);
            }
        } catch (error) {
            console.error(`❌ Ошибка перезагрузки иконки ${iconName}:`, error);
            return this.getFallbackIcon(iconName);
        }
    }

    /**
     * Получает иконку по имени (синхронный метод для совместимости)
     */
    getIcon(name) {
        return this.icons[name] || this.getFallbackIcon(name);
    }
}

// Создаем глобальный экземпляр
export const topbarIconLoader = new TopbarIconLoader();

// Добавляем в глобальную область для отладки
if (typeof window !== 'undefined') {
    window.topbarIconLoader = topbarIconLoader;
}
