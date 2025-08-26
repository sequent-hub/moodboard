// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
    // Базовая конфигурация для разработки
    // Сборка библиотеки не требуется - публикуем исходный код

    // Настройки для плагинов
    plugins: [],

    // Настройки для загрузки SVG
    assetsInclude: ['**/*.svg'],

    build: {
        lib: {
            entry: 'src/index.js',
            name: 'Moodboard',
            fileName: (format) => `moodboard.${format}.js`
        },
        rollupOptions: {
            // Внешние зависимости, не включаемые в бандл
            external: [],
            output: {
                globals: {}
            }
        }
    },

    // Настройки для тестов
    test: {
        // Глобальные переменные тестов
        globals: true,

        // Окружение для тестов (DOM)
        environment: 'jsdom',

        // Файл настройки тестов
        setupFiles: ['./tests/setup.js'],

        // Папки с тестами
        include: ['tests/**/*.{test,spec}.{js,ts}'],

        // Исключения
        exclude: ['node_modules', 'dist', 'tests/setup.js'],

        // Настройка покрытия
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'tests/',
                '**/*.config.js',
                '**/*.d.ts'
            ]
        },

        // Таймауты
        testTimeout: 10000,
        hookTimeout: 10000
    }
});