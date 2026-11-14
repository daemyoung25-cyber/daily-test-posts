// 해석 글 md(## YYYY-MM-DD 블록) → posts/<날짜>/caption.txt, threads.json, index.json 갱신
// 사용: node scripts/build-reel-post.mjs <md 경로> <YYYY-MM-DD> [더 많은 날짜...]
import fs from "node:fs";
import path from "node:path";

const [md, ...dates] = process.argv.slice(2);
if (!md || !dates.length) { console.error("usage: build-reel-post.mjs <md> <date...>"); process.exit(1); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const src = fs.readFileSync(md, "utf8").replace(/\r/g, "");
const blocks = {};
for (const part of src.split(/^## /m).slice(1)) {
  const nl = part.indexOf("\n");
  blocks[part.slice(0, nl).trim().split(/\s/)[0]] = part.slice(nl + 1).trim();
}

for (const d of dates) {
  const body = blocks[d];
  if (!body) throw new Error(`no block for ${d}`);
  const paras = body.split(/\n\s*\n/);
  const [intro, about, ...rest] = paras;
  const results = rest.filter(p => /^[①②③④]/.test(p));
  const outro = rest.filter(p => !/^[①②③④]/.test(p) && !p.startsWith("#")).join("\n\n");
  if (results.length !== 4) throw new Error(`${d}: expected 4 results, got ${results.length}`);
  const names = results.map(r => r.split("\n")[0].replace(/^[①②③④]\s*/, ""));
  const [l1, l2] = intro.split("\n");
  const emoji = ([...l1.matchAll(/\p{Extended_Pictographic}️?/gu)].pop() || [""])[0];
  const aboutText = about.replace(/^\[이 테스트는요\]\n/, "");
  const main = `${l1}\n${l2}\n${names.map((n, i) => `${i + 1} ${n}`).join(" · ")}\n고르고 나서 답글에서 결과 확인해요 ⬇️\n\n${emoji ? emoji + " " : ""}${aboutText}`;
  const replies = [...results, outro];
  for (const t of [main, ...replies]) if ([...t].length > 500) throw new Error(`${d}: threads block over 500 chars`);
  if ([...body].length > 2200) throw new Error(`${d}: caption over 2200 chars (${[...body].length})`);
  const dir = path.join(root, "posts", d);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "caption.txt"), body + "\n");
  fs.writeFileSync(path.join(dir, "threads.json"), JSON.stringify({ main, replies }, null, 2) + "\n");
  console.log(d, "caption", [...body].length, "chars;", names.join(" / "));
}

const idxPath = path.join(root, "posts", "index.json");
const idx = new Set(JSON.parse(fs.readFileSync(idxPath, "utf8")));
dates.forEach(d => idx.add(d));
fs.writeFileSync(idxPath, JSON.stringify([...idx].sort(), null, 2) + "\n");
