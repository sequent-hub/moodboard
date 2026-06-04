export function pluralize(n, one, two, five) {
    const m = Math.abs(n) % 100;
    const m1 = m % 10;
    if (m >= 11 && m <= 19) return five;
    if (m1 === 1) return one;
    if (m1 >= 2 && m1 <= 4) return two;
    return five;
}

export function formatTime(iso) {
    try {
        const d = new Date(iso);
        const diffMs = Date.now() - d.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'только что';
        if (diffMin < 60) return `${diffMin} ${pluralize(diffMin, 'минуту', 'минуты', 'минут')} назад`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH} ${pluralize(diffH, 'час', 'часа', 'часов')} назад`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 8) return `${diffD} ${pluralize(diffD, 'день', 'дня', 'дней')} назад`;
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    } catch (_) {
        return '';
    }
}

export function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || '').trim();
}
