import type { ViewState } from '@schemalens/schema-renderer';

const STORAGE_KEY = 'schemalens:draft:v1';

export interface DraftPayload {
	fileName: string;
	source: string;
	viewState?: SerializableViewState;
}

/** ViewState holds Sets, which don't survive JSON.stringify as-is. */
type SerializableViewState = Omit<ViewState, 'collapsed' | 'searchMatches'> & {
	collapsed: string[];
	searchMatches: string[];
};

export function toSerializable(state: ViewState): SerializableViewState {
	return {
		...state,
		collapsed: [...state.collapsed],
		searchMatches: [...state.searchMatches]
	};
}

export function fromSerializable(state: SerializableViewState): ViewState {
	return {
		...state,
		collapsed: new Set(state.collapsed),
		searchMatches: new Set(state.searchMatches)
	};
}

export function saveDraft(payload: DraftPayload): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	} catch {
		// storage full / private mode — the draft simply won't persist this time
	}
}

export function loadDraft(): DraftPayload | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as DraftPayload;
	} catch {
		return null;
	}
}

export function clearDraft(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
