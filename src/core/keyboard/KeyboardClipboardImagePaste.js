import { Events } from '../events/Events.js';

export class KeyboardClipboardImagePaste {
    constructor(eventBus, core = null) {
        this.eventBus = eventBus;
        this.core = core;
    }

    async handleImageUpload(dataUrl, fileName) {
        try {
            if (this.core && this.core.imageUploadService) {
                const uploadResult = await this.core.imageUploadService.uploadFromDataUrl(dataUrl, fileName);
                this.eventBus.emit(Events.UI.PasteImage, {
                    src: uploadResult.url,
                    name: uploadResult.name,
                    imageId: uploadResult.imageId || uploadResult.id
                });
            } else {
                this.eventBus.emit(Events.UI.PasteImage, { src: dataUrl, name: fileName });
            }
        } catch (error) {
            console.error('Ошибка загрузки изображения:', error);
            this.eventBus.emit(Events.UI.PasteImage, { src: dataUrl, name: fileName });
        }
    }

    async handleImageFileUpload(file, fileName) {
        try {
            if (this.core && this.core.imageUploadService) {
                const uploadResult = await this.core.imageUploadService.uploadImage(file, fileName);
                this.eventBus.emit(Events.UI.PasteImage, {
                    src: uploadResult.url,
                    name: uploadResult.name,
                    imageId: uploadResult.imageId || uploadResult.id
                });
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    this.eventBus.emit(Events.UI.PasteImage, {
                        src: reader.result,
                        name: fileName
                    });
                };
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error('Ошибка загрузки файла изображения:', error);
            try {
                const reader = new FileReader();
                reader.onload = () => {
                    this.eventBus.emit(Events.UI.PasteImage, {
                        src: reader.result,
                        name: fileName
                    });
                };
                reader.readAsDataURL(file);
            } catch (fallbackError) {
                console.error('Критическая ошибка при чтении файла:', fallbackError);
            }
        }
    }

    createPasteHandler() {
        return async (e) => {
            try {
                const cd = e.clipboardData;
                if (!cd) return;
                let handled = false;

                const items = cd.items ? Array.from(cd.items) : [];
                const imageItem = items.find(i => i.type && i.type.startsWith('image/'));
                if (imageItem) {
                    e.preventDefault();
                    const file = imageItem.getAsFile();
                    if (file) {
                        await this.handleImageFileUpload(file, file.name || 'clipboard-image.png');
                        handled = true;
                    }
                }
                if (handled) return;

                const files = cd.files ? Array.from(cd.files) : [];
                const imgFile = files.find(f => f.type && f.type.startsWith('image/'));
                if (imgFile) {
                    e.preventDefault();
                    await this.handleImageFileUpload(imgFile, imgFile.name || 'clipboard-image.png');
                    return;
                }

                const html = cd.getData && cd.getData('text/html');
                if (html && html.includes('<img')) {
                    const match = html.match(/<img[^>]*src\s*=\s*"([^"]+)"/i);
                    if (match && match[1]) {
                        const srcInHtml = match[1];
                        if (/^data:image\//i.test(srcInHtml)) {
                            e.preventDefault();
                            this.handleImageUpload(srcInHtml, 'clipboard-image.png');
                            return;
                        }
                        if (/^https?:\/\//i.test(srcInHtml)) {
                            e.preventDefault();
                            try {
                                const resp = await fetch(srcInHtml, { mode: 'cors' });
                                const blob = await resp.blob();
                                const dataUrl = await this._blobToDataUrl(blob);
                                this.handleImageUpload(dataUrl, srcInHtml.split('/').pop() || 'image');
                            } catch (_) {
                                this.eventBus.emit(Events.UI.PasteImage, {
                                    src: srcInHtml,
                                    name: srcInHtml.split('/').pop() || 'image'
                                });
                            }
                            return;
                        }
                        if (/^blob:/i.test(srcInHtml)) {
                            try {
                                if (navigator.clipboard && navigator.clipboard.read) {
                                    const itemsFromAPI = await navigator.clipboard.read();
                                    for (const item of itemsFromAPI) {
                                        const imgType = (item.types || []).find(t => t.startsWith('image/'));
                                        if (!imgType) continue;
                                        const blob = await item.getType(imgType);
                                        const dataUrl = await this._blobToDataUrl(blob);
                                        e.preventDefault();
                                        this.handleImageUpload(dataUrl, `clipboard.${imgType.split('/')[1] || 'png'}`);
                                        return;
                                    }
                                }
                            } catch (_) {}
                        }
                    }
                }

                const text = cd.getData && cd.getData('text/plain');
                if (text) {
                    const trimmed = text.trim();
                    const isDataUrl = /^data:image\//i.test(trimmed);
                    const isHttpUrl = /^https?:\/\//i.test(trimmed);
                    const looksLikeImage = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmed);
                    if (isDataUrl) {
                        e.preventDefault();
                        this.handleImageUpload(trimmed, 'clipboard-image.png');
                        return;
                    }
                    if (isHttpUrl && looksLikeImage) {
                        e.preventDefault();
                        try {
                            const resp = await fetch(trimmed, { mode: 'cors' });
                            const blob = await resp.blob();
                            const dataUrl = await this._blobToDataUrl(blob);
                            this.handleImageUpload(dataUrl, trimmed.split('/').pop() || 'image');
                            return;
                        } catch (_) {
                            this.eventBus.emit(Events.UI.PasteImage, {
                                src: trimmed,
                                name: trimmed.split('/').pop() || 'image'
                            });
                            return;
                        }
                    }
                }

                try {
                    if (!handled && navigator.clipboard && navigator.clipboard.read) {
                        const itemsFromAPI = await navigator.clipboard.read();
                        for (const item of itemsFromAPI) {
                            const imgType = (item.types || []).find(t => t.startsWith('image/'));
                            if (!imgType) continue;
                            const blob = await item.getType(imgType);
                            const dataUrl = await this._blobToDataUrl(blob);
                            e.preventDefault();
                            this.handleImageUpload(dataUrl, `clipboard.${imgType.split('/')[1] || 'png'}`);
                            return;
                        }
                    }
                } catch (_) {}
            } catch (err) {
                console.error('Error in paste handler:', err);
            }
        };
    }

    _blobToDataUrl(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }
}
