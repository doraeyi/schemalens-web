<script lang="ts">
	/**
	 * SchemaLens 標誌：鏡片裡框著兩張資料表卡片和一條關聯線——「用鏡頭看清表之間的關係」。
	 * 深色底塊在淺色、深色主題都成立，16px（favicon）時仍讀得出鏡片輪廓。
	 * 同一個圖形也存成 static/favicon.svg，改這裡要一起改那邊。
	 */
	interface Props {
		size?: number;
		wordmark?: boolean;
		class?: string;
	}

	let { size = 28, wordmark = true, class: className = '' }: Props = $props();
</script>

<span class="sl-logo {className}">
	<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden={wordmark ? 'true' : undefined} role={wordmark ? undefined : 'img'} aria-label={wordmark ? undefined : 'SchemaLens'}>
		<rect width="64" height="64" rx="15" fill="#0e1b33" />
		<rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.5" />
		<rect x="16" y="18" width="10" height="7" rx="1.8" fill="#4ea1ff" />
		<rect x="27" y="29" width="10" height="7" rx="1.8" fill="#ffffff" />
		<path d="M21 25v5.5a2 2 0 0 0 2 2h4" fill="none" stroke="#4ea1ff" stroke-width="2.2" stroke-linecap="round" />
		<circle cx="27" cy="27" r="15.5" fill="none" stroke="#ffffff" stroke-width="4" />
		<path d="M39 39l10.5 10.5" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
	</svg>
	{#if wordmark}
		<span class="sl-logo-word">SchemaLens</span>
	{/if}
</span>

<style>
	.sl-logo {
		display: inline-flex;
		align-items: center;
		gap: 9px;
	}
	.sl-logo svg {
		flex: none;
		border-radius: 24%;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.18);
	}
	.sl-logo-word {
		font-size: 15px;
		font-weight: 650;
		letter-spacing: -0.02em;
		color: var(--sl-fg);
	}
</style>
