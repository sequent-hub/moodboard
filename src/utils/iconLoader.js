/**
 * Утилита для загрузки SVG иконок
 */
export class IconLoader {
    constructor() {
        this.cache = new Map();
        this.icons = {};
    }

    /**
     * Инициализирует иконки при создании экземпляра
     */
    async init() {
        // Импортируем все SVG файлы статически
        try {
            // Используем динамический импорт для всех иконок
            const iconModules = await Promise.all([
                import('../assets/icons/select.svg?raw'),
                import('../assets/icons/pan.svg?raw'),
                import('../assets/icons/text-add.svg?raw'),
                import('../assets/icons/note.svg?raw'),
                import('../assets/icons/image.svg?raw'),
                import('../assets/icons/shapes.svg?raw'),
                import('../assets/icons/pencil.svg?raw'),
                import('../assets/icons/comments.svg?raw'),
                import('../assets/icons/attachments.svg?raw'),
                import('../assets/icons/emoji.svg?raw'),
                import('../assets/icons/frame.svg?raw'),
                import('../assets/icons/clear.svg?raw'),
                import('../assets/icons/undo.svg?raw'),
                import('../assets/icons/redo.svg?raw')
            ]);

            // Сохраняем иконки в кэш
            const iconNames = [
                'select', 'pan', 'text-add', 'note', 'image', 'shapes',
                'pencil', 'comments', 'attachments', 'emoji', 'frame',
                'clear', 'undo', 'redo'
            ];

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
            console.error('❌ Ошибка статической загрузки иконок:', error);
            // В случае ошибки загружаем встроенные SVG иконки
            this.loadBuiltInIcons();
        }
    }

