// 오늘(한국 시간) 날짜 폴더의 그림·글을 인스타그램과 스레드에 게시한다.
// 이미 올린 건 posted.json에 기록해서 두 번 올리지 않는다.
import fs from "node:fs";

const {
  IG_TOKEN, THREADS_TOKEN, GITHUB_REPOSITORY,
  TARGET_DATE = "", DRY_RUN = "false", PLATFORMS = "instagram,threads",
  POST_AT = "21:00", MAX_WAIT_MIN = "30",
} = process.env;

const IG = "https://graph.instagram.com";
const TH = "https://graph.threads.net";
const dryRun = DRY_RUN === "true";
const platforms = PLATFORMS.split(",").map(s => s.trim()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kstNow = () => new Date(Date.now() + 9 * 3600e3);

async function waitUntilPostTime() {
  const [h, m] = POST_AT.split(":").map(Number);
  const now = kstNow();
  const target = new Date(now); target.setUTCHours(h, m, 0, 0);
  const waitMs = target - now;
  if (waitMs > 0 && waitMs <= Number(MAX_WAIT_MIN) * 60e3) {
    console.log(`${POST_AT} KST까지 ${Math.round(waitMs / 1000)}초 대기`);
    await sleep(waitMs);
  }
}

async function api(base, path, params, method = "POST") {
  const url = new URL(path, base);
  const body = new URLSearchParams(params);
  const res = method === "GET"
    ? await fetch(`${url}?${body}`)
    : await fetch(url, { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`${method} ${url.pathname} 실패: ${JSON.stringify(json.error ?? json)}`);
  }
  return json;
}

async function waitReady(base, id, token, field) {
  for (let i = 0; i < 30; i++) {
    const s = await api(base, `/${id}`, { fields: field, access_token: token }, "GET");
    if (s[field] === "FINISHED") return;
    if (s[field] === "ERROR" || s[field] === "EXPIRED") throw new Error(`컨테이너 ${id} 상태 ${s[field]}`);
    await sleep(5000);
  }
  throw new Error(`컨테이너 ${id} 준비 시간 초과`);
}

async function postInstagram(imageUrl, caption) {
  const me = await api(IG, "/me", { fields: "user_id,username", access_token: IG_TOKEN }, "GET");
  const { id } = await api(IG, `/${me.user_id}/media`, { image_url: imageUrl, caption, access_token: IG_TOKEN });
  await waitReady(IG, id, IG_TOKEN, "status_code");
  const pub = await api(IG, `/${me.user_id}/media_publish`, { creation_id: id, access_token: IG_TOKEN });
  console.log(`인스타 게시 완료 (@${me.username}) id=${pub.id}`);
  return pub.id;
}

async function threadsPublish(params) {
  const { id } = await api(TH, "/me/threads", { ...params, access_token: THREADS_TOKEN });
  await waitReady(TH, id, THREADS_TOKEN, "status");
  const pub = await api(TH, "/me/threads_publish", { creation_id: id, access_token: THREADS_TOKEN });
  return pub.id;
}

async function postThreads(imageUrl, { main, replies }) {
  const mainId = await threadsPublish({ media_type: "IMAGE", image_url: imageUrl, text: main });
  console.log(`스레드 본문 게시 완료 id=${mainId}`);
  for (const [i, text] of replies.entries()) {
    await sleep(3000);
    const rid = await threadsPublish({ media_type: "TEXT", text, reply_to_id: mainId });
    console.log(`  답글 ${i + 1}/${replies.length} id=${rid}`);
  }
  return mainId;
}

async function main() {
  if (!TARGET_DATE && !dryRun) await waitUntilPostTime();
  const date = TARGET_DATE || kstNow().toISOString().slice(0, 10);
  const dir = `posts/${date}`;
  if (!fs.existsSync(dir)) { console.log(`${date}: 올릴 게시물 없음`); return; }

  const imageUrl = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/main/${dir}/image.jpg`;
  const caption = fs.readFileSync(`${dir}/caption.txt`, "utf8");
  const threads = JSON.parse(fs.readFileSync(`${dir}/threads.json`, "utf8"));
  const posted = JSON.parse(fs.readFileSync("posted.json", "utf8"));
  posted[date] ??= {};

  const head = await fetch(imageUrl, { method: "HEAD" });
  if (!head.ok) throw new Error(`그림 주소 접근 실패 ${head.status}: ${imageUrl}`);
  console.log(`${date} 게시 준비 — 그림 ${imageUrl}`);

  if (dryRun) {
    console.log(`[연습] 인스타 캡션 ${[...caption].length}자, 스레드 본문+답글 ${threads.replies.length}개`);
    return;
  }

  const errors = [];
  for (const p of platforms) {
    if (posted[date][p]) { console.log(`${p}: 이미 게시됨 (${posted[date][p]}) — 건너뜀`); continue; }
    try {
      if (p === "instagram") {
        if (!IG_TOKEN) throw new Error("IG_TOKEN 비밀값이 없어요");
        posted[date][p] = await postInstagram(imageUrl, caption);
      } else if (p === "threads") {
        if (!THREADS_TOKEN) throw new Error("THREADS_TOKEN 비밀값이 없어요");
        posted[date][p] = await postThreads(imageUrl, threads);
      }
    } catch (e) {
      errors.push(`${p}: ${e.message}`);
    }
    fs.writeFileSync("posted.json", JSON.stringify(posted, null, 2) + "\n");
  }
  if (errors.length) throw new Error(errors.join("\n"));
}

main().catch(e => { console.error(e.message); process.exit(1); });
