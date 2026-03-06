export function getPixiCanvas(board) {
    return board.coreMoodboard.pixi.app.view;
}

export function createCompositionCanvas(sourceCanvas) {
    const combinedCanvas = document.createElement('canvas');
    combinedCanvas.width = sourceCanvas.width;
    combinedCanvas.height = sourceCanvas.height;

    return {
        canvas: combinedCanvas,
        ctx: combinedCanvas.getContext('2d'),
    };
}

export function drawPixiCanvas(ctx, pixiCanvas) {
    ctx.drawImage(pixiCanvas, 0, 0);
}

export function wrapText(ctx, text, maxWidth) {
    const lines = [];

    if (!text || maxWidth <= 0) {
        return [text];
    }

    let currentLine = '';

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = char;
        } else {
            currentLine = testLine;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [text];
}

function isDrawableTextElement(textEl, computedStyle) {
    const text = textEl.textContent || '';

    if (computedStyle.visibility === 'hidden' || computedStyle.opacity === '0' || !text.trim()) {
        return false;
    }

    return true;
}

function drawTextElement(ctx, textEl, index) {
    try {
        const computedStyle = window.getComputedStyle(textEl);

        if (!isDrawableTextElement(textEl, computedStyle)) {
            return;
        }

        const text = textEl.textContent || '';
        const left = parseInt(textEl.style.left) || 0;
        const top = parseInt(textEl.style.top) || 0;

        const fontSize = parseInt(computedStyle.fontSize) || 18;
        const fontFamily = computedStyle.fontFamily || 'Arial, sans-serif';
        const color = computedStyle.color || '#000000';

        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const elementWidth = parseInt(textEl.style.width) || 182;
        const lines = wrapText(ctx, text, elementWidth);
        const lineHeight = fontSize * 1.3;

        lines.forEach((line, lineIndex) => {
            const yPos = top + (lineIndex * lineHeight) + 2;
            ctx.fillText(line, left, yPos);
        });
    } catch (error) {
        console.warn(`⚠️ Ошибка при рисовании текста ${index + 1}:`, error);
    }
}

export function drawHtmlTextOverlay(ctx) {
    const textElements = document.querySelectorAll('.mb-text');
    textElements.forEach((textEl, index) => {
        drawTextElement(ctx, textEl, index);
    });
}
