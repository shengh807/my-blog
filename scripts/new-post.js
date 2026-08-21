// new-post.js
// -----------------------------------------------------------------------------
// 새 글 초안 파일을 posts/ 폴더에 자동으로 만들어줍니다.
// 실행: npm run new "글 제목"
// -----------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.resolve(__dirname, "..", "posts");

function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const title = process.argv.slice(2).join(" ").trim();

if (!title) {
  console.error('사용법: npm run new "글 제목"');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const slug = slugify(title) || "untitled";
const filename = `${today}-${slug}.md`;
const filePath = path.join(POSTS_DIR, filename);

if (fs.existsSync(filePath)) {
  console.error(`이미 같은 이름의 파일이 있습니다: ${filename}`);
  process.exit(1);
}

const template = `---
title: "${title}"
date: "${today}"
tags: []
description: ""
draft: true
---

여기에 내용을 작성하세요.
`;

fs.mkdirSync(POSTS_DIR, { recursive: true });
fs.writeFileSync(filePath, template, "utf-8");

console.log(`새 글 초안을 만들었습니다: posts/${filename}`);
console.log(`다 쓰신 뒤 draft: true 를 false 로 바꾸고 "npm run build" 를 실행하면 발행됩니다.`);
