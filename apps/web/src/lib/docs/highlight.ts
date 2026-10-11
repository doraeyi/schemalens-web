/**
 * /docs 範例用的極簡語法上色（dbschema / sql / markdown）。只分關鍵字、標記、字串、註解、數字、
 * 箭頭幾類，夠讀就好；輸出前一律先 escape，所以可以安全地丟進 {@html}。
 */
export type HighlightLang = 'dbschema' | 'sql' | 'markdown';

const DSL_KEYWORDS = ['table', 'relation', 'index', 'unique', 'group', 'in', 'on', 'not', 'null', 'default'];
const SQL_KEYWORDS = [
	'create', 'table', 'primary', 'key', 'references', 'foreign', 'not', 'null', 'unique', 'default', 'constraint', 'index', 'on'
];
const DSL_FLAGS = ['PK', 'FK', 'UQ', 'IDX'];

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrap(kind: string, text: string): string {
	return `<span class="tk-${kind}">${escapeHtml(text)}</span>`;
}

export function highlight(source: string, lang: HighlightLang): string {
	if (lang === 'markdown') {
		// Markdown 裡只上色內嵌的 ```dbschema 區塊，其餘照原樣。
		return source
			.split(/(```dbschema\n[\s\S]*?\n```)/)
			.map((part) => {
				const match = part.match(/^```dbschema\n([\s\S]*?)\n```$/);
				if (!match) return part.split('\n').map((line) => (line.startsWith('#') ? wrap('kw', line) : escapeHtml(line))).join('\n');
				return `${wrap('com', '```dbschema')}\n${highlight(match[1], 'dbschema')}\n${wrap('com', '```')}`;
			})
			.join('');
	}

	const keywords = new Set(lang === 'sql' ? SQL_KEYWORDS : DSL_KEYWORDS);
	const comment = lang === 'sql' ? '--[^\\n]*' : '\\/\\/[^\\n]*';
	const token = new RegExp(`(${comment})|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|(->)|(\\b\\d+\\b)|([A-Za-z_][A-Za-z0-9_]*)`, 'g');

	let out = '';
	let last = 0;
	for (const m of source.matchAll(token)) {
		out += escapeHtml(source.slice(last, m.index));
		const [text, com, str, arrow, num, word] = m;
		if (com) out += wrap('com', text);
		else if (str) out += wrap('str', text);
		else if (arrow) out += wrap('op', text);
		else if (num) out += wrap('num', text);
		else if (word && lang === 'dbschema' && DSL_FLAGS.includes(word)) out += wrap('flag', text);
		else if (word && lang === 'dbschema' && (word === 'N' || word === 'M')) out += wrap('num', text);
		else if (word && keywords.has(word.toLowerCase())) out += wrap('kw', text);
		else out += escapeHtml(text);
		last = m.index! + text.length;
	}
	return out + escapeHtml(source.slice(last));
}
