// build.js
// -----------------------------------------------------------------------------
// posts/ 폴더의 마크다운 파일을 읽어서 docs/ 폴더에 정적 HTML 사이트를 생성합니다.
// 실행: npm run build
//
// 외부 패키지 없이 순수 Node.js만으로 동작합니다 (npm install이 필요 없습니다).
// -----------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../site.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");
const OUT_DIR = path.join(ROOT, "docs");
const ASSETS_DIR = path.join(ROOT, "assets");

const INCLUDE_DRAFTS = process.argv.includes("--drafts");

// ---------- 기본 유틸 ----------
function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function toISODate(d) {
  return new Date(d).toISOString();
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function estimateReadingMinutes(text) {
  const chars = text.length;
  return Math.max(1, Math.round(chars / 500));
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------- 아주 작은 frontmatter(YAML) 파서 ----------
function parseYamlValue(value) {
  value = value.trim();
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\[.*\]$/.test(value)) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => parseYamlValue(s.trim()));
  }
  if (/^".*"$/.test(value)) return value.slice(1, -1);
  if (/^'.*'$/.test(value)) return value.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const data = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    data[kv[1]] = parseYamlValue(kv[2]);
  }
  return { data, content: match[2] };
}

// ---------- 아주 작은 마크다운 렌더러 ----------
function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|");
}

function inline(text) {
  let t = escapeHtml(text);

  // 코드 스팬을 먼저 임시 토큰으로 빼둔다 (그 안의 내용이 이후 이미지/링크/강조
  // 정규식에 다시 걸려서 깨지는 것을 방지하기 위함)
  const codeSpans = [];
  t = t.replace(/`([^`]+)`/g, function (_, c) {
    codeSpans.push(c);
    return "\x01" + (codeSpans.length - 1) + "\x02";
  });

  // 이미지
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}">`);
  // 링크
  t = t.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`);
  // 굵게
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // 취소선
  t = t.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  // 기울임
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/(^|[^\w])_([^_]+)_(?!\w)/g, "$1<em>$2</em>");

  // 코드 스팬 복원
  t = t.replace(/\x01(\d+)\x02/g, (_, idx) => `<code>${codeSpans[Number(idx)]}</code>`);

  return t;
}

function isBlockStart(line) {
  return (
    /^```/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^>\s?/.test(line) ||
    /^(\s*)([-*+])\s+/.test(line) ||
    /^(\s*)(\d+)\.\s+/.test(line) ||
    (/\|/.test(line) && /^\s*$/.test(line) === false && false)
  );
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // 코드 블록
    const fence = line.match(/^```\s*([\w-]*)\s*$/);
    if (fence) {
      const lang = fence[1];
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // 헤딩
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const id = slugify(heading[2]);
      out.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // 구분선
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // 인용
    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(quoteLines.join("\n"))}</blockquote>`);
      continue;
    }

    // 표
    if (/\|/.test(line) && lines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]).map((c) => {
        const t = c.trim();
        if (/^:-+:$/.test(t)) return "center";
        if (/^-+:$/.test(t)) return "right";
        if (/^:-+$/.test(t)) return "left";
        return "";
      });
      i += 2;
      const bodyRows = [];
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== "") {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      const alignAttr = (idx) => (aligns[idx] ? ` style="text-align:${aligns[idx]}"` : "");
      const thead = `<tr>${headerCells
        .map((c, idx) => `<th${alignAttr(idx)}>${inline(c.trim())}</th>`)
        .join("")}</tr>`;
      const tbody = bodyRows
        .map(
          (row) =>
            `<tr>${row.map((c, idx) => `<td${alignAttr(idx)}>${inline(c.trim())}</td>`).join("")}</tr>`
        )
        .join("");
      out.push(`<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`);
      continue;
    }

    // 순서 없는 목록
    if (/^(\s*)([-*+])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^(\s*)([-*+])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^(\s*)([-*+])\s+/, ""));
        i++;
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`);
      continue;
    }

    // 순서 있는 목록
    if (/^(\s*)(\d+)\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^(\s*)(\d+)\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^(\s*)(\d+)\.\s+/, ""));
        i++;
      }
      out.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ol>`);
      continue;
    }

    // 문단
    const paraLines = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(paraLines.join(" "))}</p>`);
  }

  return out.join("\n");
}

// ---------- 포스트 로드 ----------
function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));

  const posts = files.map((filename) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf-8");
    const { data, content } = parseFrontmatter(raw);

    const filenameMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    const dateFromFilename = filenameMatch ? filenameMatch[1] : null;
    const slugFromFilename = filenameMatch
      ? slugify(filenameMatch[2])
      : slugify(path.basename(filename, ".md"));

    const title = data.title || "제목 없음";
    const date = data.date || dateFromFilename || new Date().toISOString();
    const slug = data.slug ? slugify(data.slug) : slugFromFilename;
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const draft = Boolean(data.draft);

    const html = renderMarkdown(content);
    const description =
      data.description || stripHtml(html).slice(0, 140).trim() + "...";

    return {
      title,
      date,
      dateDisplay: formatDate(date),
      dateISO: toISODate(date),
      slug,
      tags,
      draft,
      html,
      description,
      readingMinutes: estimateReadingMinutes(stripHtml(html)),
      url: `/posts/${slug}/`
    };
  });

  return posts
    .filter((p) => INCLUDE_DRAFTS || !p.draft)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ---------- 템플릿 ----------
function layout({ title, description, url, content, extraHead = "" }) {
  const pageTitle = title ? `${title} · ${config.title}` : config.title;
  return `<!doctype html>
