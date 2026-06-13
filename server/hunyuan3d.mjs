/**
 * server/hunyuan3d.mjs — клиент Tencent Hunyuan 3D API.
 *
 * Подписывает запросы по TC3-HMAC-SHA256 (Tencent Cloud API 3.0).
 * Вызываемые методы:
 *   SubmitHunyuanTo3DProJob    — отправить джоб генерации
 *   QueryHunyuanTo3DProJob     — опросить статус генерации
 *   SubmitConvert3DFormatJob   — отправить джоб конвертации (регион ap-singapore)
 *   DescribeConvert3DFormatJob — опросить статус конвертации
 *
 * Документация:
 *   https://intl.cloud.tencent.com/document/product/1284/75540  (Submit)
 *   https://intl.cloud.tencent.com/document/product/1284/75541  (Query)
 *   https://intl.cloud.tencent.com/document/product/1284/75542  (File3D type)
 *   https://intl.cloud.tencent.com/document/product/1284/78768  (SubmitConvert)
 *   https://intl.cloud.tencent.com/document/product/1284/78769  (DescribeConvert)
 *
 * Env-переменные (задаются в .env или через оболочку):
 *   HUNYUAN_SECRET_ID      — Tencent Cloud SecretId
 *   HUNYUAN_SECRET_KEY     — Tencent Cloud SecretKey
 *   HUNYUAN_REGION         — регион генерации (по умолчанию ap-guangzhou)
 *   HUNYUAN_CONVERT_REGION — регион конвертации (по умолчанию ap-singapore;
 *                            guangzhou и hongkong возвращают UnsupportedRegion)
 */

import crypto from 'crypto';
import https  from 'https';

const HOST           = 'hunyuan.intl.tencentcloudapi.com';
const SERVICE        = 'hunyuan';
const API_VERSION    = '2023-09-01';
const region         = () => process.env.HUNYUAN_REGION         || 'ap-guangzhou';
const CONVERT_REGION = () => process.env.HUNYUAN_CONVERT_REGION || 'ap-singapore';

// ── TC3-HMAC-SHA256 signing ────────────────────────────────────────────────

function sha256Hex(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data) {
    return crypto.createHmac('sha256', key).update(data).digest();
}

