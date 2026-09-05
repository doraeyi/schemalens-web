<script lang="ts">
	import { groupNames, type Schema } from '@schemalens/schema-core';
	import { search, type SearchHit } from '@schemalens/schema-graph';
	import { groupColor } from '@schemalens/schema-renderer';
	import { Search as SearchIcon } from '@lucide/svelte';

	interface Props {
		schema: Schema | null;
		hiddenGroups: ReadonlySet<string>;
		onToggleGroup: (name: string) => void;
		onPickHit: (hit: SearchHit) => void;
		onSearchResults: (hits: SearchHit[]) => void;
	}

	let { schema, hiddenGroups, onToggleGroup, onPickHit, onSearchResults }: Props = $props();

	let query = $state('');
	let searchInput: HTMLInputElement | undefined = $state();
	let debounceHandle: ReturnType<typeof setTimeout> | undefined;

	export function focusSearch(): void {
		searchInput?.focus();
		searchInput?.select();
	}

	function runSearch(value: string): void {
		if (!schema || !value.trim()) {
			onSearchResults([]);
			return;
		}
		onSearchResults(search(schema, value, 60));
	}

	function handleInput(): void {
		clearTimeout(debounceHandle);
		debounceHandle = setTimeout(() => runSearch(query), 80);
	}

	const groups = $derived.by(() => {
		if (!schema) return [];
		const names = groupNames(schema);
		return names.map((name) => ({
			name,
			count: schema.tables.filter((t) => t.group === name).length,
			description: schema.groups?.find((g) => g.name === name)?.description
		}));
	});
</script>

<div class="flex h-full w-72 flex-none flex-col border-r border-border bg-surface/60 text-xs text-fg">
	<div class="border-b border-border p-4">
		<div class="mb-2 font-semibold">搜尋資料表</div>
		<div class="flex items-center gap-1.5 rounded-md border border-border bg-bg/60 px-2 py-1.5">
			<SearchIcon size={13} class="text-muted" />
			<input
				bind:this={searchInput}
				bind:value={query}
				oninput={handleInput}
				type="search"
				placeholder="表名 / 關鍵字…"
				class="w-full bg-transparent text-xs text-fg placeholder:text-muted focus:outline-none"
			/>
		</div>
	</div>

	<div class="flex-1 overflow-auto p-4">
		<div class="mb-2 font-semibold">責任區（點擊顯示/隱藏）</div>
		<div class="flex flex-col gap-1">
			{#each groups as group (group.name)}
				<button
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-2 {hiddenGroups.has(
						group.name
					)
						? 'opacity-40'
						: ''}"
					onclick={() => onToggleGroup(group.name)}
					title={group.description ?? group.name}
				>
					<span
						class="h-2.5 w-2.5 flex-none rounded-full"
						style:background={groupColor(group.name)}
					></span>
					<span class="flex-1 truncate">{group.name}</span>
					<span class="text-muted">{group.count}</span>
				</button>
			{/each}
			{#if groups.length === 0}
				<div class="text-muted">這份 schema 沒有分組</div>
			{/if}
		</div>

		<div class="mt-6 mb-2 font-semibold">關聯線型</div>
		<div class="flex items-center gap-2 px-2 text-muted">
			<span class="inline-block h-px w-6 bg-muted"></span> 資料表關聯（外鍵）
		</div>
	</div>

	{#if schema}
		<div class="border-t border-border p-4">
			<div class="flex gap-6">
				<div>
					<div class="text-lg font-bold text-cyan">{schema.tables.length}</div>
					<div class="text-muted">資料表</div>
				</div>
				<div>
					<div class="text-lg font-bold text-violet">{schema.relations.length}</div>
					<div class="text-muted">關聯</div>
				</div>
			</div>
		</div>
	{/if}
</div>
