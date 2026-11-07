import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { vlrSnapshot } from "../src/features/rosters/data/vlr-snapshot.ts";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";

const base = process.env.UI_BASE_URL ?? "https://valorant-rosters-2027.vercel.app";
const report = { base, checkedAt: new Date().toISOString(), regions: [], profiles: 0, images: 0 };
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
async function read(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, path);
  return response;
}
async function batches(items, action) {
  for (let index = 0; index < items.length; index += 6) await Promise.all(items.slice(index, index + 6).map(action));
}
for (const region of vct2027.regions) {
  const html = await (await read(`/${region.slug}`)).text();
  assert.ok(html.includes("Times e rosters"));
  assert.ok(html.includes("As formações de 2027 podem mudar."));
  const teams = vlrSnapshot.teams.filter(team => vct2027.teamSeasons.some(entry => entry.regionId === region.id && entry.organizationId === team.organizationId));
  for (const team of teams) {
    assert.ok(html.includes(`id="team-${team.organizationId}"`));
    for (const member of team.members) assert.ok(html.includes(`>${escape(member.nickname)}</span>`), `${team.name}: ${member.nickname}`);
  }
  report.regions.push({ slug: region.slug, members: teams.reduce((sum, team) => sum + team.members.length, 0) });
}
const members = vlrSnapshot.teams.flatMap(team => team.members);
await batches(members, async (member) => {
  const html = await (await read(`/player/${member.slug}`)).text();
  assert.ok(html.includes(`>${escape(member.nickname)}</h1>`), member.slug);
  assert.ok(html.includes("Consultado em"));
  assert.ok(html.includes(member.sourceUrl));
  report.profiles++;
});
const logos = JSON.parse(await readFile("docs/VLR_ASSETS.json", "utf8")).assets;
const photos = JSON.parse(await readFile("docs/VLR_PLAYER_ASSETS.json", "utf8")).photos;
await batches([...logos, ...photos], async (asset) => {
  const response = await read(asset.localPath);
  assert.match(response.headers.get("content-type") ?? "", /^image\//);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.localPath);
  report.images++;
});
await mkdir("artifacts/vlr-publication", { recursive: true });
await writeFile("artifacts/vlr-publication/http.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
