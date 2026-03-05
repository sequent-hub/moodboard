export class ToolbarTooltipController {
    constructor(toolbar) {
        this.toolbar = toolbar;
    }

    createTooltip(button, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'moodboard-tooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);

        let showTimeout;
        let hideTimeout;

        button.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            showTimeout = setTimeout(() => {
                this.showTooltip(tooltip, button);
            }, 300);
        });

        button.addEventListener('mouseleave', () => {
            clearTimeout(showTimeout);
            hideTimeout = setTimeout(() => {
                this.hideTooltip(tooltip);
            }, 100);
        });

        button.addEventListener('click', () => {
            clearTimeout(showTimeout);
            this.hideTooltip(tooltip);
        });

        button._tooltip = tooltip;
    }

    showTooltip(tooltip, button) {
        const buttonRect = button.getBoundingClientRect();
        const left = buttonRect.right + 8;
        const top = buttonRect.top + (buttonRect.height / 2) - (tooltip.offsetHeight / 2);
        const maxLeft = window.innerWidth - tooltip.offsetWidth - 8;
        const adjustedLeft = Math.min(left, maxLeft);

        tooltip.style.left = `${adjustedLeft}px`;
        tooltip.style.top = `${top}px`;
        tooltip.classList.add('moodboard-tooltip--show');
    }

    hideTooltip(tooltip) {
        tooltip.classList.remove('moodboard-tooltip--show');
    }
}
