import {
    closeTextEditor as closeTextEditorViaController,
    openTextEditor as openTextEditorViaController,
} from './TextInlineEditorController.js';
import {
    closeFileNameEditor as closeFileNameEditorViaController,
    openFileNameEditor as openFileNameEditorViaController,
} from './FileNameInlineEditorController.js';

export function openTextEditor(object, create = false) {
    return openTextEditorViaController.call(this, object, create);
}

export function openFileNameEditor(object, create = false) {
    return openFileNameEditorViaController.call(this, object, create);
}

export function closeFileNameEditor(commit) {
    return closeFileNameEditorViaController.call(this, commit);
}

export function closeTextEditor(commit) {
    return closeTextEditorViaController.call(this, commit);
}
