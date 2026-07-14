import { describe, expect, it } from "vitest";

import { renderDrawsyMarkdownHtml } from "./DrawsyMarkdown";

describe("DrawsyMarkdown", () => {
  it("renders rich Markdown and LaTeX", () => {
    const html = renderDrawsyMarkdownHtml(`## Result

**Bold** with \`inline code\` and $x^2$.

| A | B |
| - | - |
| 1 | 2 |

\`\`\`ts
const value = 2;
\`\`\``);

    expect(html).toContain("<h2>Result</h2>");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<table>");
    expect(html).toContain("language-ts");
    expect(html).toContain("katex");
  });

  it("sanitizes unsafe response markup", () => {
    const unsafeProtocol = ["java", "script:alert(1)"].join("");
    const html = renderDrawsyMarkdownHtml(
      `<script>alert(1)</script><img src="x" onerror="alert(1)">[bad](${unsafeProtocol})`,
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelector("a")?.getAttribute("href")).not.toBe(
      unsafeProtocol,
    );
  });
});
