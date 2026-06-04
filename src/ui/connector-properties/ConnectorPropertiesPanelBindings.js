import {
    hexToPixiColor,
    buildStyleUpdate,
} from './ConnectorPropertiesPanelMapper.js';
import {
    showStrokeDropdown,
    hideStrokeDropdown,
    showLabelColorDropdown,
    hideLabelColorDropdown,
} from './ConnectorPropertiesPanelRenderer.js';
import { Events } from '../../core/events/Events.js';

export function bindConnectorPropertiesPanelControls(inst) {
    if (inst._bindingsAttached) return;

    // ── Цвет линии ──────────────────────────────────────────────────────────

    inst.strokeColorButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (inst.strokeColorDropdown.style.display === 'none') {
            showStrokeDropdown(inst);
        } else {
            hideStrokeDropdown(inst);
        }
    });

    inst._strokePresetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const pixi = parseInt(btn.dataset.pixiValue, 10);
            inst._emitStyle({ stroke: pixi });
            hideStrokeDropdown(inst);
        });
    });

    inst.strokeColorInput.addEventListener('change', (e) => {
        const pixi = hexToPixiColor(e.target.value);
        inst._emitStyle({ stroke: pixi });
        hideStrokeDropdown(inst);
    });

    inst._onStrokeDocumentClick = (e) => {
        if (inst._strokeSelectorContainer && !inst._strokeSelectorContainer.contains(e.target)) {
            hideStrokeDropdown(inst);
        }
    };
    document.addEventListener('click', inst._onStrokeDocumentClick);

    // ── Ширина ───────────────────────────────────────────────────────────────

    inst.widthButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const w = parseInt(btn.dataset.width, 10);
            inst._emitStyle({ width: w });
        });
    });

    // ── Маршрут ──────────────────────────────────────────────────────────────

    inst.routeSelect.addEventListener('change', (e) => {
        inst._emitStyle({ route: e.target.value });
    });

    // ── Пунктир ──────────────────────────────────────────────────────────────

    inst.dashButton.addEventListener('click', () => {
        const connector = inst._getConnector();
        const currentDash = connector?.properties?.style?.dash ?? false;
        inst._emitStyle({ dash: !currentDash });
    });

    // ── Наконечник конец ─────────────────────────────────────────────────────

    inst.headEndSelect.addEventListener('change', (e) => {
        const connector = inst._getConnector();
        const currentHead = connector?.properties?.style?.head ?? { start: 'none', end: 'arrow' };
        inst._emitStyle({ head: { ...currentHead, end: e.target.value } });
    });

    // ── Наконечник начало ────────────────────────────────────────────────────

    inst.headStartSelect.addEventListener('change', (e) => {
        const connector = inst._getConnector();
        const currentHead = connector?.properties?.style?.head ?? { start: 'none', end: 'arrow' };
        inst._emitStyle({ head: { ...currentHead, start: e.target.value } });
    });

    // ── Разворот ─────────────────────────────────────────────────────────────

    inst._swapBtn.addEventListener('click', () => {
        if (!inst.currentId) return;
        const connector = inst._getConnector();
        if (!connector?.properties) return;

        const oldStart = connector.properties.start;
        const oldEnd   = connector.properties.end;
        const oldHead  = connector.properties.style?.head ?? { start: 'none', end: 'arrow' };

        inst.eventBus.emit(Events.Object.StateChanged, {
            objectId: inst.currentId,
            updates: {
                properties: {
                    start: oldEnd,
                    end:   oldStart,
                    style: {
                        ...connector.properties.style,
                        head: { start: oldHead.end, end: oldHead.start },
                    },
                },
            },
        });
    });

    // ── Кнопка T+: создать / открыть редактор метки ──────────────────────────

    inst._textBtn.addEventListener('click', () => {
        if (!inst.currentId) return;
        const connector = inst._getConnector();
        if (!connector) return;

        const existingLabel = connector.properties?.style?.label;
        if (!existingLabel) {
            // Инициализируем метку с пустым текстом
            const strokeColor = connector.properties?.style?.stroke ?? 0x212121;
            inst._emitLabel({ text: '', color: strokeColor, fontSize: 14 });
        }

        // Открываем редактор после небольшой задержки (StateChanged успевает обработаться)
        requestAnimationFrame(() => {
            inst.core?.connectorLabelLayer?.openEditorForConnector(inst.currentId);
        });
    });

    // ── Замок ────────────────────────────────────────────────────────────────

    inst._lockBtn.addEventListener('click', () => {
        if (!inst.currentId) return;
        const connector = inst._getConnector();
        const locked = !(connector?.properties?.locked ?? false);
        inst.eventBus.emit(Events.Object.StateChanged, {
            objectId: inst.currentId,
            updates: { properties: { locked } },
        });
        inst._lockBtn.textContent = locked ? '🔒' : '🔓';
    });

    // ── Удалить ──────────────────────────────────────────────────────────────

    inst._delBtn.addEventListener('click', () => {
        if (!inst.currentId) return;
        inst.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [inst.currentId] });
    });

    // ── Label: цвет (dropdown пресетов) ─────────────────────────────────────

    if (inst._labelColorBtn) {
        inst._labelColorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (inst._labelColorDropdown?.style.display === 'none') {
                showLabelColorDropdown(inst);
            } else {
                hideLabelColorDropdown(inst);
            }
        });
    }

    inst._labelPresetButtons?.forEach(btn => {
        btn.addEventListener('click', () => {
            const pixi = parseInt(btn.dataset.pixiValue, 10);
            const connector = inst._getConnector();
            const existing  = connector?.properties?.style?.label;
            if (!existing) return;
            inst._emitLabel({ ...existing, color: pixi });
            hideLabelColorDropdown(inst);
        });
    });

    inst._onLabelDocumentClick = (e) => {
        if (inst._labelColorContainer && !inst._labelColorContainer.contains(e.target)) {
            hideLabelColorDropdown(inst);
        }
    };
    document.addEventListener('click', inst._onLabelDocumentClick);

    // ── Label: размер шрифта (степпер) ───────────────────────────────────────

    const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

    if (inst._labelSizeDown) {
        inst._labelSizeDown.addEventListener('click', () => {
            const connector = inst._getConnector();
            const existing  = connector?.properties?.style?.label;
            if (!existing) return;
            const cur  = existing.fontSize ?? 14;
            const next = FONT_SIZES.slice().reverse().find(s => s < cur) ?? FONT_SIZES[0];
            inst._emitLabel({ ...existing, fontSize: next });
        });
    }

    if (inst._labelSizeUp) {
        inst._labelSizeUp.addEventListener('click', () => {
            const connector = inst._getConnector();
            const existing  = connector?.properties?.style?.label;
            if (!existing) return;
            const cur  = existing.fontSize ?? 14;
            const next = FONT_SIZES.find(s => s > cur) ?? FONT_SIZES[FONT_SIZES.length - 1];
            inst._emitLabel({ ...existing, fontSize: next });
        });
    }

    inst._bindingsAttached = true;
}

export function unbindConnectorPropertiesPanelControls(inst) {
    if (inst._onStrokeDocumentClick) {
        document.removeEventListener('click', inst._onStrokeDocumentClick);
        inst._onStrokeDocumentClick = null;
    }
    if (inst._onLabelDocumentClick) {
        document.removeEventListener('click', inst._onLabelDocumentClick);
        inst._onLabelDocumentClick = null;
    }
    inst._bindingsAttached = false;
}
