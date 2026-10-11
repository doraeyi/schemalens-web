import type { Action } from 'svelte/action';

const FOCUSABLE =
	'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let nextId = 0;

/** 目前開著的對話框，最後開的在最上面；Esc／Tab 只交給最上面那一個處理。 */
const stack: object[] = [];

/**
 * 套在對話框的遮罩層上：Esc 關閉、點遮罩關閉、Tab 留在對話框裡、關掉後焦點回到開啟它的按鈕。
 * 之前每個對話框都只能點 ✕ 或「取消」，鍵盤使用者按 Esc 完全沒反應。
 * 第一個子元素就是對話框本體，role / aria-modal / aria-labelledby 都補在它上面。
 */
export const modal: Action<HTMLElement, () => void> = (node, onClose) => {
	let close = onClose;
	const entry = {};
	stack.push(entry);
	const isTopmost = () => stack[stack.length - 1] === entry;
	const panel = node.firstElementChild as HTMLElement | null;
	const opener = document.activeElement as HTMLElement | null;

	if (panel) {
		panel.setAttribute('role', 'dialog');
		panel.setAttribute('aria-modal', 'true');
		const heading = panel.querySelector('h2');
		if (heading) {
			heading.id ||= `sl-dialog-title-${++nextId}`;
			panel.setAttribute('aria-labelledby', heading.id);
		}
		const autofocus = panel.querySelector<HTMLElement>('[data-autofocus]');
		(autofocus ?? panel.querySelector<HTMLElement>(FOCUSABLE))?.focus();
	}

	// 掛在 window 的 capture 階段：焦點不在對話框裡（例如點了一下說明文字）時 Esc 一樣有效，
	// 而且搶在工作區自己的 Esc（取消聚焦）之前處理，按一次 Esc 只關對話框。
	const handleKeydown = (event: KeyboardEvent) => {
		// 疊了兩層對話框（例如確認刪除開在別的對話框上）時，Esc 只關最上面那層。
		if (!isTopmost()) return;
		if (event.key === 'Escape') {
			event.stopImmediatePropagation();
			close();
			return;
		}
		if (event.key !== 'Tab' || !panel) return;
		const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};
	const handlePointerDown = (event: PointerEvent) => {
		if (event.target === node) close();
	};

	window.addEventListener('keydown', handleKeydown, true);
	node.addEventListener('pointerdown', handlePointerDown);

	return {
		update(next) {
			close = next;
		},
		destroy() {
			stack.splice(stack.indexOf(entry), 1);
			window.removeEventListener('keydown', handleKeydown, true);
			node.removeEventListener('pointerdown', handlePointerDown);
			if (opener?.isConnected) opener.focus();
		}
	};
};
