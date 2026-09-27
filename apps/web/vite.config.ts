import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// 內建的跨站表單檢查整個關掉，改由 src/hooks.server.ts 的 csrfGuard 做同樣的檢查——
			// OAuth token 端點（/oauth/token）依規範只收表單格式，而且是 claude.ai／ChatGPT 從它們
			// 自己的伺服器打過來的（沒有 Origin），內建檢查沒辦法只放行單一路由。
			csrf: { trustedOrigins: ['*'] }
		})
	]
});
