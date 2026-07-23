/**
 * Форматирование текста ошибки для moodboard-chat__error-block:
 * русский текст пользователю, системный префикс AiClient.* (код) — в скобках в конце.
 */

/** @type {Record<number, string>} */
export const HTTP_STATUS_RU = {
    400: 'Некорректный запрос',
    401: 'Требуется авторизация',
    403: 'Доступ запрещён',
    404: 'Ресурс не найден',
    408: 'Превышено время ожидания запроса',
    409: 'Конфликт запроса',
    413: 'Слишком большой запрос',
    422: 'Ошибка валидации данных',
    429: 'Слишком много запросов',
    500: 'Внутренняя ошибка сервера',
    501: 'Операция не поддерживается',
    502: 'Сбой шлюза',
    503: 'Сервис временно недоступен',
    504: 'Превышено время ожидания шлюза'
};

/** Англоязычные фразы statusText / Express — ключ в нижнем регистре */
/** @type {Record<string, string>} */
const HTTP_STATUS_PHRASE_RU = {
    'bad request': HTTP_STATUS_RU[400],
    'unauthorized': HTTP_STATUS_RU[401],
    'forbidden': HTTP_STATUS_RU[403],
    'not found': HTTP_STATUS_RU[404],
    'request timeout': HTTP_STATUS_RU[408],
    'conflict': HTTP_STATUS_RU[409],
    'payload too large': HTTP_STATUS_RU[413],
    'unprocessable entity': HTTP_STATUS_RU[422],
    'too many requests': HTTP_STATUS_RU[429],
    'internal server error': HTTP_STATUS_RU[500],
    'not implemented': HTTP_STATUS_RU[501],
    'bad gateway': HTTP_STATUS_RU[502],
    'service unavailable': HTTP_STATUS_RU[503],
    'gateway timeout': HTTP_STATUS_RU[504]
};

/** @type {Record<string, string>} */
const EXACT_MESSAGES_RU = {
    'DeepSeek provider is not configured':
        'Провайдер DeepSeek не настроен',
    'OpenAI image provider is not configured':
        'Провайдер OpenAI Images не настроен',
    'OpenAI image response does not contain image data':
        'В ответе OpenAI Images нет данных изображения',
    'OpenAI image API returned non-JSON response':
        'OpenAI Images вернул ответ не в формате JSON',
    'OpenAI image operation timed out':
        'Превышено время ожидания генерации OpenAI Images',
    'Provider "openai-image" is not configured':
        'Провайдер «openai-image» не настроен',
    'AI stream error':
        'Ошибка потока ответа ИИ',
    'AiClient.chatStream: empty response body':
        'Пустое тело ответа при потоковой генерации',
    'Ошибка запроса':
        'Ошибка запроса',
    'Internal server error':
        HTTP_STATUS_RU[500],
    'Internal Server Error':
        HTTP_STATUS_RU[500],
    'stream error':
        'Ошибка потока ответа'
};

/** @type {Array<{ pattern: RegExp, format: (match: RegExpMatchArray) => string }>} */
const PREFIX_MESSAGES_RU = [
    {
        pattern: /^OpenAI image API unreachable: (.+)$/,
        format: ([, detail]) => `API OpenAI Images недоступен: ${detail}`
    },
    {
        pattern: /^OpenAI image API error \((\d+)\)$/,
        format: ([, status]) => `Ошибка API OpenAI Images (${status})`
    },
    {
        pattern: /^Unknown provider: (.+)$/,
        format: ([, id]) => `Неизвестный провайдер: ${id}`
    },
    {
        pattern: /^Provider "(.+)" is not configured$/,
        format: ([, id]) => `Провайдер «${id}» не настроен`
    },
    {
        pattern: /^Cannot load image reference \((\d+)\)$/,
        format: ([, status]) => `Не удалось загрузить опорное изображение (${status})`
    },
    {
        pattern: /^(\d{3}):\s*(.+)$/,
        format: ([, status, detail]) => {
            const ru = translateByHttpStatus(Number(status)) || detail;
            return `${ru} (${status})`;
        }
    }
];

const AI_CLIENT_WITH_STATUS_RE = /^([A-Za-z][\w.]*)\s*\((\d+)\):\s*(.+)$/s;
const AI_CLIENT_PLAIN_RE = /^([A-Za-z][\w.]*):\s*(.+)$/s;

/**
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function formatChatErrorForDisplay(raw) {
    if (raw == null) return '';
    const trimmed = String(raw).trim();
    if (!trimmed) return '';

    if (trimmed === 'Отменено') {
        return trimmed;
    }

    const withStatus = trimmed.match(AI_CLIENT_WITH_STATUS_RE);
    if (withStatus) {
        const [, system, status, message] = withStatus;
        const ru = translateErrorMessage(message.trim(), Number(status));
        return `${ru} (${system} (${status}))`;
    }

    const plain = trimmed.match(AI_CLIENT_PLAIN_RE);
    if (plain) {
        const [, system, message] = plain;
        const statusOnly = /^\d{3}$/.test(message.trim()) ? Number(message.trim()) : undefined;
        const ru = translateErrorMessage(message.trim(), statusOnly);
        return `${ru} (${system})`;
    }

    return translateErrorMessage(trimmed);
}

/**
 * @param {string} message
 * @param {number} [httpStatus]
 * @returns {string}
 */
export function translateErrorMessage(message, httpStatus) {
    if (!message && Number.isFinite(httpStatus)) {
        return translateByHttpStatus(httpStatus) || message;
    }

    if (!message) return message;

    if (EXACT_MESSAGES_RU[message]) {
        return EXACT_MESSAGES_RU[message];
    }

    const phraseRu = HTTP_STATUS_PHRASE_RU[message.trim().toLowerCase()];
    if (phraseRu) {
        return phraseRu;
    }

    if (/^\d{3}$/.test(message.trim())) {
        const byCode = translateByHttpStatus(Number(message.trim()));
        if (byCode) return byCode;
    }

    for (const { pattern, format } of PREFIX_MESSAGES_RU) {
        const match = message.match(pattern);
        if (match) {
            return format(match);
        }
    }

    if (Number.isFinite(httpStatus)) {
        const byStatus = translateByHttpStatus(httpStatus);
        if (byStatus && isGenericHttpStatusMessage(message, httpStatus)) {
            return byStatus;
        }
    }

    return message;
}

/**
 * @param {number} status
 * @returns {string|undefined}
 */
export function translateByHttpStatus(status) {
    return HTTP_STATUS_RU[status];
}

/**
 * @param {string} message
 * @param {number} [httpStatus]
 * @returns {boolean}
 */
function isGenericHttpStatusMessage(message, httpStatus) {
    const normalized = message.trim().toLowerCase();
    if (HTTP_STATUS_PHRASE_RU[normalized]) {
        return true;
    }

    if (/^\d{3}$/.test(normalized) && Number(normalized) === httpStatus) {
        return true;
    }

    if (Number.isFinite(httpStatus) && normalized === String(httpStatus)) {
        return true;
    }

    return false;
}
