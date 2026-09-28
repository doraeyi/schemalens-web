/**
 * 只放方言清單跟型別，輕量、可以直接 import。
 * 實際的匯出（`@schemalens/schema-sql/export`）跟匯入（`@schemalens/schema-sql/import`，
 * 會載入 node-sql-parser）分成獨立進入點，呼叫端可以用動態 import 延後載入。
 */
export { SQL_DIALECTS, type SqlDialectId, type SqlDialectInfo } from "./export/types.js";