<html lang="${config.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(pageTitle)}</title>
<meta name="description" content="${escapeXml(description || config.description)}">
<link rel="canonical" href="${config.url}${url}">
<link rel="alternate" type="application/rss+xml" title="${escapeXml(config.title)}" href="/rss.xml">
<link rel="icon" href="data:,">
<link rel="stylesheet" href="/assets/style.css">
<meta property="og:title" content="${escapeXml(pageTitle)}">
<meta property="og:description" content="${escapeXml(description || config.description)}">
<meta property="og:type" content="website">
${extraHead}
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="site-title" href="/">${escapeXml(config.title)}</a>
    <nav class="site-nav">
      ${config.nav.map((n) => `<a href="${n.href}">${escapeXml(n.label)}</a>`).join("\n      ")}
    </nav>
  </div>
</header>
<main class="wrap">
${content}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>&copy; ${new Date().getFullYear()} ${escapeXml(config.author)}. ${escapeXml(config.title)}.</p>
  </div>
</footer>
</body>
</html>`;
}

function tagChips(tags) {
  if (!tags.length) return "";
  return `<div class="tags">${tags
    .map((t) => `<a class="tag" href="/tags/${slugify(t)}/">#${escapeXml(t)}</a>`)
    .join("")}</div>`;
}

function postCard(post) {
  return `<article class="post-card">
  <h2><a href="${post.url}">${escapeXml(post.title)}</a></h2>
  <div class="post-meta">
    <time datetime="${post.dateISO}">${post.dateDisplay}</time>
    <span aria-hidden="true">·</span>
    <span>${post.readingMinutes}분 읽기</span>
  </div>
  <p class="excerpt">${escapeXml(post.description)}</p>
  ${tagChips(post.tags)}
</article>`;
}

function renderHome(posts) {
  const perPage = config.postsPerPage || 10;
  const pageCount = Math.max(1, Math.ceil(posts.length / perPage));

  for (let page = 1; page <= pageCount; page++) {
    const slice = posts.slice((page - 1) * perPage, page * perPage);
    const listHtml = slice.length
      ? slice.map(postCard).join("\n")
      : `<p class="empty">아직 작성된 글이 없습니다. posts/ 폴더에 첫 글을 추가해보세요!</p>`;

    const pagination = `<nav class="pagination">
      ${page > 1 ? `<a href="${page === 2 ? "/" : `/page/${page - 1}/`}">← 이전</a>` : "<span></span>"}
      <span class="page-indicator">${page} / ${pageCount}</span>
      ${page < pageCount ? `<a href="/page/${page + 1}/">다음 →</a>` : "<span></span>"}
    </nav>`;

    const content = `<section class="hero">
  <p>${escapeXml(config.description)}</p>
