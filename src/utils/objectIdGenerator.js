/**
 * Генератор уникальных ID для объектов доски
 * Принимает опциональную функцию existsFn(id) для проверки коллизий
 */
export function generateObjectId(existsFn = null) {
    const makeId = () => 'obj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    let candidate = makeId();
    if (typeof existsFn === 'function') {
        // Проверяем коллизии (важно при массовой вставке в один тик)
        while (existsFn(candidate)) {
            candidate = makeId();
        }
    }
    return candidate;
}