    /**
     * Загружает встроенные SVG иконки (резервный метод)
     */
    loadBuiltInIcons() {
        const builtInIcons = {
            'select': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <!-- Symmetrical outline cursor arrow -->
  <path d="M4 2 L4 18 L8 14 L12 22 L14 21 L10 13 L18 13 Z"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"/>
</svg>`,
            'pan': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M8 5L8 19M16 5L16 19M5 8L19 8M5 16L19 16" 
        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`,
            'text-add': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M4 6H20M4 12H20M4 18H12M16 18V22M16 18H20" 
        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`,
            'note': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect x="3" y="3" width="18" height="18" rx="2" fill="#fbbf24" stroke="currentColor" stroke-width="2"/>
  <path d="M8 8H16M8 12H16M8 16H12" stroke="currentColor" stroke-width="1.5"/>
</svg>`,
            'image': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
  <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2"/>
</svg>`,
            'shapes': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect x="3" y="3" width="7" height="7" fill="currentColor"/>
  <circle cx="17" cy="7" r="4" fill="currentColor"/>
  <polygon points="12,17 15,21 9,21" fill="currentColor"/>
</svg>`,
            'pencil': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M17 3L21 7L7 21H3V17L17 3Z" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>`,
            'comments': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" 
        fill="none" stroke="currentColor" stroke-width="2"/>
</svg>`,
            'attachments': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M21.44 11.05L12.25 20.24C11.1242 21.3658 9.59723 21.9983 8.00547 21.9983C6.41371 21.9983 4.88675 21.3658 3.76094 20.24C2.63513 19.1142 2.00269 17.5872 2.00269 15.9955C2.00269 14.4037 2.63513 12.8768 3.76094 11.751L12.951 2.56004C13.7006 1.81035 14.7169 1.38733 15.7781 1.38733C16.8394 1.38733 17.8557 1.81035 18.6053 2.56004C19.355 3.30973 19.778 4.32607 19.778 5.38733C19.778 6.44859 19.355 7.46493 18.6053 8.21462L9.41494 17.4056C9.03464 17.7859 8.52629 17.9999 7.99994 17.9999C7.47359 17.9999 6.96524 17.7859 6.58494 17.4056C6.20464 17.0253 5.99064 16.5169 5.99064 15.9906C5.99064 15.4642 6.20464 14.9559 6.58494 14.5756L15.366 5.79462" 
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
            'emoji': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="8" cy="10" r="1" fill="currentColor"/>
  <circle cx="16" cy="10" r="1" fill="currentColor"/>
  <path d="M8 16C8 16 10 18 12 18C14 18 16 16 16 16" stroke="currentColor" stroke-width="2" fill="none"/>
</svg>`,
            'frame': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>`,
            'clear': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" 
        fill="none" stroke="currentColor" stroke-width="2"/>
</svg>`,
            'undo': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M9 14L4 9L9 4M20 20V13C20 11.9391 19.5786 10.9217 18.8284 10.1716C18.0783 9.42143 17.0609 9 16 9H4" 
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
            'redo': `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M15 14L20 9L15 4M4 20V13C4 11.9391 4.42143 10.9217 5.17157 10.1716C5.92172 9.42143 6.93913 9 8 9H20" 
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
     * Загружает все иконки для тулбара
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
     * Загружает fallback иконки
     */
    loadFallbackIcons() {
        const iconNames = [
            'select', 'pan', 'text-add', 'note', 'image', 'shapes',
            'pencil', 'comments', 'attachments', 'emoji', 'frame',
            'clear', 'undo', 'redo'
        ];

        iconNames.forEach(name => {
            this.icons[name] = this.getFallbackIcon(name);
            this.cache.set(name, this.getFallbackIcon(name));
        });

        
    }

    /**
     * Возвращает fallback иконку если загрузка не удалась
     * @param {string} iconName - имя иконки
     * @returns {string} fallback SVG
     */
    getFallbackIcon(iconName) {
        // Простые fallback иконки в виде геометрических фигур
        const fallbacks = {
            'select': '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
            'pan': '<svg width="20" height="20" viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
            'text-add': '<svg width="20" height="20" viewBox="0 0 20 20"><text x="10" y="15" text-anchor="middle" font-size="16" fill="currentColor">T+</text></svg>',
            'note': '<svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="2" fill="#fbbf24"/></svg>',
            'image': '<svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
            'shapes': '<svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="2" width="6" height="6"/><circle cx="14" cy="5" r="3"/><polygon points="10,14 13,18 7,18"/></svg>',
            'pencil': '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 14L14 2L18 6L6 18L2 18V14Z" fill="currentColor"/></svg>',
            'comments': '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 4C2 2.89543 2.89543 2 4 2H16C17.1046 2 18 2.89543 18 4V12C18 13.1046 17.1046 14 16 14H8L4 18V4Z" fill="currentColor"/></svg>',
            'attachments': '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M8 2C6.89543 2 6 2.89543 6 4V12C6 14.2091 7.79086 16 10 16C12.2091 16 14 14.2091 14 12V6C14 5.44772 13.5523 5 13 5C12.4477 5 12 5.44772 12 6V12C12 13.1046 11.1046 14 10 14C8.89543 14 8 13.1046 8 12V4C8 3.44772 8.44772 3 9 3C9.55228 3 10 3.44772 10 4V12C10 12.5523 9.55228 13 9 13C8.44772 13 8 12.5523 8 12V4Z" fill="currentColor"/></svg>',
            'emoji': '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="8" r="1"/><circle cx="13" cy="8" r="1"/><path d="M7 13C7 13 8.5 15 10 15C11.5 15 13 13 13 13" stroke="currentColor" stroke-width="1" fill="none"/></svg>',
            'frame': '<svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
            'clear': '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 6H17L16 18H4L3 6Z" fill="currentColor"/></svg>',
            'undo': '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M8 4L3 9L8 14" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
            'redo': '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M12 4L17 9L12 14" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
        };

        return fallbacks[iconName] || fallbacks['select'];
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
}

// Создаем глобальный экземпляр
export const iconLoader = new IconLoader();

// Добавляем в глобальную область для отладки
if (typeof window !== 'undefined') {
    window.iconLoader = iconLoader;
}
