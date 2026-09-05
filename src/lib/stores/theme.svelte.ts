export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'schemalens:theme';

let theme = $state<Theme>('dark');

function apply(next: Theme): void {
	theme = next;
	if (typeof document !== 'undefined') {
		document.documentElement.dataset.theme = next;
	}
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// ignore write failures (private mode / storage full)
		}
	}
}

export function initTheme(): void {
	if (typeof window === 'undefined') return;
	let stored: string | null = null;
	try {
		stored = localStorage.getItem(STORAGE_KEY);
	} catch {
		// ignore read failures
	}
	if (stored === 'dark' || stored === 'light') {
		apply(stored);
		return;
	}
	const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
	apply(prefersLight ? 'light' : 'dark');
}

export function toggleTheme(): void {
	apply(theme === 'dark' ? 'light' : 'dark');
}

export function setTheme(next: Theme): void {
	apply(next);
}

export function getTheme(): Theme {
	return theme;
}
