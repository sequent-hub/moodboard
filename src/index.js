// Основной экспорт пакета - готовый MoodBoard с UI
export { MoodBoard } from './moodboard/MoodBoard.js';

/**
 * АВТОМАТИЧЕСКАЯ настройка эмоджи при импорте пакета
 * Больше НЕ нужно вызывать fixEmojiPaths() вручную
 */
function autoSetupEmojiPaths() {
    if (typeof window !== 'undefined' && !window.MOODBOARD_BASE_PATH) {
        const detectedPackage = '@sequent-org/moodboard';
        window.MOODBOARD_BASE_PATH = `${window.location.origin}/node_modules/${detectedPackage}/`;
        console.log('🔧 Мудборд: автоматически установлен базовый путь для эмоджи:', window.MOODBOARD_BASE_PATH);
    }
}

// Автоматически выполняем настройку при импорте пакета
autoSetupEmojiPaths();

// ПРИМЕЧАНИЕ: Стили должны загружаться через bundler (Vite/Webpack)
// import '@sequent-org/moodboard/style.css' в вашем приложении

// Дополнительные экспорты (только для специальных случаев)
export { initMoodBoardNoBundler } from './initNoBundler.js';

// Основные утилиты для эмоджи (если нужны)
export { 
    getInlinePngEmojiUrl,
    getAvailableInlinePngEmojis 
} from './utils/inlinePngEmojis.js';