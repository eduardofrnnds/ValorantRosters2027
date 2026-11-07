import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("docs/VLR_ASSETS.json", "utf8"));
const cached = process.argv.includes("--cached");
const checkedAt = new Date().toISOString();
await mkdir("artifacts/vlr-rosters", { recursive: true });
await mkdir("public/images/players", { recursive: true });
const decode = (value) => value.replace(/<[^>]+>/g, " ").replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0] === "x" ? parseInt(code.slice(1), 16) : Number(code)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
async function read(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  assert.ok(response.ok, `${url}: HTTP ${response.status}`);
  return response;
}
const teams = [];
const photos = new Map();
const skippedStaff = [];
for (const organization of manifest.assets) {
  const slug = organization.localPath.split("/").at(-1).replace(".png", "");
  const archive = `artifacts/vlr-rosters/${slug}.html`;
  const html = (cached ? await readFile(archive, "utf8").catch(() => null) : null) ?? await (await read(organization.pageURL)).text();
  await writeFile(archive, html);
  assert.ok(html.includes('class="team-header-desc"'), `Invalid team page: ${organization.name}`);
  const members = [];
  for (const match of html.matchAll(/<div class="team-roster-item(?:\s[^"]*)?">([\s\S]*?)<\/a>/g)) {
    const block = match[1];
    const playerPath = block.match(/href="(\/player\/(\d+)\/([^"/?]+))"/);
    assert.ok(playerPath, `Player link missing: ${organization.name}`);
    const field = (name) => decode(block.match(new RegExp(`class="[^"]*\\bteam-roster-item-name-${name}"[^>]*>([\\s\\S]*?)<\\/div>`))?.[1] ?? "");
    const nickname = field("alias");
    assert.ok(nickname, `Nickname missing: ${playerPath[1]}`);
    const label = field("role");
    const group = [...html.slice(0, match.index).matchAll(/class="wf-module-label"[^>]*>([\s\S]*?)<\/div>/g)].at(-1);
    const category = decode(group?.[1] ?? "").toLowerCase();
    if (category === "staff" && !/coach/i.test(label)) {
      skippedStaff.push({ organization: organization.name, nickname, label, source: `https://www.vlr.gg${playerPath[1]}` });
      continue;
    }
    assert.ok(["players", "staff", "inactive"].includes(category), `Unknown group: ${category}`);
    const status = /inactive|benched/i.test(label + " " + category) ? "inactive" : /\bsub\b|substitute|reserve/i.test(label) ? "reserve" : /coach/i.test(label) ? "coach" : "starter";
    const flag = block.match(/class="flag mod-([a-z]+)"/)?.[1];
    const photo = block.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const playerId = `vlr-${playerPath[2]}`;
    let photoUrl;
    if (photo && new URL(photo, organization.pageURL).hostname === "owcdn.net") {
      const imageURL = new URL(photo, organization.pageURL).href;
      if (!photos.has(playerId)) {
        const response = await read(imageURL);
        const mime = response.headers.get("content-type")?.split(";")[0];
        const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[mime];
        assert.ok(extension, `Unsupported photo: ${mime}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const localPath = `/images/players/${playerId}.${extension}`;
        await writeFile(`public${localPath}`, buffer);
        photos.set(playerId, { playerId, imageURL, localPath, bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") });
      }
      photoUrl = photos.get(playerId).localPath;
    }
    const nationality = flag && /^[a-z]{2}$/.test(flag) ? new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(flag.toUpperCase()) : undefined;
    members.push({ id: playerId, slug: `${playerPath[3]}-${playerPath[2]}`, nickname, name: field("real") || undefined, nationality, photoUrl, status, sourceLabel: label || undefined, sourceUrl: `https://www.vlr.gg${playerPath[1]}` });
  }
  assert.equal(new Set(members.map(member => member.id)).size, members.length, `Duplicate player: ${organization.name}`);
  teams.push({ organizationId: organization.organizationId, name: organization.name, sourceUrl: organization.pageURL, members });
  console.log(`${organization.name}: ${members.map(member => `${member.nickname}${member.sourceLabel ? ` (${member.sourceLabel})` : ""}`).join(", ") || "no players/coaches listed"}`);
}
assert.equal(teams.length, 32);
const snapshot = { checkedAt, teams };
await writeFile("src/features/rosters/data/vlr-rosters.json", JSON.stringify(snapshot, null, 2) + "\n");
await writeFile("docs/VLR_PLAYER_ASSETS.json", JSON.stringify({ checkedAt, photos: [...photos.values()], skippedStaff }, null, 2) + "\n");
console.log(JSON.stringify({ teams: teams.length, members: teams.reduce((sum, team) => sum + team.members.length, 0), photos: photos.size, skippedStaff: skippedStaff.length }));
