export interface SplitStatement {
	text: string;
	/** 1-based，這條敘述在原始文字裡大約從哪一行開始（有前導空白/註解時可能差一兩行，best-effort）。 */
	startLine: number;
}

/**
 * node-sql-parser 對一整段文字裡任何一處解析失敗，會讓整段全部失敗
 * （不是「這條敘述跳過、其餘照常」），所以匯入這邊自己先把原始 SQL 切成
 * 一條條獨立敘述，每條各自丟給 parser——這樣某條敘述解析失敗
 * （例如目前這個套件版本無法解析 T-SQL 外鍵）只會讓那一條變成診斷，
 * 不會連累其他敘述。
 *
 * 只用一個以括號深度為主、對字串/識別字引號跟註解做基本跳脫的掃描器，
 * 不是完整的 SQL 詞法分析器——目標是「能正確切開常見的人手寫 DDL」，
 * 不保證能處理每一種極端寫法。
 */
export function splitSqlStatements(source: string): SplitStatement[] {
	const statements: SplitStatement[] = [];
	const n = source.length;
	let current = '';
	let currentStart = 0;
	let depth = 0;
	let i = 0;

	const flush = (): void => {
		if (current.trim().length > 0) {
			const startLine = source.slice(0, currentStart).split('\n').length;
			statements.push({ text: current, startLine });
		}
		current = '';
	};

	while (i < n) {
		const ch = source[i];

		if (ch === '-' && source[i + 1] === '-') {
			const end = source.indexOf('\n', i);
			const stop = end === -1 ? n : end;
			current += source.slice(i, stop);
			i = stop;
			continue;
		}
		if (ch === '/' && source[i + 1] === '*') {
			const end = source.indexOf('*/', i + 2);
			const stop = end === -1 ? n : end + 2;
			current += source.slice(i, stop);
			i = stop;
			continue;
		}
		if (ch === "'" || ch === '"' || ch === '`') {
			const quote = ch;
			let j = i + 1;
			while (j < n) {
				if (source[j] === quote) {
					if (source[j + 1] === quote) {
						j += 2;
						continue;
					}
					j++;
					break;
				}
				j++;
			}
			current += source.slice(i, j);
			i = j;
			continue;
		}
		if (ch === '[') {
			let j = i + 1;
			while (j < n && source[j] !== ']') j++;
			j = Math.min(j + 1, n);
			current += source.slice(i, j);
			i = j;
			continue;
		}

		if (ch === '(') depth++;
		else if (ch === ')') depth = Math.max(0, depth - 1);

		if (ch === ';' && depth === 0) {
			current += ch;
			flush();
			i++;
			currentStart = i;
			continue;
		}

		current += ch;
		i++;
	}
	flush();
	return statements;
}
