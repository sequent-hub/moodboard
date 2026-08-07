import { IMAGE_MODELS, getImageModelCapability } from '../../services/ai/imageModelCapabilities.js';
import { GENERATOR_RUN_EVENT } from '../../services/ai/ImageGeneratorRunner.js';
import { ICONS, RATIO_ICONS, COUNT_ICONS } from '../chat/icons.js';
import { GeneratorControlsLayer, setPill } from './GeneratorControlsLayer.js';
import RUN_PLAY_ICON from '../../assets/icons/circle-play.svg?raw';
import RUN_REFRESH_ICON from '../../assets/icons/refresh.svg?raw';
import {
    IMAGE_GENERATOR_TYPE,
    GENERATOR_RATIOS,
    GENERATOR_MAX_COUNT,
    RESULT_STATUS,
    normalizeGeneratorProperties,
    clampCount,
    isGeneratorRunning,
    getGeneratorError,
    heightForRatio,
} from '../../services/ai/imageGeneratorContract.js';

/**
 * Панель узла-генератора изображений: количество, модель, соотношение сторон
 * и кнопка запуска.
 *
 * Жизненный цикл, геометрия и механика пилюль — в GeneratorControlsLayer.
 */
export class ImageGeneratorControlsLayer extends GeneratorControlsLayer {
    get nodeType() {
        return IMAGE_GENERATOR_TYPE;
    }

    _normalize(props) {
        return normalizeGeneratorProperties(props);
    }

    _buildFooter(footer, objectId) {
        const count = this._createPill(objectId, 'count', 'Количество изображений');
        const model = this._createPill(objectId, 'model', 'Модель');
        const ratio = this._createPill(objectId, 'ratio', 'Соотношение сторон');
        ratio.menu.classList.add('mb-imgen__menu--grid');

        const run = this._createRunButton(objectId, GENERATOR_RUN_EVENT);

        footer.append(count.control, model.control, ratio.control, run);

        count.onSelect = (value) => this._patchParams(objectId, { count: clampCount(value) });
        model.onSelect = (value) => this._onModelChange(objectId, value);
        ratio.onSelect = (value) => this._onRatioChange(objectId, value);

        return { count, model, ratio, run };
    }

    _syncControls(entry, object) {
        const props = normalizeGeneratorProperties(object.properties);
        const capability = getImageModelCapability(props.params.modelId) || IMAGE_MODELS[0] || null;
        const running = isGeneratorRunning(props);
        const error = getGeneratorError(props);

        const changed = this._shouldSync(object.id, [
            props.params.modelId,
            props.params.count,
            props.params.ratio,
            running,
            error,
            props.results.length,
        ]);
        if (!changed) return;

        const maxCount = Math.min(GENERATOR_MAX_COUNT, capability?.maxCount ?? 4);
        const count = Math.min(props.params.count, maxCount);
        setPill(
            entry.count,
            countIcon(count),
            String(count),
            Array.from({ length: maxCount }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
                icon: countIcon(i + 1),
            })),
            String(count)
        );

        setPill(
            entry.model,
            iconForProvider(capability?.provider),
            capability?.label || 'Модель',
            IMAGE_MODELS.map((m) => ({
                value: m.id,
                label: m.label,
                icon: iconForProvider(m.provider),
                description: m.description,
            })),
            capability?.id || ''
        );

        const supported = supportedRatios(capability);
        const ratio = supported.includes(props.params.ratio) ? props.params.ratio : 'auto';
        setPill(
            entry.ratio,
            RATIO_ICONS[ratio] || RATIO_ICONS.auto,
            ratio === 'auto' ? 'Авто' : ratio,
            supported.map((id) => ({
                value: id,
                label: id === 'auto' ? 'Авто' : id,
                icon: RATIO_ICONS[id] || RATIO_ICONS.auto,
            })),
            ratio
        );

        const done = props.results.some((r) => r.status === RESULT_STATUS.Done);
        const title = running ? 'Генерация…' : (done ? 'Обновить' : 'Сгенерировать');

        entry.run.innerHTML = running || done ? RUN_REFRESH_ICON : RUN_PLAY_ICON;
        entry.run.title = title;
        entry.run.setAttribute('aria-label', title);
        entry.run.disabled = running;
        entry.run.classList.toggle('mb-imgen__run--busy', running);
    }

    _onModelChange(objectId, modelId) {
        const capability = getImageModelCapability(modelId);
        const object = this._objects().find((obj) => obj?.id === objectId);
        const props = normalizeGeneratorProperties(object?.properties);

        const maxCount = Math.min(GENERATOR_MAX_COUNT, capability?.maxCount ?? 4);
        const ratios = supportedRatios(capability);

        this._patchParams(objectId, {
            modelId,
            count: Math.min(props.params.count, maxCount),
            ratio: ratios.includes(props.params.ratio) ? props.params.ratio : 'auto',
        });
    }

    _onRatioChange(objectId, ratio) {
        const object = this._objects().find((obj) => obj?.id === objectId);
        if (!object) return;

        const width = Math.max(1, object.width || 380);
        const height = heightForRatio(ratio, width, object.height || 300);

        // Соотношение сторон меняет и параметр, и высоту карточки — одним патчем,
        // иначе в историю уходят две записи и промежуточное состояние сохраняется.
        this._patchParams(objectId, { ratio }, height === object.height ? {} : { height });
    }
}

/**
 * @param {object|null} capability
 * @returns {string[]}
 */
function supportedRatios(capability) {
    if (!capability || !Array.isArray(capability.ratios) || capability.ratios.length === 0) {
        return GENERATOR_RATIOS;
    }
    return GENERATOR_RATIOS.filter((id) => id === 'auto' || capability.ratios.includes(id));
}

/** Иконка провайдера модели — та же, что в пилюле модели в чате. */
function iconForProvider(provider) {
    switch (provider) {
        case 'gemini-image': return ICONS.modelGoogle;
        case 'openai-image': return ICONS.modelGpt;
        case 'qwen-image':   return ICONS.modelQwen;
        default:             return ICONS.model;
    }
}

/** Набор иконок количества заканчивается на 4 — дальше повторяем последнюю. */
function countIcon(count) {
    return COUNT_ICONS[Math.min(4, Math.max(1, Number(count) || 1))];
}
