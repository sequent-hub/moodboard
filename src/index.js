// Основной экспорт пакета - готовый MoodBoard с UI
export { MoodBoard } from './moodboard/MoodBoard.js';

// Дополнительные экспорты для работы без bundler
export { initMoodBoardNoBundler, quickInitMoodBoard, injectCriticalStyles } from './initNoBundler.js';
export { StyleLoader } from './utils/styleLoader.js';
export { EmojiLoaderNoBundler } from './utils/emojiLoaderNoBundler.js';
