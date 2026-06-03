/**
 * dev-server.mjs — локальный mock-бэкенд для разработки.
 * Запускается на порту 3001, куда vite.config.js проксирует /api.
 *
 * Использование: node dev-server.mjs
 */

import http from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const PORT = 3001;
const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '.dev-data');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);

// Хранилище в памяти + файловая персистентность
const boards = {};   // boardId -> { state, name, description, settings }
const meta  = {};   // boardId -> { name, description, settings }

function dataFile(boardId) {
    return join(DATA_DIR, `${boardId.replace(/[^a-z0-9_-]/gi, '_')}.json`);
}

function loadBoard(boardId) {
    if (boards[boardId]) return boards[boardId];
    const f = dataFile(boardId);
    if (existsSync(f)) {
        try {
            boards[boardId] = JSON.parse(readFileSync(f, 'utf8'));
        } catch {
            boards[boardId] = { state: { objects: [] }, name: null, description: null, settings: {} };
        }
    } else {
        boards[boardId] = { state: { objects: [] }, name: null, description: null, settings: {} };
    }
    return boards[boardId];
}

function saveBoard(boardId) {
    try {
        writeFileSync(dataFile(boardId), JSON.stringify(boards[boardId], null, 2));
    } catch { /* non-critical */ }
}

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
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-TOKEN, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    const method = req.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-TOKEN, X-Requested-With',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });
        return res.end();
    }

    console.log(`[mock] ${method} ${url}`);

    // ── GET /api/v2/moodboard/:boardId ──────────────────────────────────────
    const loadMatch = url.match(/^\/api\/v2\/moodboard\/([^/]+)$/);
    if (method === 'GET' && loadMatch) {
        const boardId = decodeURIComponent(loadMatch[1]);
        const board = loadBoard(boardId);
        return json(res, 200, {
            success: true,
            data: {
                moodboardId: boardId,
                name: board.name || null,
                description: board.description || null,
                settings: board.settings || {},
                state: board.state || { objects: [] },
                version: 1
            }
        });
    }

    // ── POST /api/v2/moodboard/history/save ─────────────────────────────────
    if (method === 'POST' && url === '/api/v2/moodboard/history/save') {
        const body = await parseBody(req);
        const { moodboardId, state } = body;
        if (!moodboardId) return json(res, 400, { success: false, message: 'moodboardId required' });
        const board = loadBoard(moodboardId);
        board.state = state || { objects: [] };
        saveBoard(moodboardId);
        return json(res, 200, {
            success: true,
            moodboardId,
            historyVersion: Date.now(),
            deduplicated: false
        });
    }

    // ── POST /api/v2/moodboard/metadata/save ────────────────────────────────
    if (method === 'POST' && url === '/api/v2/moodboard/metadata/save') {
        const body = await parseBody(req);
        const { moodboardId, name, description, settings } = body;
        if (!moodboardId) return json(res, 400, { success: false, message: 'moodboardId required' });
        const board = loadBoard(moodboardId);
        if (name !== undefined) board.name = name;
        if (description !== undefined) board.description = description;
        if (settings !== undefined) board.settings = settings;
        saveBoard(moodboardId);
        return json(res, 200, { success: true, moodboardId });
    }

    // ── POST /api/v2/images/upload ──────────────────────────────────────────
    if (method === 'POST' && url === '/api/v2/images/upload') {
        // Mock: структура совпадает с тем, что ожидает ImageUploadService (result.data.url)
        return json(res, 200, {
            success: true,
            data: {
                url: '/placeholder-image.png',
                width: 800,
                height: 600,
                name: 'placeholder-image.png',
                size: 1024,
            }
        });
    }

    // ── POST /api/v2/files/upload ───────────────────────────────────────────
    if (method === 'POST' && url === '/api/v2/files/upload') {
        // Mock: структура совпадает с тем, что ожидает FileUploadService (result.data.url)
        return json(res, 200, {
            success: true,
            data: {
                url: '/placeholder-file.pdf',
                size: 1024,
                name: 'uploaded-file.pdf',
                mime_type: 'application/octet-stream',
            }
        });
    }

    // ── POST /api/v2/ai/* ───────────────────────────────────────────────────
    if (method === 'POST' && url.startsWith('/api/v2/ai')) {
        return json(res, 200, {
            success: true,
            message: '[Mock AI] Ответ AI-сервиса недоступен в dev-режиме.'
        });
    }

    // ── 404 для всего остального ────────────────────────────────────────────
    return json(res, 404, { success: false, message: `Not found: ${url}` });
});

server.listen(PORT, () => {
    console.log(`\n✅ Mock backend запущен на http://localhost:${PORT}`);
    console.log(`   Данные сохраняются в .dev-data/`);
    console.log(`   Остановить: Ctrl+C\n`);
});