</section>
<section class="post-list">
${listHtml}
</section>
${pageCount > 1 ? pagination : ""}`;

    const html = layout({
      title: page === 1 ? null : `${page} 페이지`,
      description: config.description,
      url: page === 1 ? "/" : `/page/${page}/`,
      content
    });

    if (page === 1) {
      write(path.join(OUT_DIR, "index.html"), html);
    } else {
      write(path.join(OUT_DIR, "page", String(page), "index.html"), html);
    }
  }
}

function renderPost(post) {
  const content = `<article class="post">
  <h1>${escapeXml(post.title)}</h1>
  <div class="post-meta">
    <time datetime="${post.dateISO}">${post.dateDisplay}</time>
    <span aria-hidden="true">·</span>
    <span>${post.readingMinutes}분 읽기</span>
  </div>
  ${tagChips(post.tags)}
  <div class="post-body">
  ${post.html}
  </div>
  <p class="back-link"><a href="/">← 목록으로</a></p>
</article>`;

  const html = layout({
    title: post.title,
    description: post.description,
    url: post.url,
    content
  });

  write(path.join(OUT_DIR, "posts", post.slug, "index.html"), html);
}

function renderTags(posts) {
  const tagMap = new Map();
  posts.forEach((p) =>
    p.tags.forEach((t) => {
      const key = slugify(t);
      if (!tagMap.has(key)) tagMap.set(key, { name: t, posts: [] });
      tagMap.get(key).posts.push(p);
    })
  );

  const tagListHtml = [...tagMap.entries()]
    .sort((a, b) => b[1].posts.length - a[1].posts.length)
    .map(
      ([key, { name, posts }]) =>
        `<a class="tag tag-lg" href="/tags/${key}/">#${escapeXml(name)} <span class="count">${posts.length}</span></a>`
    )
    .join("\n");

  write(
    path.join(OUT_DIR, "tags", "index.html"),
    layout({
      title: "태그",
      description: "태그별로 글 모아보기",
      url: "/tags/",
      content: `<h1>태그</h1><div class="tag-cloud">${tagListHtml || "<p>아직 태그가 없습니다.</p>"}</div>`
    })
  );

  for (const [key, { name, posts: taggedPosts }] of tagMap.entries()) {
    const content = `<h1>#${escapeXml(name)}</h1>
<section class="post-list">
${taggedPosts.map(postCard).join("\n")}
</section>
<p class="back-link"><a href="/tags/">← 태그 목록</a></p>`;

    write(
      path.join(OUT_DIR, "tags", key, "index.html"),
      layout({
        title: `#${name}`,
        description: `#${name} 태그가 달린 글 모음`,
        url: `/tags/${key}/`,
        content
      })
    );
  }
}

function render404() {
  const content = `<div class="not-found">
  <h1>404</h1>
  <p>페이지를 찾을 수 없습니다.</p>
  <p><a href="/">← 홈으로 돌아가기</a></p>
</div>`;
  write(
    path.join(OUT_DIR, "404.html"),
    layout({ title: "페이지를 찾을 수 없음", description: "404", url: "/404.html", content })
  );
}

function renderRss(posts) {
  const items = posts
    .slice(0, 20)
    .map(
      (p) => `  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${config.url}${p.url}</link>
    <guid>${config.url}${p.url}</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${escapeXml(p.description)}</description>
  </item>`
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(config.title)}</title>
  <link>${config.url}</link>
  <description>${escapeXml(config.description)}</description>
  <language>${config.lang}</language>
${items}
</channel>
</rss>`;

  write(path.join(OUT_DIR, "rss.xml"), rss);
}

function renderSitemap(posts) {
  const urls = ["/", "/tags/", ...posts.map((p) => p.url)];
  const body = urls.map((u) => `  <url><loc>${config.url}${u}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
  write(path.join(OUT_DIR, "sitemap.xml"), xml);
}

function copyAssets() {
  const dest = path.join(OUT_DIR, "assets");
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(ASSETS_DIR)) {
    fs.copyFileSync(path.join(ASSETS_DIR, file), path.join(dest, file));
  }
}

// ---------- 실행 ----------
function main() {
  console.log("빌드를 시작합니다...");
  rmrf(OUT_DIR);

  const posts = loadPosts();
  console.log(`${posts.length}개의 글을 찾았습니다.`);

  renderHome(posts);
  posts.forEach(renderPost);
  renderTags(posts);
  render404();
  renderRss(posts);
  renderSitemap(posts);
  copyAssets();

  // GitHub Pages가 /docs 폴더를 그대로 서빙할 때 Jekyll 처리를 건너뛰게 함
  write(path.join(OUT_DIR, ".nojekyll"), "");

  console.log(`완료! 결과물은 docs/ 폴더에 생성되었습니다.`);
}

main();
