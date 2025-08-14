/**
 * SelectionModel — хранит и управляет текущим набором выбранных объектов
 */
export class SelectionModel {
    constructor() {
        this._ids = new Set();
    }

    clear() { this._ids.clear(); }
    add(id) { if (id) this._ids.add(id); }
    addMany(ids = []) { ids.forEach((id) => this.add(id)); }
    remove(id) { this._ids.delete(id); }
    toggle(id) { if (this._ids.has(id)) this._ids.delete(id); else this._ids.add(id); }
    has(id) { return this._ids.has(id); }
    size() { return this._ids.size; }
    toArray() { return Array.from(this._ids); }

    /**
     * Вычисляет групповые границы по getBounds() каждого PIXI-объекта
     * @param {(id:string)=>PIXI.DisplayObject|null} getPixiById
     * @returns {{x:number,y:number,width:number,height:number}|null}
     */
    computeBounds(getPixiById) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let any = false;
        for (const id of this._ids) {
            const pixi = getPixiById ? getPixiById(id) : null;
            if (!pixi || !pixi.getBounds) continue;
            const b = pixi.getBounds();
            if (!b) continue;
            any = true;
            if (b.x < minX) minX = b.x;
            if (b.y < minY) minY = b.y;
            if (b.x + b.width > maxX) maxX = b.x + b.width;
            if (b.y + b.height > maxY) maxY = b.y + b.height;
        }
        if (!any) return null;
        return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
    }
}


