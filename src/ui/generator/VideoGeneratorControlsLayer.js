import { VIDEO_MODELS, getVideoModelCapability } from '../../services/ai/videoModelCapabilities.js';
import { VIDEO_GENERATOR_RUN_EVENT } from '../../services/ai/VideoGeneratorRunner.js';
import { ICONS, RATIO_ICONS } from '../chat/icons.js';
import { GeneratorControlsLayer, setPill } from './GeneratorControlsLayer.js';
import RUN_PLAY_ICON from '../../assets/icons/circle-play.svg?raw';
import RUN_REFRESH_ICON from '../../assets/icons/refresh.svg?raw';
import {
    VIDEO_GENERATOR_TYPE,
    VIDEO_GENERATOR_RATIOS,
    VIDEO_RESULT_STATUS,
    normalizeVideoGeneratorProperties,
    isVideoGeneratorRunning,
    getVideoGeneratorError,
    heightForVideoRatio,
    clampDuration,
} from '../../services/ai/videoGeneratorContract.js';

/**
 * Панель узла-генератора видео: модель, соотношение сторон, разрешение,
 * длительность и кнопка запуска.
 *
 * Классы оформления общие с панелью генератора изображений (`mb-imgen__*`):
 * это одна и та же панель по виду и поведению, отличается только набор пилюль.
 * Дублировать стили под второй префикс значило бы держать две копии одного
 * скина и чинить их порознь.
 */
export class VideoGeneratorControlsLayer extends GeneratorControlsLayer {
    get nodeType() {
        return VIDEO_GENERATOR_TYPE;
    }

    _normalize(props) {
        return normalizeVideoGeneratorProperties(props);
    }

    _buildFooter(footer, objectId) {
        const model = this._createPill(objectId, 'model', 'Модель');
        const ratio = this._createPill(objectId, 'ratio', 'Соотношение сторон');
        ratio.menu.classList.add('mb-imgen__menu--grid');
        const resolution = this._createPill(objectId, 'resolution', 'Разрешение');
        const duration = this._createPill(objectId, 'duration', 'Длительность');

        const run = this._createRunButton(objectId, VIDEO_GENERATOR_RUN_EVENT);

        footer.append(model.control, ratio.control, resolution.control, duration.control, run);

        model.onSelect = (value) => this._onModelChange(objectId, value);
        ratio.onSelect = (value) => this._onRatioChange(objectId, value);
        resolution.onSelect = (value) => this._patchParams(objectId, { resolution: value });
        duration.onSelect = (value) => this._patchParams(objectId, { duration: clampDuration(value) });

        return { model, ratio, resolution, duration, run };
    }

    _syncControls(entry, object) {
        const props = normalizeVideoGeneratorProperties(object.properties);
        const capability = getVideoModelCapability(props.params.modelId) || VIDEO_MODELS[0] || null;
        const running = isVideoGeneratorRunning(props);
        const error = getVideoGeneratorError(props);

        const changed = this._shouldSync(object.id, [
            props.params.modelId,
            props.params.ratio,
            props.params.resolution,
            props.params.duration,
            running,
            error,
            props.results.length,
        ]);
        if (!changed) return;

        setPill(
            entry.model,
            iconForProvider(capability?.provider),
            capability?.label || 'Модель',
            VIDEO_MODELS.map((m) => ({
                value: m.id,
                label: m.label,
                icon: iconForProvider(m.provider),
                description: m.description,
            })),
            capability?.id || ''
        );

        const ratios = supportedRatios(capability);
        const ratio = ratios.includes(props.params.ratio) ? props.params.ratio : ratios[0];
        setPill(
            entry.ratio,
            RATIO_ICONS[ratio] || RATIO_ICONS['16:9'],
            ratio,
            ratios.map((id) => ({ value: id, label: id, icon: RATIO_ICONS[id] || RATIO_ICONS['16:9'] })),
            ratio
        );

        const resolutions = supportedResolutions(capability);
        const resolution = resolutions.includes(props.params.resolution) ? props.params.resolution : resolutions[0];
        setPill(
            entry.resolution,
            ICONS.resolution,
            resolution,
            resolutions.map((id) => ({ value: id, label: id, icon: ICONS.resolution })),
            resolution
        );
        // Модель с единственным разрешением выбора не даёт — прячем пилюлю.
        entry.resolution.control.hidden = resolutions.length < 2;

        const durations = supportedDurations(capability);
        const duration = durations.includes(props.params.duration) ? props.params.duration : durations[0];
        setPill(
            entry.duration,
            ICONS.clock,
            `${duration} с`,
            durations.map((value) => ({ value: String(value), label: `${value} с`, icon: ICONS.clock })),
            String(duration)
        );
        entry.duration.control.hidden = durations.length < 2;

        const done = props.results.some((r) => r.status === VIDEO_RESULT_STATUS.Done);
        const title = running ? 'Генерация…' : (done ? 'Обновить' : 'Сгенерировать');

        entry.run.innerHTML = running || done ? RUN_REFRESH_ICON : RUN_PLAY_ICON;
        entry.run.title = title;
        entry.run.setAttribute('aria-label', title);
        entry.run.disabled = running;
        entry.run.classList.toggle('mb-imgen__run--busy', running);
    }

    _onModelChange(objectId, modelId) {
        const capability = getVideoModelCapability(modelId);
        const object = this._objects().find((obj) => obj?.id === objectId);
        const props = normalizeVideoGeneratorProperties(object?.properties);

        const ratios = supportedRatios(capability);
        const resolutions = supportedResolutions(capability);
        const durations = supportedDurations(capability);

        this._patchParams(objectId, {
            modelId,
            ratio: ratios.includes(props.params.ratio) ? props.params.ratio : ratios[0],
            resolution: resolutions.includes(props.params.resolution) ? props.params.resolution : resolutions[0],
            duration: durations.includes(props.params.duration) ? props.params.duration : durations[0],
        });
    }

    _onRatioChange(objectId, ratio) {
        const object = this._objects().find((obj) => obj?.id === objectId);
        if (!object) return;

        const width = Math.max(1, object.width || 380);
        const height = heightForVideoRatio(ratio, width, object.height || 214);

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
    const ratios = Array.isArray(capability?.ratios) ? capability.ratios : [];
    const supported = VIDEO_GENERATOR_RATIOS.filter((id) => ratios.includes(id));
    return supported.length ? supported : VIDEO_GENERATOR_RATIOS;
}

/**
 * @param {object|null} capability
 * @returns {string[]}
 */
function supportedResolutions(capability) {
    const resolutions = Array.isArray(capability?.resolutions) ? capability.resolutions : [];
    return resolutions.length ? resolutions : ['720p'];
}

/**
 * @param {object|null} capability
 * @returns {number[]}
 */
function supportedDurations(capability) {
    const durations = Array.isArray(capability?.durations) ? capability.durations : [];
    return durations.length ? durations : [4];
}

/** Иконка провайдера модели — та же, что в пилюле модели в чате. */
function iconForProvider(provider) {
    switch (provider) {
        case 'veo':
        case 'gemini-video': return ICONS.modelGoogle;
        case 'kling':        return ICONS.modelKling;
        case 'seedance':     return ICONS.modelSeedance;
        case 'openai-video': return ICONS.modelGpt;
        default:             return ICONS.model;
    }
}
