/**
 * server/index.mjs — локальный dev-прокси для MoodBoard.
 *
 * Запустить: node server/index.mjs
 * Слушает :3001 (vite.config.js проксирует /api → localhost:3001).
 *
 * Маршруты:
 *
 *   Мок доски (поведение идентично dev-server.mjs):
 *     GET  /api/v2/moodboard/:boardId
 *     POST /api/v2/moodboard/history/save
 *     POST /api/v2/moodboard/metadata/save
 *     POST /api/v2/images/upload
 *     POST /api/v2/files/upload
 *
 *   Hunyuan 3D (реальный прокси к Tencent Cloud):
 *     POST /api/v2/ai/hunyuan-3d/model3d
 *     GET  /api/v2/ai/hunyuan-3d/model3d/:jobId?format=glb|obj|fbx|stl
 *     POST /api/v2/ai/hunyuan-3d/convert3d
 *     GET  /api/v2/ai/hunyuan-3d/convert3d/:jobId?format=fbx|stl
 *     GET  /api/v2/ai/hunyuan-3d/file/:jobId.:ext  (dev-раздача моделей)
 *
 *   Мок прочих AI (заглушка, не менять):
 *     * /api/v2/ai/*
 *
 * Env-переменные:
 *   HUNYUAN_SECRET_ID      — Tencent Cloud SecretId      (обязательно)
 *   HUNYUAN_SECRET_KEY     — Tencent Cloud SecretKey     (обязательно)
 *   HUNYUAN_REGION         — регион генерации, по умолчанию ap-guangzhou
 *   HUNYUAN_CONVERT_REGION — регион конвертации, по умолчанию ap-singapore
 *   BOARD_UPLOAD_ENDPOINT  — URL хранилища доски для загрузки моделей;
 *                            если не задан — файлы хранятся в .dev-data/3d-models/
 *                            и отдаются через /api/v2/ai/hunyuan-3d/file/:jobId.:ext
 */

import http  from 'http';
import https from 'https';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { submitJob, queryJob, submitConvertJob, queryConvertJob, downloadBuffer } from './hunyuan3d.mjs';

const PORT      = 3001;
/** Laravel Play — реальный upload images/files для dev Front (vite → :3001 → :8765). */
const PLAY_BASE = process.env.PLAY_API_BASE || 'http://127.0.0.1:8765';
const __dir     = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR  = join(__dir, '..');
const DATA_DIR  = join(ROOT_DIR, '.dev-data');
const MODELS_DIR = join(DATA_DIR, '3d-models');

for (const d of [DATA_DIR, MODELS_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

// ── Board mock state ─────────────────────────────────────────────────────────

const boards = {};

function dataFile(boardId) {
    return join(DATA_DIR, `${boardId.replace(/[^a-z0-9_-]/gi, '_')}.json`);
}

function loadBoard(boardId) {
    if (boards[boardId]) return boards[boardId];
    const f = dataFile(boardId);
    if (existsSync(f)) {
        try { boards[boardId] = JSON.parse(readFileSync(f, 'utf8')); }
        catch {
            boards[boardId] = { state: { objects: [] }, name: null, description: null, settings: {} };
        }
    } else {
        boards[boardId] = { state: { objects: [] }, name: null, description: null, settings: {} };
    }
    return boards[boardId];
}

function saveBoard(boardId) {
    try { writeFileSync(dataFile(boardId), JSON.stringify(boards[boardId], null, 2)); }
    catch { /* non-critical */ }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

function json(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-TOKEN, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Length':              Buffer.byteLength(body)
    });
    res.end(body);
}

/** Проксирует multipart POST на Play без разбора тела (сохраняет boundary). */
function proxyPostToPlay(req, res, playPath) {
    const target = new URL(playPath, PLAY_BASE);
    const mod    = target.protocol === 'https:' ? https : http;
    const headers = { ...req.headers, host: target.host };

    const proxyReq = mod.request(
        {
            hostname: target.hostname,
            port:     target.port || (target.protocol === 'https:' ? 443 : 80),
            path:     target.pathname + (target.search || ''),
            method:   'POST',
            headers,
        },
        (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 502, {
                ...proxyRes.headers,
                'Access-Control-Allow-Origin':  '*',
                'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-TOKEN, X-Requested-With',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            });
            proxyRes.pipe(res);
        }
    );

    proxyReq.on('error', (err) => {
        console.error(`[proxy] Play upload error (${playPath}):`, err.message);
        json(res, 502, {
            success: false,
            message: `Play backend недоступен (${PLAY_BASE}). Запустите: cd D:\\MoodBoard_Play && php artisan serve --port=8765`,
        });
    });

    req.pipe(proxyReq);
}

