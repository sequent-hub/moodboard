import { Events } from '../../core/events/Events.js';

export class ToolbarDialogsController {
    constructor(toolbar) {
        this.toolbar = toolbar;
    }

    /**
     * Открывает диалог выбора файла и запускает режим "призрака"
     */
    async openFileDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*'; // Принимаем любые файлы
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', async () => {
            try {
                const file = input.files && input.files[0];
                if (!file) {
                    // Пользователь отменил выбор файла
                    this.toolbar.eventBus.emit(Events.Place.FileCanceled);
                    return;
                }

                // Файл выбран - запускаем режим "призрака"
                this.toolbar.eventBus.emit(Events.Place.FileSelected, {
                    file: file,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    properties: {
                        width: 120,
                        height: 140
                    }
                });

                // Активируем инструмент размещения
                this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.toolbar.placeSelectedButtonId = 'attachments';
                this.toolbar.setActiveToolbarButton('place');

            } catch (error) {
                console.error('Ошибка при выборе файла:', error);
                alert('Ошибка при выборе файла: ' + error.message);
            } finally {
                input.remove();
            }
        }, { once: true });

        // Обработка отмены диалога (клик вне диалога или ESC)
        const handleCancel = () => {
            setTimeout(() => {
                if (input.files.length === 0) {
                    this.toolbar.eventBus.emit(Events.Place.FileCanceled);
                    input.remove();
                }
                window.removeEventListener('focus', handleCancel);
            }, 100);
        };

        window.addEventListener('focus', handleCancel, { once: true });
        input.click();
    }

    /**
     * Открывает диалог выбора изображения и запускает режим "призрака"
     */
    async openImageDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*'; // Принимаем только изображения
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', async () => {
            try {
                const file = input.files && input.files[0];
                if (!file) {
                    // Пользователь отменил выбор изображения
                    this.toolbar.eventBus.emit(Events.Place.ImageCanceled);
                    return;
                }

                // Изображение выбрано - запускаем режим "призрака"
                this.toolbar.eventBus.emit(Events.Place.ImageSelected, {
                    file: file,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    properties: {
                        width: 300,  // Дефолтная ширина для изображения
                        height: 200  // Дефолтная высота для изображения (будет пересчитана по пропорциям)
                    }
                });

                // Активируем инструмент размещения
                this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.toolbar.placeSelectedButtonId = 'image';
                this.toolbar.setActiveToolbarButton('place');

            } catch (error) {
                console.error('Ошибка при выборе изображения:', error);
                alert('Ошибка при выборе изображения: ' + error.message);
            } finally {
                input.remove();
            }
        }, { once: true });

        // Обработка отмены диалога (клик вне диалога или ESC)
        const handleCancel = () => {
            setTimeout(() => {
                if (input.files.length === 0) {
                    this.toolbar.eventBus.emit(Events.Place.ImageCanceled);
                    input.remove();
                }
                window.removeEventListener('focus', handleCancel);
            }, 100);
        };

        window.addEventListener('focus', handleCancel, { once: true });
        input.click();
    }

    /**
     * Открывает диалог выбора изображения для ImageObject2 (новая изолированная цепочка)
     */
    async openImageObject2Dialog() {
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.accept = 'image/*';
        picker.style.position = 'fixed';
        picker.style.left = '-10000px';
        picker.style.top = '-10000px';
        document.body.appendChild(picker);

        const cleanupPicker = () => {
            if (picker.parentNode) {
                picker.parentNode.removeChild(picker);
            }
        };

        const emitCancel = () => {
            this.toolbar.eventBus.emit(Events.Place.ImageObject2Canceled, {
                source: 'toolbar:image2'
            });
        };

        picker.addEventListener('change', () => {
            const chosen = picker.files && picker.files[0];
            if (!chosen) {
                emitCancel();
                cleanupPicker();
                return;
            }

            this.toolbar.eventBus.emit(Events.Place.ImageObject2Selected, {
                file: chosen,
                fileName: chosen.name,
                fileSize: chosen.size,
                mimeType: chosen.type,
                source: 'toolbar:image2',
                defaults: {
                    width: 320,
                    height: 220
                }
            });

            cleanupPicker();
        }, { once: true });

        const onWindowFocus = () => {
            setTimeout(() => {
                const hasChosenFile = !!(picker.files && picker.files.length > 0);
                if (!hasChosenFile) {
                    emitCancel();
                    cleanupPicker();
                }
            }, 120);
        };

        window.addEventListener('focus', onWindowFocus, { once: true });
        picker.click();
    }
}
