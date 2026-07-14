import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import DOMPurify from "dompurify";
import katex from "katex";
import { marked } from "marked";
import { useEffect, useMemo, useRef, type MouseEvent } from "react";

import "katex/dist/katex.min.css";

const renderMath = (expression: string, displayMode: boolean) => {
  try {
    return katex.renderToString(expression.trim(), {
      displayMode,
      output: "htmlAndMathml",
      strict: "ignore",
      throwOnError: false,
    });
  } catch {
    return expression;
  }
};

const protectCode = (source: string) => {
  const code: string[] = [];
  const text = source.replace(
    /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`+[^`\n]*`+)/g,
    (match) => {
      const token = `DRAWSY_CODE_TOKEN_${code.length}_END`;
      code.push(match);
      return token;
    },
  );
  return {
    text,
    restore: (value: string) =>
      code.reduce(
        (result, block, index) =>
          result.replace(`DRAWSY_CODE_TOKEN_${index}_END`, block),
        value,
      ),
  };
};

export const renderDrawsyMarkdownHtml = (source: string) => {
  const protectedCode = protectCode(source);
  const withDisplayMath = protectedCode.text.replace(
    /\$\$([\s\S]+?)\$\$/g,
    (_, expression: string) =>
      `<div class="drawsy-ai-chat__math drawsy-ai-chat__math--display">${renderMath(
        expression,
        true,
      )}</div>`,
  );
  const withBracketMath = withDisplayMath.replace(
    /\\\[([\s\S]+?)\\\]/g,
    (_, expression: string) =>
      `<div class="drawsy-ai-chat__math drawsy-ai-chat__math--display">${renderMath(
        expression,
        true,
      )}</div>`,
  );
  const withParenthesisMath = withBracketMath.replace(
    /\\\((.+?)\\\)/g,
    (_, expression: string) =>
      `<span class="drawsy-ai-chat__math">${renderMath(
        expression,
        false,
      )}</span>`,
  );
  const withMath = withParenthesisMath.replace(
    /(^|[^\\$])\$([^$\n]+?)\$(?!\d)/g,
    (_, prefix: string, expression: string) =>
      `${prefix}<span class="drawsy-ai-chat__math">${renderMath(
        expression,
        false,
      )}</span>`,
  );
  const parsed = marked.parse(protectedCode.restore(withMath), {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;
  const sanitized = DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
  });
  const template = document.createElement("template");
  template.innerHTML = sanitized;
  for (const link of template.content.querySelectorAll("a")) {
    link.target = "_blank";
    link.rel = "noreferrer noopener";
  }
  for (const image of template.content.querySelectorAll("img")) {
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
  }
  return template.innerHTML;
};

export const DrawsyMarkdown = ({
  children,
  copyCode = false,
}: {
  children: string;
  copyCode?: boolean;
}) => {
  const html = useMemo(() => renderDrawsyMarkdownHtml(children), [children]);
  const rootRef = useRef<HTMLDivElement>(null);
  const resetTimersRef = useRef(new Map<HTMLButtonElement, number>());

  useEffect(() => {
    if (!copyCode || !rootRef.current) {
      return;
    }
    const resetTimers = resetTimersRef.current;

    for (const block of rootRef.current.querySelectorAll("pre")) {
      const button = document.createElement("button");
      const label = document.createElement("span");
      block.classList.add("drawsy-ai-chat__code-block--copyable");
      button.type = "button";
      button.className = "drawsy-ai-chat__code-copy";
      button.dataset.drawsyCopyCode = "";
      button.setAttribute("aria-label", "Copy code");
      button.title = "Copy code";
      label.textContent = "Copy";
      button.append(label);
      block.prepend(button);
    }

    return () => {
      for (const timer of resetTimers.values()) {
        window.clearTimeout(timer);
      }
      resetTimers.clear();
    };
  }, [copyCode, html]);

  const copyCodeBlock = async (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest<HTMLButtonElement>(
      "[data-drawsy-copy-code]",
    );
    const code = button?.parentElement?.querySelector("code");
    if (!button || !code || !rootRef.current?.contains(button)) {
      return;
    }

    try {
      await copyTextToSystemClipboard(code.textContent || "");
      button.dataset.copied = "true";
      button.setAttribute("aria-label", "Code copied");
      button.title = "Copied";
      const label = button.querySelector("span");
      if (label) {
        label.textContent = "Copied";
      }
      const currentTimer = resetTimersRef.current.get(button);
      if (currentTimer) {
        window.clearTimeout(currentTimer);
      }
      resetTimersRef.current.set(
        button,
        window.setTimeout(() => {
          button.removeAttribute("data-copied");
          button.setAttribute("aria-label", "Copy code");
          button.title = "Copy code";
          if (label) {
            label.textContent = "Copy";
          }
          resetTimersRef.current.delete(button);
        }, 1600),
      );
    } catch {
      button.removeAttribute("data-copied");
    }
  };

  return (
    <div
      ref={rootRef}
      className="drawsy-ai-chat__markdown"
      onClick={(event) => void copyCodeBlock(event)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
