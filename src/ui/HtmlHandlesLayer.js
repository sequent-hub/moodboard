import rotateIconSvg from '../assets/icons/rotate-icon.svg?raw';
import { HandlesDomRenderer } from './handles/HandlesDomRenderer.js';
import { HandlesPositioningService } from './handles/HandlesPositioningService.js';
import { HandlesEventBridge } from './handles/HandlesEventBridge.js';
import { SingleSelectionHandlesController } from './handles/SingleSelectionHandlesController.js';
import { GroupSelectionHandlesController } from './handles/GroupSelectionHandlesController.js';
import { HandlesInteractionController } from './handles/HandlesInteractionController.js';

/**
 * HtmlHandlesLayer — HTML-ручки и рамка для выделенных объектов.
 * 
 * ✅ АКТИВНО ИСПОЛЬЗУЕТСЯ ✅
 * Это основная система ручек ресайза в приложении.
 * Показывает ручки для одного объекта или группы, синхронизирует с worldLayer.
 * Эмитит те же события, что и Pixi ResizeHandles через EventBus.
 * 
 * Альтернатива: ResizeHandles.js (PIXI-ручки, в данный момент не используются)
 */
export class HtmlHandlesLayer {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.layer = null;
        this.visible = false;
        this.target = { type: 'none', id: null, bounds: null };
        this.handles = {};
        this._drag = null;
      this._handlesSuppressed = false; // скрывать ручки во время перетаскивания/трансформаций
        this._groupRotationPreview = null;

      // Ссылки на обработчики, чтобы корректно отписаться при destroy()
      this._onWindowResize = null;
      this._onDprChange = null;
      this._dprMediaQuery = null;
      this.positioningService = new HandlesPositioningService(this);
      this.domRenderer = new HandlesDomRenderer(this, rotateIconSvg);
      this.eventBridge = new HandlesEventBridge(this);
      this.singleSelectionController = new SingleSelectionHandlesController(this);
      this.groupSelectionController = new GroupSelectionHandlesController(this);
      this.interactionController = new HandlesInteractionController(this);
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'moodboard-html-handles';
        this.container.appendChild(this.layer);

        // Обновление при изменении размеров окна/масштаба (DPR)
      this._onWindowResize = () => this.update();
      window.addEventListener('resize', this._onWindowResize, { passive: true });
        // Некоторые браузеры меняют devicePixelRatio без resize — страхуемся
        if (typeof window !== 'undefined' && 'matchMedia' in window) {
            try {
                // media-query, реагирующая на изменение DPR
          const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
          this._dprMediaQuery = mq;
          this._onDprChange = () => this.update();
          if (mq && mq.addEventListener) {
            mq.addEventListener('change', this._onDprChange);
          } else if (mq && mq.addListener) {
            mq.addListener(this._onDprChange);
                }
            } catch (_) {}
        }

        this.eventBridge.attach();

