import { DomUtils, parseDocument } from "htmlparser2";
import { isTag, type ChildNode, type Element } from "domhandler";
import { contentHash } from "@/lib/contentHash";
import {
  PAPER_DOCUMENT_VERSION,
  type PaperAsset,
  type PaperBlock,
  type PaperBlockKind,
  type PaperDocument,
  type ProtectedToken,
} from "./paperDocument";

type InlineResult = {
  markdown: string;
  translationSource: string;
  plainText: string;
  tokens: ProtectedToken[];
};

type ParseState = {
  sectionTitle?: string;
  translatable?: boolean;
};

const SKIP_CLASSES = [
  "ltx_authors",
  "ltx_author_notes",
  "ltx_page_navbar",
  "ltx_role_affiliationtext",
  "ltx_role_email",
];

function classes(element: Element): string[] {
  return (element.attribs.class ?? "").split(/\s+/).filter(Boolean);
}

function hasClass(element: Element, name: string): boolean {
  return classes(element).includes(name);
}

function findElement(
  nodes: ChildNode[],
  predicate: (element: Element) => boolean,
): Element | null {
  for (const node of nodes) {
    if (!isTag(node)) continue;
    if (predicate(node)) return node;
    const nested = findElement(node.children, predicate);
    if (nested) return nested;
  }
  return null;
}

function findElements(
  nodes: ChildNode[],
  predicate: (element: Element) => boolean,
  output: Element[] = [],
): Element[] {
  for (const node of nodes) {
    if (!isTag(node)) continue;
    if (predicate(node)) output.push(node);
    findElements(node.children, predicate, output);
  }
  return output;
}

function markdownText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/([\[\]*_`])/g, "\\$1");
}

function cleanInline(value: string): string {
  return value
    .replace(/[\t\r\n ]+/g, " ")
    .replace(/ +([,.;:!?，。；：！？)\]])/g, "$1")
    .replace(/([(\[]) +/g, "$1")
    .trim();
}

function cleanBlock(value: string): string {
  return value
    .split("\n")
    .map((line) => cleanInline(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function absoluteUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" ||
      url.protocol === "http:" ||
      (url.protocol === "file:" && baseUrl.startsWith("file:"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function paperAssetUrl(value: string, baseUrl: string): string | null {
  const resolved = absoluteUrl(value, baseUrl);
  if (!resolved) return null;
  const asset = new URL(resolved);
  const base = new URL(baseUrl);
  if (base.protocol === "file:") {
    // Legacy offline HTML may only reference files inside its own package.
    // Do not let an authored relative path read another app document.
    return asset.protocol === "file:" &&
      asset.href.startsWith(new URL(".", base).href)
      ? asset.href
      : null;
  }
  // Paper authors control image src attributes. Automatic image loading stays
  // on the arXiv response origin so a paper cannot probe LAN or tracking URLs.
  return asset.origin === base.origin ? asset.href : null;
}

function inline(nodes: ChildNode[], baseUrl: string): InlineResult {
  const tokens: ProtectedToken[] = [];

  const token = (kind: "MATH" | "LINK", markdown: string): string => {
    const marker = `[[AT_${kind}_${tokens.length}]]`;
    tokens.push({ marker, markdown });
    return marker;
  };

  const visit = (node: ChildNode): Omit<InlineResult, "tokens"> => {
    if (node.type === "text") {
      const plain = node.data.replace(/\s+/g, " ");
      const escaped = markdownText(plain);
      return {
        markdown: escaped,
        translationSource: escaped,
        plainText: plain,
      };
    }
    if (!isTag(node)) {
      return { markdown: "", translationSource: "", plainText: "" };
    }
    if (["script", "style", "annotation", "noscript"].includes(node.name)) {
      return { markdown: "", translationSource: "", plainText: "" };
    }
    if (node.name === "br") {
      return { markdown: "  \n", translationSource: "  \n", plainText: "\n" };
    }
    if (node.name === "math") {
      const annotation = findElement(
        node.children,
        (element) =>
          element.name === "annotation" &&
          element.attribs.encoding === "application/x-tex",
      );
      const tex = cleanInline(
        annotation
          ? DomUtils.textContent(annotation)
          : (node.attribs.alttext ?? ""),
      );
      if (!tex) return { markdown: "", translationSource: "", plainText: "" };
      const math = `$${tex.replace(/\$/g, "\\$")}$`;
      return {
        markdown: math,
        translationSource: token("MATH", math),
        plainText: tex,
      };
    }

    const child = combine(node.children.map(visit));
    if (!child.markdown) return child;

    if (node.name === "a") {
      const href = node.attribs.href ?? "";
      const target = href.startsWith("#")
        ? `paprism://anchor/${encodeURIComponent(href.slice(1))}`
        : absoluteUrl(href, baseUrl);
      if (!target) return child;
      const marker = token("LINK", target);
      return {
        markdown: `[${child.markdown}](${target})`,
        translationSource: `[${child.translationSource}](${marker})`,
        plainText: child.plainText,
      };
    }
    if (["strong", "b"].includes(node.name)) {
      return wrapInline(child, "**");
    }
    if (["em", "i"].includes(node.name)) {
      return wrapInline(child, "*");
    }
    if (node.name === "code") {
      return wrapInline(child, "`");
    }
    if (node.name === "sup") {
      return wrapInline(child, "^");
    }
    if (node.name === "sub") {
      return wrapInline(child, "~");
    }
    return child;
  };

  const result = combine(nodes.map(visit));
  return {
    markdown: cleanBlock(result.markdown),
    translationSource: cleanBlock(result.translationSource),
    plainText: cleanInline(result.plainText),
    tokens,
  };
}

