import { Events } from '../../../core/events/Events.js';
import {
    createFileNameEditorInput,
    createFileNameEditorWrapper,
} from './InlineEditorDomFactory.js';
import { toScreenWithResolution } from './InlineEditorPositioningService.js';

export function openFileNameEditor(object, create = false) {
    // Проверяем структуру объекта и извлекаем данные
    let objectId, position, properties;

    if (create) {
        // Для создания нового объекта - данные в object.object
        const objData = object.object || object;
        objectId = objData.id || null;
        position = objData.position;
        properties = objData.properties || {};
    } else {
        // Для редактирования существующего объекта - данные в корне
        objectId = object.id;
        position = object.position;
        properties = object.properties || {};
    }

    const fileName = properties.fileName || 'Untitled';

    // Проверяем, что position существует
    if (!position) {
        console.error('❌ SelectTool: position is undefined in _openFileNameEditor', { object, create });
        return;
    }

    // Закрываем предыдущий редактор, если он открыт
    if (this.textEditor.active) {
        if (this.textEditor.objectType === 'file') {
            this._closeFileNameEditor(true);
        } else {
            this._closeTextEditor(true);
        }
    }

    // Если это редактирование существующего объекта, получаем его данные
    if (!create && objectId) {
        const posData = { objectId, position: null };
        const pixiReq = { objectId, pixiObject: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);

        // Обновляем данные из полученной информации
        if (posData.position) position = posData.position;

        // Скрываем текст файла на время редактирования
        if (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance) {
            const fileInstance = pixiReq.pixiObject._mb.instance;
            if (typeof fileInstance.hideText === 'function') {
                fileInstance.hideText();
            }
        }
    }

    // Создаем wrapper для input
    const wrapper = createFileNameEditorWrapper();

    // Создаем input для редактирования названия
    const input = createFileNameEditorInput(fileName);

    wrapper.appendChild(input);
    document.body.appendChild(wrapper);

    // Позиционируем редактор (аналогично _openTextEditor)
    const toScreen = (wx, wy) => toScreenWithResolution(this.textEditor.world || (this.app?.stage), this.app, wx, wy);
    const screenPos = toScreen(position.x, position.y);

    // Получаем размеры файлового объекта для точного позиционирования
    let fileWidth = 120;
    let fileHeight = 140;

    if (objectId) {
        const sizeData = { objectId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (sizeData.size) {
            fileWidth = sizeData.size.width;
            fileHeight = sizeData.size.height;
        }
    }

    // Позиционируем редактор в нижней части файла (где название)
    // В FileObject название находится в позиции y = height - 40
    const nameY = fileHeight - 40;
    const centerX = fileWidth / 2;

    wrapper.style.left = `${Math.round(screenPos.x + centerX - 60)}px`;  // Центрируем относительно файла
    wrapper.style.top = `${Math.round(screenPos.y + nameY)}px`;  // Позиционируем на уровне названия

    // Сохраняем состояние редактора
    this.textEditor = {
        active: true,
        objectId: objectId,
        textarea: input,
        wrapper: wrapper,
        position: position,
        properties: properties,
        objectType: 'file',
        isResizing: false
    };

    // Фокусируем и выделяем весь текст
    input.focus();
    input.select();

    // Функция завершения редактирования
    const finalize = (commit) => {
        this._closeFileNameEditor(commit);
    };

    // Обработчики событий
    input.addEventListener('blur', () => finalize(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finalize(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finalize(false);
        }
    });
}

export function closeFileNameEditor(commit) {
    // Проверяем, что редактор существует и не закрыт
    if (!this.textEditor || !this.textEditor.textarea || this.textEditor.closing) {
        return;
    }

    // Устанавливаем флаг закрытия, чтобы избежать повторных вызовов
    this.textEditor.closing = true;

    const input = this.textEditor.textarea;
    const value = input.value.trim();
    const commitValue = commit && value.length > 0;
    const objectId = this.textEditor.objectId;

    // Убираем wrapper из DOM
    if (this.textEditor.wrapper && this.textEditor.wrapper.parentNode) {
        this.textEditor.wrapper.remove();
    }

    // Показываем обратно текст файла
    if (objectId) {
        const pixiReq = { objectId, pixiObject: null };
        this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);

        if (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance) {
            const fileInstance = pixiReq.pixiObject._mb.instance;
            if (typeof fileInstance.showText === 'function') {
                fileInstance.showText();
            }

            // Применяем изменения если нужно
            if (commitValue && value !== this.textEditor.properties.fileName) {
                // Создаем команду изменения названия файла
                const oldName = this.textEditor.properties.fileName || 'Untitled';
                this.eventBus.emit(Events.Object.FileNameChange, {
                    objectId: objectId,
                    oldName: oldName,
                    newName: value
                });
            }
        }
    }

    // Сбрасываем состояние редактора
    this.textEditor = {
        active: false,
        objectId: null,
        textarea: null,
        wrapper: null,
        world: null,
        position: null,
        properties: null,
        objectType: 'text',
        isResizing: false
    };
}
