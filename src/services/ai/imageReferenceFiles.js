/**
 * Превращение картинок с доски в файлы для отправки в AI-сервис.
 *
 * Одна ответственность: загрузка содержимого по ссылке объекта. Вынесено из
 * разбора связей (imageGeneratorInputs.js): тот модуль остаётся чистым и
 * проверяется unit-тестами без сети и Blob.
 */

/**
 * @param {Array<{src: string, name?: string}>} sources
 * @returns {Promise<Array<File|Blob>>}
 */
export async function createReferenceFiles(sources) {
    if (!Array.isArray(sources) || sources.length === 0) return [];

    return Promise.all(sources.map((source) => createReferenceFile(source)));
}

/**
 * @param {{src: string, name?: string}} source
 * @returns {Promise<File|Blob>}
 */
export async function createReferenceFile({ src, name } = {}) {
    if (typeof src !== 'string' || !src) {
        throw new Error('Пустая ссылка на изображение');
    }

    const blob = src.startsWith('data:') ? dataUrlToBlob(src) : await fetchImageBlob(src);

    return createNamedBlob(blob, name || 'board-reference.png');
}

/**
 * @param {string} dataUrl
 * @returns {Blob}
 */
function dataUrlToBlob(dataUrl) {
    const [meta = '', data = ''] = dataUrl.split(',');
    const mimeType = meta.match(/^data:([^;]+)/)?.[1] || 'image/png';
    const binary = /;base64/i.test(meta) ? atob(data) : decodeURIComponent(data);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
}

/**
 * @param {string} src
 * @returns {Promise<Blob>}
 */
async function fetchImageBlob(src) {
    const response = await fetch(src);
    if (!response.ok) {
        throw new Error(`изображение недоступно (${response.status})`);
    }

    return response.blob();
}

/**
 * @param {Blob} blob
 * @param {string} name
 * @returns {File|Blob}
 */
function createNamedBlob(blob, name) {
    if (typeof File === 'function') {
        return new File([blob], name, { type: blob.type || 'image/png' });
    }

    blob.name = name;
    return blob;
}