function combine(
  values: Omit<InlineResult, "tokens">[],
): Omit<InlineResult, "tokens"> {
  return values.reduce(
    (result, value) => ({
      markdown: result.markdown + value.markdown,
      translationSource: result.translationSource + value.translationSource,
      plainText: result.plainText + value.plainText,
    }),
    { markdown: "", translationSource: "", plainText: "" },
  );
}

function wrapInline(
  value: Omit<InlineResult, "tokens">,
  delimiter: string,
): Omit<InlineResult, "tokens"> {
  return {
    markdown: `${delimiter}${value.markdown}${delimiter}`,
    translationSource: `${delimiter}${value.translationSource}${delimiter}`,
    plainText: value.plainText,
  };
}

function uniqueTokenScopes(values: InlineResult[]): InlineResult[] {
  let nextIndex = 0;
  return values.map((value) => {
    let translationSource = value.translationSource;
    const tokens = value.tokens.map((item) => {
      const kind = item.marker.includes("_MATH_") ? "MATH" : "LINK";
      const marker = `[[AT_${kind}_${nextIndex}]]`;
      nextIndex += 1;
      translationSource = translationSource.replace(item.marker, marker);
      return { ...item, marker };
    });
    return { ...value, translationSource, tokens };
  });
}

function anchorIds(element: Element): string[] {
  const ids = findElements(
    [element],
    (item) => typeof item.attribs.id === "string",
  )
    .map((item) => item.attribs.id)
    .filter(Boolean);
  return [...new Set(ids)];
}

function imageAssets(figure: Element, baseUrl: string): PaperAsset[] {
  const assets: PaperAsset[] = [];
  for (const image of findElements(
    figure.children,
    (element) => element.name === "img",
  )) {
    const uri = paperAssetUrl(image.attribs.src ?? "", baseUrl);
    if (!uri) continue;
    const width = Number.parseFloat(image.attribs.width ?? "");
    const height = Number.parseFloat(image.attribs.height ?? "");
    assets.push({
      uri,
      alt: cleanInline(image.attribs.alt ?? "Figure"),
      ...(Number.isFinite(width) && Number.isFinite(height) && height > 0
        ? { aspectRatio: width / height }
        : {}),
    });
  }
  return assets;
}

function listMarkdown(element: Element, baseUrl: string): InlineResult {
  const ordered = element.name === "ol";
  const items = element.children.filter(
    (node): node is Element => isTag(node) && node.name === "li",
  );
  const itemValues = items.map((item) => {
    const contentNode = findElement(
      item.children,
      (child) => child.name === "p" && hasClass(child, "ltx_p"),
    );
    return inline(contentNode?.children ?? item.children, baseUrl);
  });
  const rendered = uniqueTokenScopes(itemValues).map((value, index) => {
    const prefix = ordered ? `${index + 1}. ` : "- ";
    return { value, prefix };
  });
  return {
    markdown: rendered
      .map(({ value, prefix }) => prefix + value.markdown)
      .join("\n"),
    translationSource: rendered
      .map(({ value, prefix }) => prefix + value.translationSource)
      .join("\n"),
    plainText: rendered.map(({ value }) => value.plainText).join("\n"),
    tokens: rendered.flatMap(({ value }) => value.tokens),
  };
}

