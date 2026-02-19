import { Component, markup, useRef } from "@odoo/owl";

const KEYWORDS =
  "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof new return super switch this throw try typeof var void while with yield let static enum await async args";

const TOKEN_REGEX = new RegExp(
  `(".*?"|'.*?'|\`.*?\`)|(\\/\\/.*$)|(\\b\\d+(?:\\.\\d+)?\\b)|\\b(${KEYWORDS.split(" ").join(
    "|"
  )})\\b`,
  "gm"
);

function escapeHTML(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightCode(code: string) {
  let lastIndex = 0;
  let html = "";

  let match;
  // Reset lastIndex just in case
  TOKEN_REGEX.lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(code)) !== null) {
    if (match.index > lastIndex) {
      html += escapeHTML(code.substring(lastIndex, match.index));
    }

    if (match[1]) {
      html += `<span class="o-ce-string">${escapeHTML(match[1])}</span>`;
    } else if (match[2]) {
      html += `<span class="o-ce-comment">${escapeHTML(match[2])}</span>`;
    } else if (match[3]) {
      html += `<span class="o-ce-number">${escapeHTML(match[3])}</span>`;
    } else if (match[4]) {
      html += `<span class="o-ce-keyword">${escapeHTML(match[4])}</span>`;
    }

    lastIndex = TOKEN_REGEX.lastIndex;
  }

  if (lastIndex < code.length) {
    html += escapeHTML(code.substring(lastIndex));
  }

  return html;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  class?: string;
}

export class CodeEditor extends Component<Props> {
  static template = "o-spreadsheet-CodeEditor";
  static props = {
    value: String,
    onChange: Function,
    placeholder: { type: String, optional: true },
    class: { type: String, optional: true },
  };

  textareaRef = useRef("textarea");
  highlightRef = useRef("highlight");
  linesRef = useRef("lines");

  get highlightedCode() {
    const code = this.props.value || "";
    return markup(highlightCode(code) + (code.endsWith("\n") ? " " : ""));
  }

  get lineNumbers() {
    const lines = (this.props.value || "").split("\n").length;
    return Array.from({ length: lines }, (_, i) => i + 1);
  }

  onInput(ev: Event) {
    const target = ev.target as HTMLTextAreaElement;
    this.props.onChange(target.value);
  }

  onScroll() {
    const textarea = this.textareaRef.el as HTMLTextAreaElement;
    const highlight = this.highlightRef.el as HTMLDivElement;
    const lines = this.linesRef.el as HTMLDivElement;

    if (textarea && highlight && lines) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
      lines.scrollTop = textarea.scrollTop;
    }
  }

  onKeyDown(ev: KeyboardEvent) {
    if (ev.key === "Tab") {
      ev.preventDefault();
      const target = ev.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const value = target.value;
      const newValue = value.substring(0, start) + "  " + value.substring(end);

      this.props.onChange(newValue);

      // We need to restore the cursor position after rendering
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  }
}
