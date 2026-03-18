import {
    closeTextEditor as closeTextEditorViaController,
    openTextEditor as openTextEditorViaController,
} from './TextInlineEditorController.js';
import {
    closeFileNameEditor as closeFileNameEditorViaController,
    openFileNameEditor as openFileNameEditorViaController,
} from './FileNameInlineEditorController.js';
import {
    closeMindmapEditor as closeMindmapEditorViaController,
    openMindmapEditor as openMindmapEditorViaController,
} from './MindmapInlineEditorController.js';

export function openTextEditor(object, create = false) {
    return openTextEditorViaController.call(this, object, create);
}

export function openFileNameEditor(object, create = false) {
    return openFileNameEditorViaController.call(this, object, create);
}

export function openMindmapEditor(object, create = false) {
    return openMindmapEditorViaController.call(this, object, create);
}

export function closeFileNameEditor(commit) {
    return closeFileNameEditorViaController.call(this, commit);
}

export function closeTextEditor(commit) {
    if (this.textEditor?.active && this.textEditor.objectType === 'mindmap') {
        return closeMindmapEditorViaController.call(this, commit);
    }
    return closeTextEditorViaController.call(this, commit);
}

export function closeMindmapEditor(commit) {
    return closeMindmapEditorViaController.call(this, commit);
}