// ── Model storage ─────────────────────────────────────────────────────────────

const CONTENT_TYPES = {
    glb: 'model/gltf-binary',
    obj: 'text/plain',
    fbx: 'application/octet-stream',
    stl: 'model/stl'
};

/**
 * Сохраняет буфер 3D-модели в хранилище и возвращает URL.
 *
 * - Если задан BOARD_UPLOAD_ENDPOINT — отправляет multipart/form-data POST туда
 *   и возвращает URL из ответа (ожидаемый формат: { data: { url } } или { url }).
 * - Иначе — сохраняет в .dev-data/3d-models/ и возвращает локальный путь.
 *
 * Имя файла: hunyuan-{jobId}.{ext} — уникально по паре (jobId, ext).
 *
 * @param {string} jobId
 * @param {Buffer} buffer
 * @param {string} ext   — 'glb'|'obj'|'fbx'|'stl'
 * @returns {Promise<string>} modelUrl
 */
async function storeModel(jobId, buffer, ext) {
    const uploadEndpoint = process.env.BOARD_UPLOAD_ENDPOINT;
    const contentType    = CONTENT_TYPES[ext] || 'application/octet-stream';

    if (uploadEndpoint) {
        const boundary = `----MoodBoard3DBoundary${Date.now()}`;
        const filename  = `hunyuan-${jobId}.${ext}`;
        const preamble  = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
            `Content-Type: ${contentType}\r\n\r\n`
        );
        const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body     = Buffer.concat([preamble, buffer, epilogue]);

        const urlObj = new URL(uploadEndpoint);
        const mod    = urlObj.protocol === 'https:' ? https : http;

        return new Promise((resolve, reject) => {
            const req = mod.request(
                {
                    hostname: urlObj.hostname,
                    port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                    path:     urlObj.pathname + (urlObj.search || ''),
                    method:   'POST',
                    headers:  {
                        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': body.length
                    }
                },
                (res) => {
                    let raw = '';
                    res.on('data', c => { raw += c; });
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(raw);
                            const url    = parsed?.data?.url || parsed?.url || null;
                            if (!url) reject(new Error(`Upload endpoint не вернул URL: ${raw.slice(0, 120)}`));
                            else      resolve(url);
                        } catch {
                            reject(new Error(`Upload endpoint вернул невалидный JSON: ${raw.slice(0, 120)}`));
                        }
                    });
                }
            );
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    // Dev: локальное хранение + раздача через /api/v2/ai/hunyuan-3d/file/
    const filePath = join(MODELS_DIR, `${jobId}.${ext}`);
    writeFileSync(filePath, buffer);
    return `/api/v2/ai/hunyuan-3d/file/${jobId}.${ext}`;
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    const url    = req.url.split('?')[0];
    const method = req.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-TOKEN, X-Requested-With',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });
        return res.end();
    }

    console.log(`[proxy] ${method} ${url}`);

    // ── GET /api/v2/moodboard/:boardId ────────────────────────────────────────
    const loadMatch = url.match(/^\/api\/v2\/moodboard\/([^/]+)$/);
    if (method === 'GET' && loadMatch) {
        const boardId = decodeURIComponent(loadMatch[1]);
        const board   = loadBoard(boardId);
        return json(res, 200, {
            success: true,
            data: {
                moodboardId: boardId,
                name:        board.name        || null,
                description: board.description || null,
                settings:    board.settings    || {},
                state:       board.state       || { objects: [] },
                version:     1
            }
        });
    }

    // ── POST /api/v2/moodboard/history/save ───────────────────────────────────
    if (method === 'POST' && url === '/api/v2/moodboard/history/save') {
        const body = await parseBody(req);
        const { moodboardId, state } = body;
        if (!moodboardId) return json(res, 400, { success: false, message: 'moodboardId required' });
        const board = loadBoard(moodboardId);
        board.state = state || { objects: [] };
        saveBoard(moodboardId);
        return json(res, 200, {
            success: true, moodboardId, historyVersion: Date.now(), deduplicated: false
        });
    }

    // ── POST /api/v2/moodboard/metadata/save ──────────────────────────────────
    if (method === 'POST' && url === '/api/v2/moodboard/metadata/save') {
        const body = await parseBody(req);
        const { moodboardId, name, description, settings } = body;
        if (!moodboardId) return json(res, 400, { success: false, message: 'moodboardId required' });
        const board = loadBoard(moodboardId);
        if (name        !== undefined) board.name        = name;
        if (description !== undefined) board.description = description;
        if (settings    !== undefined) board.settings    = settings;
        saveBoard(moodboardId);
        return json(res, 200, { success: true, moodboardId });
    }

    // ── POST /api/v2/images/upload → Play (реальные файлы в public/uploads/images/) ──
    if (method === 'POST' && url === '/api/v2/images/upload') {
        return proxyPostToPlay(req, res, '/api/v2/images/upload');
    }

    // ── POST /api/v2/files/upload → Play ──────────────────────────────────────
    if (method === 'POST' && url === '/api/v2/files/upload') {
        return proxyPostToPlay(req, res, '/api/v2/files/upload');
    }

    // ── POST /api/v2/ai/hunyuan-3d/model3d ────────────────────────────────────
    //   Принимает: { mode, model?, prompt?, image?, multiViewImages?, generateType?,
    //                faceCount?, pbr?, downloadFormat }
    //   Возвращает: { jobId }
    if (method === 'POST' && url === '/api/v2/ai/hunyuan-3d/model3d') {
        try {
            const body = await parseBody(req);
            const { mode, model, prompt, image, multiViewImages,
                    generateType, faceCount, pbr } = body;
            if (!mode) {
                return json(res, 400, { success: false, error: 'mode обязателен (text|image|multi)' });
            }
            if (prompt && image?.data) {
                return json(res, 400, { success: false, error: 'prompt и image взаимоисключающи' });
            }
            const result = await submitJob({
                mode, model, prompt, image, multiViewImages, generateType, faceCount, pbr
            });
            return json(res, 200, result); // { jobId }
        } catch (err) {
            console.error('[hunyuan-3d] submit error:', err.message);
            return json(res, 502, { success: false, error: err.message });
        }
    }

    // ── GET /api/v2/ai/hunyuan-3d/model3d/:jobId?format=glb|obj|fbx|stl ────────
    //   running -> { status:'pending'|'running', progress, stage }
    //   done, glb|obj -> { status:'done', previewBase64, mimeType, modelUrl, format }
    //   done, fbx|stl -> { status:'done', needsConvert:true, sourceGlbUrl, previewBase64, mimeType }
    //   fail  -> { status:'error', error }
    const pollMatch = url.match(/^\/api\/v2\/ai\/hunyuan-3d\/model3d\/([^/]+)$/);
    if (method === 'GET' && pollMatch) {
        const jobId  = pollMatch[1];
        const qs     = new URLSearchParams(req.url.split('?')[1] || '');
        const format = (qs.get('format') || 'glb').toLowerCase();
        try {
            const { status, errorCode, errorMessage, files } = await queryJob(jobId);

            if (status === 'WAIT') {
                return json(res, 200, { status: 'pending', progress: 10, stage: null });
            }
            if (status === 'RUN') {
                return json(res, 200, { status: 'running', progress: 50, stage: 'geometry' });
            }
            if (status === 'FAIL') {
                const msg = [errorCode, errorMessage].filter(Boolean).join(': ') || 'Ошибка генерации';
                return json(res, 200, { status: 'error', error: msg });
            }
            if (status === 'DONE') {
                // Найти файл нужного типа; Tencent возвращает GLB + OBJ + превью/GIF
                const findFile = (ext) => files.find(
                    f => f.Type?.toUpperCase() === ext.toUpperCase() ||
                         f.Url?.toLowerCase().endsWith(`.${ext.toLowerCase()}`)
                );
                const previewFile = files.find(f => f.Type === 'Image' || f.Type === 'GIF');

                // Preview (общий для всех форматов)
                const glbFile    = findFile('glb') ?? files.find(f => f.Type !== 'Image' && f.Type !== 'GIF');
                const previewUrl = glbFile?.PreviewImageUrl || previewFile?.Url || null;
                let previewBase64 = null;
                let previewMime   = null;
                if (previewUrl) {
                    try {
                        const buf = await downloadBuffer(previewUrl);
                        previewBase64 = buf.toString('base64');
                        previewMime   = previewUrl.toLowerCase().includes('.gif') ? 'image/gif' : 'image/png';
                    } catch (e) {
                        console.warn('[hunyuan-3d] не удалось скачать превью:', e.message);
                    }
                }

                if (format === 'fbx' || format === 'stl') {
                    // Конвертация выполняется отдельно; возвращаем Tencent-URL GLB как source
                    if (!glbFile?.Url) {
                        return json(res, 200, { status: 'error', error: 'Tencent не вернул GLB для конвертации' });
                    }
                    return json(res, 200, {
                        status: 'done',
                        needsConvert: true,
                        sourceGlbUrl: glbFile.Url,
                        previewBase64,
                        mimeType: previewMime
                    });
                }

                // format ∈ { glb, obj }
                const target = findFile(format);
                if (!target?.Url) {
                    return json(res, 200, { status: 'error', error: `Tencent не вернул файл формата ${format}` });
                }
                const buf      = await downloadBuffer(target.Url);
                const modelUrl = await storeModel(jobId, buf, format);

                return json(res, 200, {
                    status: 'done',
                    previewBase64,
                    mimeType: previewMime,
                    modelUrl,
                    format
                });
            }

            // Неизвестный статус — считаем pending
            return json(res, 200, { status: 'pending', progress: 0, stage: null });
        } catch (err) {
            console.error('[hunyuan-3d] poll error:', err.message);
            return json(res, 502, { success: false, error: err.message });
        }
    }

    // ── POST /api/v2/ai/hunyuan-3d/convert3d ─────────────────────────────────
    //   Принимает: { glbUrl: string, format: 'fbx'|'stl' }
    //   Возвращает: { jobId }
    if (method === 'POST' && url === '/api/v2/ai/hunyuan-3d/convert3d') {
        try {
            const body = await parseBody(req);
            const { glbUrl, format } = body;
            if (!glbUrl || !format) {
                return json(res, 400, { success: false, error: 'glbUrl и format обязательны' });
            }
            if (!['fbx', 'stl'].includes(format.toLowerCase())) {
                return json(res, 400, { success: false, error: 'format должен быть fbx или stl' });
            }
            const result = await submitConvertJob({ glbUrl, format });
            return json(res, 200, result); // { jobId }
        } catch (err) {
            console.error('[hunyuan-3d] convert submit error:', err.message);
            return json(res, 502, { success: false, error: err.message });
        }
    }

    // ── GET /api/v2/ai/hunyuan-3d/convert3d/:jobId?format=fbx|stl ────────────
    //   running -> { status:'pending'|'running', progress }
    //   done    -> { status:'done', modelUrl, format }
    //   fail    -> { status:'error', error }
    const convertPollMatch = url.match(/^\/api\/v2\/ai\/hunyuan-3d\/convert3d\/([^/]+)$/);
    if (method === 'GET' && convertPollMatch) {
        const jobId  = convertPollMatch[1];
        const qs     = new URLSearchParams(req.url.split('?')[1] || '');
        const format = (qs.get('format') || 'fbx').toLowerCase();
        try {
            const { status, errorCode, errorMessage, files } = await queryConvertJob(jobId);

            if (status === 'WAIT') {
                return json(res, 200, { status: 'pending', progress: 10 });
            }
            if (status === 'RUN') {
                return json(res, 200, { status: 'running', progress: 50 });
            }
            if (status === 'FAIL') {
                const msg = [errorCode, errorMessage].filter(Boolean).join(': ') || 'Ошибка конвертации';
                return json(res, 200, { status: 'error', error: msg });
            }
            if (status === 'DONE') {
                const target = files.find(
                    f => f.Type?.toUpperCase() === format.toUpperCase() ||
                         f.Url?.toLowerCase().endsWith(`.${format}`)
                ) ?? files[0];

                if (!target?.Url) {
                    return json(res, 200, { status: 'error', error: `Конвертация не вернула файл формата ${format}` });
                }
                const buf      = await downloadBuffer(target.Url);
                const modelUrl = await storeModel(jobId, buf, format);
                return json(res, 200, { status: 'done', modelUrl, format });
            }

            return json(res, 200, { status: 'pending', progress: 0 });
        } catch (err) {
            console.error('[hunyuan-3d] convert poll error:', err.message);
            return json(res, 502, { success: false, error: err.message });
        }
    }

    // ── GET /api/v2/ai/hunyuan-3d/file/:jobId.:ext ───────────────────────────
    //   Dev-раздача сохранённых моделей (glb/obj/fbx/stl).
    //   Не нужна если задан BOARD_UPLOAD_ENDPOINT.
    const fileMatch = url.match(/^\/api\/v2\/ai\/hunyuan-3d\/file\/([a-z0-9_-]+\.(glb|obj|fbx|stl))$/i);
    if (method === 'GET' && fileMatch) {
        const filename    = fileMatch[1];
        const ext         = fileMatch[2].toLowerCase();
        const filePath    = join(MODELS_DIR, filename);
        if (!existsSync(filePath)) {
            return json(res, 404, { success: false, message: `Файл ${filename} не найден` });
        }
        const data        = readFileSync(filePath);
        const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type':                contentType,
            'Content-Length':              data.length,
            'Access-Control-Allow-Origin': '*'
        });
        return res.end(data);
    }

    // ── Мок для прочих AI эндпоинтов (image/chat/etc.) ────────────────────────
    if (url.startsWith('/api/v2/ai')) {
        return json(res, 200, {
            success: true,
            message: '[Mock AI] Ответ AI-сервиса недоступен в dev-режиме.'
        });
    }

    // ── 404 ───────────────────────────────────────────────────────────────────
    return json(res, 404, { success: false, message: `Not found: ${url}` });
});

server.listen(PORT, () => {
    const hasKeys        = process.env.HUNYUAN_SECRET_ID && process.env.HUNYUAN_SECRET_KEY;
    const convertRegion  = process.env.HUNYUAN_CONVERT_REGION || 'ap-singapore';
    const generateRegion = process.env.HUNYUAN_REGION         || 'ap-guangzhou';
    console.log(`\n✅ Dev proxy запущен на http://localhost:${PORT}`);
    console.log(`   Данные сохраняются в .dev-data/`);
    console.log(`   3D модели — в .dev-data/3d-models/`);
    console.log(`   Hunyuan 3D: ${hasKeys ? '✅ ключи заданы' : '⚠️  HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY не заданы'}`);
    console.log(`   Регион генерации: ${generateRegion} | Регион конвертации: ${convertRegion}`);
    console.log(`   Бэкенд загрузки: ${process.env.BOARD_UPLOAD_ENDPOINT || 'локальный (.dev-data/3d-models/)'}`);
    console.log(`   Остановить: Ctrl+C\n`);
});
