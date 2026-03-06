import {
    createCompositionCanvas,
    drawHtmlTextOverlay,
    drawPixiCanvas,
    getPixiCanvas,
    wrapText,
} from './MoodBoardScreenshotCanvas.js';

export { wrapText };

export function createCombinedScreenshot(board, format = 'image/jpeg', quality = 0.6) {
    if (!board.coreMoodboard || !board.coreMoodboard.pixi || !board.coreMoodboard.pixi.app || !board.coreMoodboard.pixi.app.view) {
        throw new Error('Canvas не найден');
    }

    try {
        const pixiCanvas = getPixiCanvas(board);
        const { canvas, ctx } = createCompositionCanvas(pixiCanvas);

        drawPixiCanvas(ctx, pixiCanvas);
        drawHtmlTextOverlay(ctx);

        return canvas.toDataURL(format, quality);
    } catch (error) {
        console.warn('⚠️ Ошибка при создании объединенного скриншота, используем только PIXI canvas:', error);
        const canvas = getPixiCanvas(board);
        return canvas.toDataURL(format, quality);
    }
}

export function exportScreenshot(board, format = 'image/jpeg', quality = 0.6) {
    return board.createCombinedScreenshot(format, quality);
}