function buildAuth(secretId, secretKey, bodyStr) {
    const now  = Math.floor(Date.now() / 1000);
    const date = new Date(now * 1000).toISOString().slice(0, 10); // YYYY-MM-DD UTC

    // 1. Canonical request
    const canonicalHeaders = `content-type:application/json\nhost:${HOST}\n`;
    const signedHeaders    = 'content-type;host';
    const canonicalRequest = [
        'POST', '/', '',
        canonicalHeaders, signedHeaders,
        sha256Hex(bodyStr)
    ].join('\n');

    // 2. String to sign
    const credentialScope = `${date}/${SERVICE}/tc3_request`;
    const stringToSign    = [
        'TC3-HMAC-SHA256',
        String(now),
        credentialScope,
        sha256Hex(canonicalRequest)
    ].join('\n');

    // 3. Signing key (bytes → bytes → bytes)
    const secretDate    = hmacSha256(`TC3${secretKey}`, date);
    const secretService = hmacSha256(secretDate, SERVICE);
    const secretSigning = hmacSha256(secretService, 'tc3_request');
    const signature     = crypto.createHmac('sha256', secretSigning)
        .update(stringToSign).digest('hex');

    // 4. Authorization header
    const authorization =
        `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return { authorization, timestamp: now };
}

// ── Generic Tencent API 3.0 HTTPS request ─────────────────────────────────

/**
 * Отправляет подписанный POST к Tencent Cloud API и разворачивает Response.
 * @param {string} action
 * @param {object} payload         — тело запроса (только API-специфичные поля)
 * @param {string} [regionOverride] — переопределяет X-TC-Region для конкретного вызова
 * @returns {Promise<object>}
 */
function tencentRequest(action, payload, regionOverride) {
    const secretId  = process.env.HUNYUAN_SECRET_ID;
    const secretKey = process.env.HUNYUAN_SECRET_KEY;
    if (!secretId || !secretKey) {
        return Promise.reject(
            new Error('Не заданы HUNYUAN_SECRET_ID и/или HUNYUAN_SECRET_KEY')
        );
    }

    const tcRegion = regionOverride || region();
    const bodyStr  = JSON.stringify(payload);
    const { authorization, timestamp } = buildAuth(secretId, secretKey, bodyStr);

    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: HOST,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type':    'application/json',
                    'Content-Length':  Buffer.byteLength(bodyStr),
                    'Host':            HOST,
                    'X-TC-Action':     action,
                    'X-TC-Timestamp':  String(timestamp),
                    'X-TC-Version':    API_VERSION,
                    'X-TC-Region':     tcRegion,
                    'Authorization':   authorization
                }
            },
            (res) => {
                let raw = '';
                res.on('data', c => { raw += c; });
                res.on('end', () => {
                    let parsed;
                    try { parsed = JSON.parse(raw); } catch {
                        return reject(new Error(
                            `Tencent вернул невалидный JSON: ${raw.slice(0, 200)}`
                        ));
                    }
                    const r = parsed?.Response;
                    if (r?.Error) {
                        reject(new Error(`Tencent ${r.Error.Code}: ${r.Error.Message}`));
                    } else {
                        resolve(r);
                    }
                });
            }
        );

        req.on('error', reject);
        // 175 s < vite proxyTimeout 180 s — запрос падёт до таймаута прокси
        req.setTimeout(175_000, () => req.destroy(new Error('Tencent API timeout')));
        req.write(bodyStr);
        req.end();
    });
}

// ── Public exports ─────────────────────────────────────────────────────────

/**
 * Отправляет джоб генерации 3D-модели.
 *
 * Tencent method: SubmitHunyuanTo3DProJob
 * Model: '3.1'
 * Режимы:
 *   text  — передаётся Prompt
 *   image — передаётся ImageBase64
 *   multi — ImageBase64 + MultiViewImages
 *
 * @param {{
 *   mode: 'text'|'image'|'multi',
 *   model?: string,
 *   prompt?: string,
 *   image?: { mimeType: string, data: string },
 *   multiViewImages?: Array<{ viewType: string, mimeType: string, data: string }>,
 *   generateType?: string,
 *   faceCount?: number,
 *   pbr?: boolean
 * }} p
 * @returns {Promise<{ jobId: string }>}
 */
export async function submitJob({ mode, model, prompt, image, multiViewImages, generateType, faceCount, pbr }) {
    if (prompt && image?.data) {
        throw new Error('prompt и image взаимоисключающи — передайте только одно из двух');
    }

    const payload = { Model: model || '3.1' };

    if (mode === 'text') {
        if (!prompt) throw new Error('mode=text требует prompt');
        payload.Prompt = prompt;
    } else if (mode === 'image' || mode === 'multi') {
        if (!image?.data) throw new Error(`mode=${mode} требует image.data`);
        payload.ImageBase64 = image.data;
        if (mode === 'multi' && Array.isArray(multiViewImages) && multiViewImages.length) {
            payload.MultiViewImages = multiViewImages.map(v => ({
                ViewType:        v.viewType,
                ViewImageBase64: v.data
            }));
        }
    } else {
        throw new Error(`Неизвестный mode: ${mode}. Допустимые: text, image, multi`);
    }

    if (generateType != null) payload.GenerateType = generateType;
    if (faceCount    != null) payload.FaceCount    = faceCount;
    if (pbr          != null) payload.EnablePBR    = pbr;

    const r = await tencentRequest('SubmitHunyuanTo3DProJob', payload);
    return { jobId: r.JobId };
}

/**
 * Опрашивает статус джоба генерации.
 *
 * Tencent method: QueryHunyuanTo3DProJob
 * Tencent статусы: WAIT | RUN | DONE | FAIL
 *
 * File3D при DONE: { Type: 'GLB'|'OBJ'|'GIF'|'Image', Url, PreviewImageUrl? }
 * Url действует 24 часа.
 *
 * @param {string} jobId
 * @returns {Promise<{
 *   status: 'WAIT'|'RUN'|'DONE'|'FAIL',
 *   errorCode: string|null,
 *   errorMessage: string|null,
 *   files: Array<{Type:string, Url:string, PreviewImageUrl?:string}>
 * }>}
 */
export async function queryJob(jobId) {
    const r = await tencentRequest('QueryHunyuanTo3DProJob', { JobId: jobId });
    return {
        status:       r.Status,
        errorCode:    r.ErrorCode    || null,
        errorMessage: r.ErrorMessage || null,
        files:        r.ResultFile3Ds || []
    };
}

/**
 * Отправляет джоб конвертации формата 3D-модели.
 *
 * Tencent method: SubmitConvert3DFormatJob
 * Регион: ap-singapore (guangzhou/hongkong возвращают UnsupportedRegion).
 *
 * @param {{ glbUrl: string, format: 'fbx'|'stl' }} p
 * @returns {Promise<{ jobId: string }>}
 */
export async function submitConvertJob({ glbUrl, format }) {
    const payload = {
        File:   { Url: glbUrl, Type: 'GLB' },
        Format: format.toUpperCase()
    };
    const r = await tencentRequest('SubmitConvert3DFormatJob', payload, CONVERT_REGION());
    return { jobId: r.JobId };
}

/**
 * Опрашивает статус джоба конвертации.
 *
 * Tencent method: DescribeConvert3DFormatJob (не QueryConvert3DFormatJob — см. документацию).
 * Статусы: WAIT | RUN | DONE | FAIL
 * При DONE: ResultFile3Ds — массив File3D с результирующими файлами.
 *
 * @param {string} jobId
 * @returns {Promise<{
 *   status: 'WAIT'|'RUN'|'DONE'|'FAIL',
 *   errorCode: string|null,
 *   errorMessage: string|null,
 *   files: Array<{Type:string, Url:string}>
 * }>}
 */
export async function queryConvertJob(jobId) {
    const r = await tencentRequest('DescribeConvert3DFormatJob', { JobId: jobId }, CONVERT_REGION());
    return {
        status:       r.Status,
        errorCode:    r.ErrorCode    || null,
        errorMessage: r.ErrorMessage || null,
        files:        r.ResultFile3Ds || []
    };
}

/**
 * Скачивает бинарный файл по HTTPS-URL (следует одному редиректу).
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
export function downloadBuffer(url) {
    function collect(res, cb) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
        res.on('error', cb);
    }

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Один редирект (Tencent CDN обычно без редиректов, но на всякий случай)
                https.get(res.headers.location, (res2) =>
                    collect(res2, (err, buf) => err ? reject(err) : resolve(buf))
                ).on('error', reject);
                return;
            }
            collect(res, (err, buf) => err ? reject(err) : resolve(buf));
        }).on('error', reject);
    });
}
