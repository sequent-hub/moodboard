// Единый реестр названий событий EventBus

export const Events = {
	Tool: {
		Activated: 'tool:activated',
		Deactivated: 'tool:deactivated',
		ContextMenuShow: 'tool:context:menu:show',
		SelectionAdd: 'tool:selection:add',
		SelectionClear: 'tool:selection:clear',
		HitTest: 'tool:hit:test',
		GetSelection: 'tool:get:selection',
		GetAllObjects: 'tool:get:all:objects',
		GetObjectPosition: 'tool:get:object:position',
		GetObjectSize: 'tool:get:object:size',
		GetObjectRotation: 'tool:get:object:rotation',
		DragStart: 'tool:drag:start',
		DragUpdate: 'tool:drag:update',
		DragEnd: 'tool:drag:end',
		GroupDragStart: 'tool:group:drag:start',
		GroupDragUpdate: 'tool:group:drag:update',
		GroupDragEnd: 'tool:group:drag:end',
		ResizeStart: 'tool:resize:start',
		ResizeUpdate: 'tool:resize:update',
		ResizeEnd: 'tool:resize:end',
		GroupResizeStart: 'tool:group:resize:start',
		GroupResizeUpdate: 'tool:group:resize:update',
		GroupResizeEnd: 'tool:group:resize:end',
		RotateUpdate: 'tool:rotate:update',
		RotateEnd: 'tool:rotate:end',
		GroupRotateStart: 'tool:group:rotate:start',
		GroupRotateUpdate: 'tool:group:rotate:update',
		GroupRotateEnd: 'tool:group:rotate:end',
		DuplicateRequest: 'tool:duplicate:request',
		DuplicateReady: 'tool:duplicate:ready',
		GroupDuplicateRequest: 'tool:group:duplicate:request',
		GroupDuplicateReady: 'tool:group:duplicate:ready',
		PanUpdate: 'tool:pan:update',
		WheelZoom: 'tool:wheel:zoom',
	},

	UI: {
		ToolbarAction: 'toolbar:action',
		UpdateHistoryButtons: 'ui:update-history-buttons',
		ContextMenuShow: 'ui:contextmenu:show',
		GridChange: 'ui:grid:change',
		GridCurrent: 'ui:grid:current',
		ZoomIn: 'ui:zoom:in',
		ZoomOut: 'ui:zoom:out',
		ZoomReset: 'ui:zoom:reset',
		ZoomFit: 'ui:zoom:fit',
		ZoomSelection: 'ui:zoom:selection',
		ZoomPercent: 'ui:zoom:percent',
		MinimapGetData: 'ui:minimap:get-data',
		MinimapCenterOn: 'ui:minimap:center-on',
		LayerBringToFront: 'ui:layer:bring-to-front',
		LayerBringForward: 'ui:layer:bring-forward',
		LayerSendBackward: 'ui:layer:send-backward',
		LayerSendToBack: 'ui:layer:send-to-back',
		LayerGroupBringToFront: 'ui:layer-group:bring-to-front',
		LayerGroupBringForward: 'ui:layer-group:bring-forward',
		LayerGroupSendBackward: 'ui:layer-group:send-backward',
		LayerGroupSendToBack: 'ui:layer-group:send-to-back',
	},

	Keyboard: {
		KeyUp: 'keyboard:keyup',
		SelectAll: 'keyboard:select-all',
		Delete: 'keyboard:delete',
		Escape: 'keyboard:escape',
		ToolSelect: 'keyboard:tool-select',
		Move: 'keyboard:move',
		Copy: 'keyboard:copy',
		Paste: 'keyboard:paste',
		Undo: 'keyboard:undo',
		Redo: 'keyboard:redo',
	},

	Object: {
		Created: 'object:created',
		Updated: 'object:updated',
		Deleted: 'object:deleted',
		Rotate: 'object:rotate',
		TransformUpdated: 'object:transform:updated',
		Reordered: 'object:reordered',
		Pasted: 'object:pasted',
		StateChanged: 'state:changed',
	},

	History: {
		Changed: 'history:changed',
		Debug: 'history:debug',
	},

	Save: {
		GetBoardData: 'save:get-board-data',
		StatusChanged: 'save:status-changed',
		Success: 'save:success',
		Error: 'save:error',
	},

	Grid: {
		BoardDataChanged: 'board:data-changed',
	},

	Place: {
		Set: 'place:set',
	},

	Draw: {
		BrushSet: 'draw:brush:set',
	},
};