function tableMarkdown(element: Element, baseUrl: string): InlineResult {
  const rows = findElements(element.children, (child) => child.name === "tr");
  const renderedRows = rows
    .map((row) =>
      row.children
        .filter(
          (node): node is Element =>
            isTag(node) && (node.name === "th" || node.name === "td"),
        )
        .map((cell) => inline(cell.children, baseUrl)),
    )
    .filter((row) => row.length > 0);
  if (renderedRows.length === 0) {
    return { markdown: "", translationSource: "", plainText: "", tokens: [] };
  }
  const scopedCells = uniqueTokenScopes(renderedRows.flat());
  let scopedIndex = 0;
  const scopedRows = renderedRows.map((row) =>
    row.map(() => scopedCells[scopedIndex++]!),
  );
  const width = Math.max(...scopedRows.map((row) => row.length));
  const format = (row: InlineResult[], key: "markdown" | "translationSource") =>
    `| ${Array.from({ length: width }, (_, index) =>
      (row[index]?.[key] ?? "").replace(/\|/g, "\\|"),
    ).join(" | ")} |`;
  const header = scopedRows[0];
  const divider = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
  return {
    markdown: [
      format(header, "markdown"),
      divider,
      ...scopedRows.slice(1).map((row) => format(row, "markdown")),
    ].join("\n"),
    translationSource: [
      format(header, "translationSource"),
      divider,
      ...scopedRows.slice(1).map((row) => format(row, "translationSource")),
    ].join("\n"),
    plainText: scopedRows
      .map((row) => row.map((cell) => cell.plainText).join(" | "))
      .join("\n"),
    tokens: scopedRows.flatMap((row) => row.flatMap((cell) => cell.tokens)),
  };
}

function displayEquation(element: Element): InlineResult {
  const equations = findElements(
    element.children,
    (child) => child.name === "math",
  )
    .map((math) => {
      const annotation = findElement(
        math.children,
        (child) =>
          child.name === "annotation" &&
          child.attribs.encoding === "application/x-tex",
      );
      return cleanInline(
        annotation
          ? DomUtils.textContent(annotation)
          : (math.attribs.alttext ?? ""),
      );
    })
    .filter(Boolean);
  return {
    markdown: equations.map((tex) => `$$\n${tex}\n$$`).join("\n\n"),
    translationSource: "",
    plainText: equations.join("\n"),
    tokens: [],
  };
}

function isTranslatable(kind: PaperBlockKind, value: InlineResult): boolean {
  return (
    !["equation", "code", "unsupported"].includes(kind) &&
    /\p{L}.*\p{L}/u.test(value.plainText)
  );
}

