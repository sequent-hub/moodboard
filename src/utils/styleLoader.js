/**
 * Утилита для загрузки CSS стилей без bundler
 * Подключает все необходимые стили для MoodBoard
 */
export class StyleLoader {
    constructor() {
        this.loadedStyles = new Set();
    }

    /**
     * Загружает все стили MoodBoard
     * @param {string} basePath - базовый путь к node_modules или dist
     */
    async loadAllStyles(basePath = '') {
        const styles = [
            'src/ui/styles/workspace.css',
            'src/ui/styles/toolbar.css', 
            'src/ui/styles/topbar.css',
            'src/ui/styles/panels.css'
        ];

        for (const stylePath of styles) {
            try {
                const fullPath = basePath + stylePath;
                await this.loadStyle(fullPath);
            } catch (error) {
                console.warn(`⚠️ Ошибка загрузки стиля ${stylePath}:`, error);
                
                // Автоматический fallback для панелей
                if (stylePath.includes('panels.css')) {
                    this.injectPanelStyles();
                }
            }
        }
    }

    /**
     * Инжектирует критичные стили панелей inline
     */
    injectPanelStyles() {
        const panelCSS = `
            /* Полные стили панелей */
            .text-properties-panel, .frame-properties-panel, .note-properties-panel, .file-properties-panel {
                font-family: 'Roboto', Arial, sans-serif !important;
                font-size: 13px !important;
                white-space: nowrap;
                box-sizing: border-box;
            }
            
            .font-select { min-width: 110px; }
            .font-size-select { min-width: 56px; }
            
            .text-properties-panel .tpp-label--spaced { margin-left: 6px; }
            
            .frame-properties-panel .fpp-section { 
                display: inline-flex; 
                align-items: center; 
                gap: 6px; 
            }
        `;
        
        this.injectInlineStyles(panelCSS, 'moodboard-panel-styles');
    }

    /**
     * Загружает отдельный CSS файл
     * @param {string} href - путь к CSS файлу
     */
    async loadStyle(href) {
        // Проверяем, не загружен ли уже этот стиль
        if (this.loadedStyles.has(href)) {
            return;
        }

        return new Promise((resolve, reject) => {
            // Создаем link элемент
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = href;

            // Обработчики загрузки
            link.onload = () => {
                this.loadedStyles.add(href);
                resolve();
            };
            
            link.onerror = () => {
                reject(new Error(`Failed to load CSS: ${href}`));
            };

            // Добавляем в head
            document.head.appendChild(link);
        });
    }

    /**
     * Загружает стили синхронно (для критичных стилей)
     * @param {string} css - CSS код
     * @param {string} id - уникальный ID для style элемента
     */
    injectInlineStyles(css, id = 'moodboard-styles') {
        // Проверяем, не загружен ли уже
        if (document.getElementById(id)) {
            return;
        }

        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
    }
}