        this.update();
    }

    destroy() {
      // Отписываемся от глобальных событий окна/DPR,
      // чтобы старые инстансы не продолжали реагировать после destroy()
      if (this._onWindowResize) {
        window.removeEventListener('resize', this._onWindowResize);
        this._onWindowResize = null;
      }
      if (this._dprMediaQuery && this._onDprChange) {
        try {
          if (this._dprMediaQuery.removeEventListener) {
            this._dprMediaQuery.removeEventListener('change', this._onDprChange);
          } else if (this._dprMediaQuery.removeListener) {
            this._dprMediaQuery.removeListener(this._onDprChange);
          }
        } catch (_) {}
        this._dprMediaQuery = null;
        this._onDprChange = null;
      }
      this.eventBridge.detach();

      if (this.layer) {
        this.layer.remove();
      }
      this.layer = null;
    }

    update() {
      // Дополнительная защита: если слой или core уже уничтожены,
      // выходим, чтобы не получить ошибок при resize/смене DPR
      if (!this.core || !this.core.pixi || !this.core.pixi.app || !this.layer) return;
        const selectTool = this.core?.selectTool;
        const ids = selectTool ? Array.from(selectTool.selectedObjects || []) : [];
        if (!ids || ids.length === 0) { this.hide(); return; }
        if (ids.length === 1) {
            this.singleSelectionController.renderForSelection(ids[0]);
        } else {
            this.groupSelectionController.renderForSelection(ids);
        }
    }

    hide() {
        if (!this.layer) return;
        this.layer.innerHTML = '';
        this.visible = false;
    }

    _setHandlesVisibility(show) {
        this.domRenderer.setHandlesVisibility(show);
    }

    _showBounds(worldBounds, id, options = {}) {
        this.domRenderer.showBounds(worldBounds, id, options);
    }

    _toWorldScreenInverse(dx, dy) {
        return this.positioningService.toWorldScreenInverse(dx, dy);
    }

    _onHandleDown(e, box) {
        this.interactionController.onHandleDown(e, box);
    }

    _onEdgeResizeDown(e) {
        this.interactionController.onEdgeResizeDown(e);
    }

    _onRotateHandleDown(e, box) {
        this.interactionController.onRotateHandleDown(e, box);
    }

    _repositionBoxChildren(box) {
        this.domRenderer.repositionBoxChildren(box);
    }

    _startGroupRotationPreview(payload = {}) {
        const selectTool = this.core?.selectTool;
        const ids = Array.from(selectTool?.selectedObjects || []);
        if (ids.length <= 1) {
            this._groupRotationPreview = null;
            return;
        }
        const prevPreview = this._groupRotationPreview;
        const hasSameSelection = Boolean(
            prevPreview &&
            Array.isArray(prevPreview.ids) &&
            prevPreview.ids.length === ids.length &&
            ids.every((id) => prevPreview.ids.includes(id))
        );
        const measuredBounds = this.positioningService.getGroupSelectionWorldBounds(ids);
        const startBounds = hasSameSelection
            ? prevPreview.startBounds
            : measuredBounds;
        if (!startBounds) {
            this._groupRotationPreview = null;
            return;
        }
        const baseAngle = hasSameSelection ? (prevPreview.angle || 0) : 0;
        const previewCenter = payload.center
            ? { ...payload.center }
            : hasSameSelection && prevPreview.center
                ? { ...prevPreview.center }
                : {
                    x: startBounds.x + startBounds.width / 2,
                    y: startBounds.y + startBounds.height / 2,
                };
        this._groupRotationPreview = {
            ids,
            center: previewCenter,
            startBounds,
            angle: baseAngle,
            baseAngle,
            isActive: true,
            lastMeasuredCenter: {
                x: measuredBounds ? measuredBounds.x + measuredBounds.width / 2 : previewCenter.x,
                y: measuredBounds ? measuredBounds.y + measuredBounds.height / 2 : previewCenter.y,
            },
        };
    }

    _updateGroupRotationPreview(payload = {}) {
        if (!this._groupRotationPreview) return;
        this._groupRotationPreview.angle = (this._groupRotationPreview.baseAngle || 0) + (payload.angle || 0);
    }

    _finishGroupRotationPreview() {
        if (!this._groupRotationPreview) return;
        this._groupRotationPreview.isActive = false;
        const liveBounds = this.positioningService.getGroupSelectionWorldBounds(this._groupRotationPreview.ids);
        if (!liveBounds) return;
        this._groupRotationPreview.lastMeasuredCenter = {
            x: liveBounds.x + liveBounds.width / 2,
            y: liveBounds.y + liveBounds.height / 2,
        };
    }

    _syncGroupRotationPreviewTranslation() {
        if (!this._groupRotationPreview || this._groupRotationPreview.isActive) return;
        const liveBounds = this.positioningService.getGroupSelectionWorldBounds(this._groupRotationPreview.ids);
        if (!liveBounds) return;
        const liveCenter = {
            x: liveBounds.x + liveBounds.width / 2,
            y: liveBounds.y + liveBounds.height / 2,
        };
        const prevCenter = this._groupRotationPreview.lastMeasuredCenter;
        if (prevCenter) {
            this._groupRotationPreview.center.x += liveCenter.x - prevCenter.x;
            this._groupRotationPreview.center.y += liveCenter.y - prevCenter.y;
        }
        this._groupRotationPreview.lastMeasuredCenter = liveCenter;
    }

    _endGroupRotationPreview() {
        this._groupRotationPreview = null;
    }
}


