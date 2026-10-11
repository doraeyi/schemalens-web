import { describe, expect, it } from "vitest";
import { highlight } from "../src/lib/docs/highlight";

describe("docs highlight", () => {
  it("escapes HTML before wrapping tokens (output goes into {@html})", () => {
    const out = highlight('table <img src=x onerror=alert(1)> { "</span><script>" }', "dbschema");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;img");
  });

  it("marks DSL keywords, flags, arrows and comments", () => {
    const out = highlight("// note\ntable Users {\n  PK Id bigint not null\n}\nrelation R {\n  A.B N -> 1 C.D\n}", "dbschema");
    expect(out).toContain('<span class="tk-com">// note</span>');
    expect(out).toContain('<span class="tk-kw">table</span>');
    expect(out).toContain('<span class="tk-flag">PK</span>');
    expect(out).toContain('<span class="tk-op">-&gt;</span>');
  });

  it("is case-insensitive for SQL keywords", () => {
    const out = highlight("create TABLE t (id bigint PRIMARY KEY);", "sql");
    expect(out).toContain('<span class="tk-kw">create</span>');
    expect(out).toContain('<span class="tk-kw">TABLE</span>');
  });
});
