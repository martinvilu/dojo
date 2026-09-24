import { describe, it } from "node:test";
import assert from "node:assert";
import { renderMarkdown, isSafeHref } from "../../src/lib/markdown.ts";

describe("src/lib/markdown", () => {
  it("renders regular markdown", () => {
    const html = renderMarkdown("# Clase 1\n\n**Tema**: [apuntes](https://example.com/a.pdf)");
    assert.ok(html.includes("<h1>Clase 1</h1>"));
    assert.ok(html.includes("<strong>Tema</strong>"));
    assert.ok(html.includes('<a href="https://example.com/a.pdf" target="_blank" rel="noopener noreferrer nofollow">apuntes</a>'));
  });

  it("escapes raw HTML blocks and inline tags", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">\n\nHola <script>alert(1)</script>');
    assert.ok(!html.includes("<img"));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;img"));
  });

  it("drops dangerous link schemes, including entity-encoded ones", () => {
    for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "javascript&#58;alert(1)", "data:text/html,<b>x</b>", "vbscript:msgbox(1)"]) {
      const html = renderMarkdown(`[clic](${href})`);
      assert.ok(!html.includes("<a"), `link rendered for ${href}: ${html}`);
      assert.ok(html.includes("clic"));
    }
  });

  it("keeps relative, anchor and mailto links", () => {
    assert.strictEqual(isSafeHref("/dashboard"), true);
    assert.strictEqual(isSafeHref("#tp1"), true);
    assert.strictEqual(isSafeHref("mailto:docente@unrn.edu.ar"), true);
  });

  it("only renders http(s) images", () => {
    assert.ok(renderMarkdown("![diagrama](https://example.com/d.png)").includes('<img src="https://example.com/d.png" alt="diagrama"'));
    assert.ok(!renderMarkdown("![x](javascript:alert(1))").includes("<img"));
    assert.ok(!renderMarkdown("![x](data:image/svg+xml,<svg onload=alert(1)>)").includes("<img"));
  });

  it("escapes attribute values", () => {
    const html = renderMarkdown('[a](https://example.com/"onmouseover="alert(1) "t\\"itle")');
    assert.ok(!html.includes('"onmouseover="'));
  });

  it("handles empty input", () => {
    assert.strictEqual(renderMarkdown(undefined), "");
    assert.strictEqual(renderMarkdown(null), "");
  });
});
