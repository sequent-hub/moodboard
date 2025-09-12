/**
 * Загрузчик эмоджи для работы без bundler
 * Заменяет import.meta.glob на динамическую загрузку
 */
export class EmojiLoaderNoBundler {
    constructor() {
        this.emojiCache = new Map();
        this.basePath = '';
    }

    /**
     * Инициализация с базовым путем
     * @param {string} basePath - путь к папке с эмоджи (например: '/node_modules/moodboard-futurello/')
     */
    init(basePath = '') {
        this.basePath = basePath;
    }

    /**
     * Загружает список эмоджи из статичного индекса
     * @returns {Promise<Map>} карта категорий и эмоджи
     */
    async loadEmojis() {
        try {
            // Попытка загрузить индекс эмоджи из JSON файла
            const response = await fetch(`${this.basePath}src/assets/emodji/index.json`);
            if (response.ok) {
                const emojiIndex = await response.json();
                return this.processEmojiIndex(emojiIndex);
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить индекс эмоджи, используем fallback');
        }

        // Fallback: используем статичный список популярных эмоджи
        return this.getFallbackEmojis();
    }

    /**
     * Обрабатывает индекс эмоджи
     * @param {Object} emojiIndex - индекс эмоджи из JSON
     */
    processEmojiIndex(emojiIndex) {
        const groups = new Map();
        
        Object.entries(emojiIndex).forEach(([category, emojis]) => {
            const emojiList = emojis.map(emoji => ({
                path: `${this.basePath}src/assets/emodji/${category}/${emoji.file}`,
                url: `${this.basePath}src/assets/emodji/${category}/${emoji.file}`
            }));
            groups.set(category, emojiList);
        });

        return groups;
    }

    /**
     * Возвращает fallback список эмоджи
     */
    getFallbackEmojis() {
        const groups = new Map();

        // Статичный список популярных эмоджи
        const fallbackEmojis = {
            'Смайлики': [
                '1f600.png', '1f601.png', '1f602.png', '1f603.png', '1f604.png',
                '1f605.png', '1f606.png', '1f607.png', '1f608.png', '1f609.png',
                '1f60a.png', '1f60b.png', '1f60c.png', '1f60d.png', '1f60e.png',
                '1f60f.png', '1f610.png', '1f611.png', '1f612.png', '1f613.png',
                '1f614.png', '1f615.png', '1f616.png', '1f617.png', '1f618.png',
                '1f619.png', '1f61a.png', '1f61b.png', '1f61c.png', '1f61d.png',
                '1f61e.png', '1f61f.png', '1f620.png', '1f621.png', '1f622.png'
            ],
            'Жесты': [
                '1f44d.png', '1f44e.png', '1f44f.png', '1f450.png', '1f451.png',
                '1f590.png', '270c.png', '1f91d.png', '1f64f.png', '1f44c.png'
            ],
            'Разное': [
                '2764.png', '1f494.png', '1f49c.png', '1f49a.png', '1f495.png',
                '1f496.png', '1f497.png', '1f498.png', '1f499.png', '1f49b.png'
            ]
        };

        Object.entries(fallbackEmojis).forEach(([category, emojis]) => {
            const emojiList = emojis.map(file => ({
                path: `${this.basePath}src/assets/emodji/${category}/${file}`,
                url: `${this.basePath}src/assets/emodji/${category}/${file}`
            }));
            groups.set(category, emojiList);
        });

        return groups;
    }

    /**
     * Создает индексный JSON файл из существующих эмоджи
     * Эта функция должна быть вызвана в dev режиме для генерации индекса
     */
    async generateEmojiIndex() {
        // Эта функция может быть вызвана только в dev среде с bundler
        if (typeof import.meta !== 'undefined' && import.meta.glob) {
            const modules = import.meta.glob('../assets/emodji/**/*.{png,PNG}', { eager: true, as: 'url' });
            const index = {};
            
            Object.keys(modules).forEach(path => {
                const match = path.match(/\/emodji\/([^\/]+)\/([^\/]+)$/);
                if (match) {
                    const [, category, file] = match;
                    if (!index[category]) index[category] = [];
                    index[category].push({ file });
                }
            });

            console.log('📁 Индекс эмоджи:', JSON.stringify(index, null, 2));
            return index;
        }
        
        return null;
    }
}
