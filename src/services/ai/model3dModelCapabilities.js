/**
 * Конфигурация возможностей моделей генерации 3D (Tencent Hunyuan 3D).
 *
 * Одна ответственность: данные и чистые helper-функции.
 * Никакого DOM, никаких импортов UI.
 *
 * Контракт — как в чате futurello: ключи опций provider-native
 * (Model/EnablePBR/FaceCount/GenerateType/EnableGeometry/ResultFormat),
 * payload приходит из Billing-каталога. model_tier ('pro'/'rapid') выводится
 * в ai-service из имени модели, поэтому сюда не выносится.
 *
 * @typedef {Object} Model3dOptionSpec
 * @property {string}       key      - native-ключ опции (как в gateway/Billing)
 * @property {'enum'|'int'} type     - тип значения
 * @property {Array<string|number>} [values] - допустимые значения (для enum)
 * @property {string|number}        default  - дефолтное значение
 * @property {boolean}      [fixed]  - true → опция не показывается в UI, шлём default
 * @property {Object<string, string>} [valueLabels] - value → подпись в UI
 * @property {string}      [pill]    - какая пилюля UI отображает опцию
 *                                       (faceCount|generateType|enablePbr|
 *                                        enableGeometry|resultFormat)
 *
 * @typedef {Object} Model3dCapability
 * @property {string}              id          - slug модели (он же model для бэкенда)
 * @property {string}              label       - подпись в UI
 * @property {string}              description - описание (провайдер · slug)
 * @property {string}              provider    - идентификатор провайдера для бэкенда
 * @property {Model3dOptionSpec[]} options     - нативные опции модели
 */

/** @type {Model3dCapability[]} */
export const MODEL_3D_MODELS = [
    {
        id: 'hunyuan-3d-pro',
        label: 'Hunyuan 3D Pro',
        description: 'Tencent · hunyuan-3d-pro',
        provider: 'tencentcloud',
        options: [
            {
                key: 'Model',
                type: 'enum',
                values: ['3.0'],
                default: '3.0',
                fixed: true,
                pill: 'model',
            },
            {
                key: 'EnablePBR',
                type: 'enum',
                values: ['false', 'true'],
                default: 'false',
                pill: 'enablePbr',
                valueLabels: { 'false': 'PBR выкл', 'true': 'PBR вкл' },
            },
            {
                key: 'FaceCount',
                type: 'int',
                values: [50000, 500000, 1000000, 1500000],
                default: 500000,
                pill: 'faceCount',
                valueLabels: { 50000: '50k', 500000: '500k', 1000000: '1M', 1500000: '1.5M' },
            },
            {
                key: 'GenerateType',
                type: 'enum',
                values: ['Normal', 'LowPoly', 'Geometry', 'Sketch'],
                default: 'Normal',
                pill: 'generateType',
                valueLabels: { Normal: 'Норма', LowPoly: 'LowPoly', Geometry: 'Геометрия', Sketch: 'Скетч' },
            },
        ],
    },
    {
        id: 'hunyuan-3d-rapid',
        label: 'Hunyuan 3D Rapid',
        description: 'Tencent · hunyuan-3d-rapid',
        provider: 'tencentcloud',
        options: [
            {
                key: 'EnablePBR',
                type: 'enum',
                values: ['false', 'true'],
                default: 'false',
                pill: 'enablePbr',
                valueLabels: { 'false': 'PBR выкл', 'true': 'PBR вкл' },
            },
            {
                key: 'EnableGeometry',
                type: 'enum',
                values: ['false', 'true'],
                default: 'false',
                pill: 'enableGeometry',
                valueLabels: { 'false': 'Геом выкл', 'true': 'Геом вкл' },
            },
            {
                key: 'ResultFormat',
                type: 'enum',
                values: ['OBJ', 'GLB', 'STL', 'USDZ', 'FBX', 'MP4'],
                default: 'OBJ',
                pill: 'resultFormat',
            },
        ],
    },
];

/**
 * Возвращает объект возможностей 3D-модели по id или null, если модель не найдена.
 * @param {string} id
 * @returns {Model3dCapability|null}
 */
export function getModel3dCapability(id) {
    return MODEL_3D_MODELS.find((m) => m.id === id) ?? null;
}

/**
 * Возвращает spec опции модели по pill-имени или null.
 * @param {Model3dCapability} cap
 * @param {string} pill
 * @returns {Model3dOptionSpec|null}
 */
export function find3dOptionByPill(cap, pill) {
    return cap?.options.find((o) => o.pill === pill) ?? null;
}
