import { describe, expect, test } from "bun:test";
import { parseArxivHtml } from "./arxivHtmlParser";
import { restoreProtectedTokens } from "./paperDocument";

const SOURCE = "https://arxiv.org/html/1706.03762";

describe("arXiv native document parser", () => {
  test("extracts semantic blocks without duplicating nested content", () => {
    const document = parseArxivHtml(
      `<html><body><article class="ltx_document">
        <p class="ltx_p">Publisher notice</p>
        <h1 class="ltx_title_document">Paper title</h1>
        <div class="ltx_authors"><span>A. Author</span></div>
        <section id="S1" class="ltx_section">
          <h2 id="S1.title">1 Introduction</h2>
          <div class="ltx_para"><p id="S1.p1" class="ltx_p">The score is
            <math alttext="x_1"><semantics><annotation encoding="application/x-tex">x_1</annotation></semantics></math>
            and follows <a href="#bib.1">prior work</a>.</p></div>
          <ul id="S1.list"><li id="S1.li1"><div class="ltx_para"><p class="ltx_p">First item</p></div></li></ul>
          <table id="S1.table" class="ltx_table"><tr><th>Model</th><th>Score</th></tr><tr><td>A</td><td>10</td></tr></table>
          <table id="S1.eq" class="ltx_equation"><tr><td><math display="block" alttext="y=x"><annotation encoding="application/x-tex">y=x</annotation></math></td></tr></table>
          <figure id="S1.fig" class="ltx_figure"><img src="1706.03762/figure.png" width="200" height="100" alt="Architecture"><figcaption>Figure 1: Main model</figcaption></figure>
        </section>
        <section id="bib" class="ltx_bibliography"><ul><li id="bib.1">Reference title</li></ul></section>
      </article></body></html>`,
      "1706.03762",
      SOURCE,
    );

    expect(document.blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "list",
      "table",
      "equation",
      "figure",
      "list",
    ]);
    expect(document.blocks[0]?.markdown).toBe("## 1 Introduction");
    expect(document.blocks[0]?.sectionTitle).toBe("1 Introduction");
    expect(
      document.blocks.some((block) => block.plainText === "Publisher notice"),
    ).toBe(false);
    expect(
      document.blocks.filter((block) => block.plainText === "First item"),
    ).toHaveLength(1);
    expect(document.blocks[1]?.sectionTitle).toBe("1 Introduction");
    expect(document.blocks[1]?.anchorIds).toContain("S1.p1");
    expect(document.blocks[5]?.assets?.[0]).toEqual({
      uri: "https://arxiv.org/html/1706.03762/figure.png",
      alt: "Architecture",
      aspectRatio: 2,
    });
    expect(document.blocks.at(-1)?.anchorIds).toContain("bib.1");
    expect(document.blocks.at(-1)?.translationSource).toBeUndefined();
  });

  test("protects math and link targets across translation", () => {
    const document = parseArxivHtml(
      `<article class="ltx_document"><p id="p1" class="ltx_p">Use
        <math alttext="a"><annotation encoding="application/x-tex">a</annotation></math>
        with <a href="https://example.com/paper">this paper</a>.</p></article>`,
      "1234.5678",
      "https://arxiv.org/html/1234.5678",
    );
    const block = document.blocks[0]!;
    expect(block.translationSource).toContain("[[AT_MATH_0]]");
    expect(block.translationSource).toContain("[[AT_LINK_1]]");
    expect(
      restoreProtectedTokens(
        "使用 [[AT_MATH_0]] 与 [这篇论文]([[AT_LINK_1]])。",
        block.protectedTokens,
      ),
    ).toBe("使用 $a$ 与 [这篇论文](https://example.com/paper)。");
    expect(() =>
      restoreProtectedTokens("公式丢失", block.protectedTokens),
    ).toThrow("protected token");
  });

  test("assigns unique markers when a list contains multiple formulas", () => {
    const document = parseArxivHtml(
      `<article class="ltx_document"><ul id="l"><li><math alttext="a"><annotation encoding="application/x-tex">a</annotation></math> alpha</li><li><math alttext="b"><annotation encoding="application/x-tex">b</annotation></math> beta</li></ul></article>`,
      "1234.5678",
      "https://arxiv.org/html/1234.5678",
    );
    expect(
      document.blocks[0]?.protectedTokens.map((token) => token.marker),
    ).toEqual(["[[AT_MATH_0]]", "[[AT_MATH_1]]"]);
  });

  test("keeps every formula in a multi-row equation table", () => {
    const document = parseArxivHtml(
      `<article class="ltx_document"><table class="ltx_equation"><tr><td><math><annotation encoding="application/x-tex">a=b</annotation></math></td></tr><tr><td><math><annotation encoding="application/x-tex">c=d</annotation></math></td></tr></table></article>`,
      "1234.5678",
      "https://arxiv.org/html/1234.5678",
    );
    expect(document.blocks[0]?.markdown).toBe("$$\na=b\n$$\n\n$$\nc=d\n$$");
  });

  test("promotes LaTeXML's abstract h6 to a readable section heading", () => {
    const document = parseArxivHtml(
      `<article class="ltx_document"><h6 class="ltx_title_abstract">Abstract</h6><p class="ltx_p">Paper summary.</p></article>`,
      "1234.5678",
      "https://arxiv.org/html/1234.5678",
    );
    expect(document.blocks[0]?.markdown).toBe("## Abstract");
  });

  test("does not auto-load author-controlled images outside the paper origin", () => {
    const document = parseArxivHtml(
      `<article class="ltx_document"><figure class="ltx_figure"><img src="https://tracker.example/pixel.png"><img src="local.png"></figure></article>`,
      "1234.5678",
      "https://arxiv.org/html/1234.5678",
    );
    expect(document.blocks[0]?.assets?.map((asset) => asset.uri)).toEqual([
      "https://arxiv.org/html/local.png",
    ]);
  });
});