export function parseArxivHtml(
  html: string,
  arxivId: string,
  sourceUrl: string,
): PaperDocument {
  const dom = parseDocument(html, { decodeEntities: true });
  const article = findElement(
    dom.children,
    (element) =>
      element.name === "article" && hasClass(element, "ltx_document"),
  );
  if (!article) throw new Error("arXiv HTML contains no paper article");

  const blocks: PaperBlock[] = [];
  const ids = new Map<string, number>();

  const add = (
    element: Element,
    kind: PaperBlockKind,
    value: InlineResult,
    state: ParseState,
    assets?: PaperAsset[],
  ) => {
    if (!value.markdown && (!assets || assets.length === 0)) return;
    const upstreamId = element.attribs.id;
    const baseId = upstreamId || `${kind}-${contentHash(value.markdown)}`;
    const duplicate = ids.get(baseId) ?? 0;
    ids.set(baseId, duplicate + 1);
    blocks.push({
      id: duplicate === 0 ? baseId : `${baseId}-${duplicate}`,
      anchorIds: anchorIds(element),
      kind,
      markdown: value.markdown,
      plainText: value.plainText,
      translationSource:
        state.translatable !== false && isTranslatable(kind, value)
          ? value.translationSource
          : undefined,
      protectedTokens: value.tokens,
      sectionTitle: state.sectionTitle,
      assets,
    });
  };

  const walk = (element: Element, state: ParseState): void => {
    const elementClasses = classes(element);
    if (SKIP_CLASSES.some((name) => elementClasses.includes(name))) return;
    if (element.name === "h1" && hasClass(element, "ltx_title_document"))
      return;

    if (/^h[1-6]$/.test(element.name)) {
      const value = inline(element.children, sourceUrl);
      // LaTeXML emits the abstract title as h6 for its webpage stylesheet.
      // In the app it is a top-level paper section, not a sixth-level heading.
      const level = hasClass(element, "ltx_title_abstract")
        ? 2
        : Number(element.name.slice(1));
      const prefix = `${"#".repeat(level)} `;
      add(
        element,
        "heading",
        {
          ...value,
          markdown: `${prefix}${value.markdown}`,
          translationSource: `${prefix}${value.translationSource}`,
        },
        { ...state, sectionTitle: value.plainText },
      );
      state.sectionTitle = value.plainText;
      return;
    }
    if (element.name === "figure" && hasClass(element, "ltx_figure")) {
      const caption = findElement(
        element.children,
        (child) => child.name === "figcaption",
      );
      add(
        element,
        "figure",
        inline(caption?.children ?? [], sourceUrl),
        state,
        imageAssets(element, sourceUrl),
      );
      return;
    }
    if (
      element.name === "table" &&
      (hasClass(element, "ltx_equation") || hasClass(element, "ltx_eqn_table"))
    ) {
      add(element, "equation", displayEquation(element), state);
      return;
    }
    if (element.name === "table" || hasClass(element, "ltx_table")) {
      add(element, "table", tableMarkdown(element, sourceUrl), state);
      return;
    }
    if (["ul", "ol"].includes(element.name)) {
      add(element, "list", listMarkdown(element, sourceUrl), state);
      return;
    }
    if (element.name === "blockquote") {
      const value = inline(element.children, sourceUrl);
      add(
        element,
        "quote",
        {
          ...value,
          markdown: value.markdown
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
          translationSource: value.translationSource
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
        },
        state,
      );
      return;
    }
    if (element.name === "pre") {
      const text = DomUtils.textContent(element).trim();
      add(
        element,
        "code",
        {
          markdown: `\`\`\`\n${text}\n\`\`\``,
          translationSource: "",
          plainText: text,
          tokens: [],
        },
        state,
      );
      return;
    }
    if (element.name === "p" && hasClass(element, "ltx_p")) {
      add(element, "paragraph", inline(element.children, sourceUrl), state);
      return;
    }

    const childState =
      element.name === "section"
        ? {
            ...state,
            // Translating a bibliography spends tokens on names, venues and
            // identifiers while usually making citations less accurate.
            translatable: hasClass(element, "ltx_bibliography")
              ? false
              : state.translatable,
          }
        : state;
    for (const child of element.children) {
      if (isTag(child)) walk(child, childState);
    }
  };

  // arXiv pages can put publisher or licence notices before the document
  // title. The app already renders canonical metadata, so begin after the
  // title and avoid presenting that page chrome as the first paper paragraph.
  const documentTitleIndex = article.children.findIndex(
    (child) =>
      isTag(child) &&
      child.name === "h1" &&
      hasClass(child, "ltx_title_document"),
  );
  const content =
    documentTitleIndex >= 0
      ? article.children.slice(documentTitleIndex + 1)
      : article.children;
  const state: ParseState = {};
  for (const child of content) {
    if (isTag(child)) walk(child, state);
  }
  if (blocks.length === 0)
    throw new Error("arXiv HTML contains no readable blocks");

  let previousContext = "";
  for (const block of blocks) {
    if (!block.translationSource) continue;
    block.contextBefore = previousContext.slice(-600);
    previousContext = block.plainText;
  }

  return {
    version: PAPER_DOCUMENT_VERSION,
    arxivId,
    sourceUrl,
    sourceHash: contentHash(html),
    blocks,
  };
}
