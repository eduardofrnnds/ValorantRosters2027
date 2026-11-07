import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";

// Explicit maintenance command only. The application serves the downloaded files.
const sourcePage = "https://www.vlr.gg/778768/all-vct-2027-partnered-teams-confirmed/";
const aliases = { "kru-esports": "kr-esports", leviatan: "leviat-n" };
async function read(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  assert.ok(response.ok, `${url}: HTTP ${response.status}`);
  return response;
}
const article = await (await read(sourcePage)).text();
const paths = [...new Set([...article.matchAll(/href="(\/team\/\d+\/[^"?#]+)"/g)].map((match) => match[1]))];
await mkdir("public/images/teams", { recursive: true });
const assets = [];
for (const organization of vct2027.organizations) {
  const slug = aliases[organization.slug] ?? organization.slug;
  const path = paths.find((path) => path.split("/").at(-1) === slug);
  assert.ok(path, `Missing team page: ${organization.name}`);
  const pageURL = `https://www.vlr.gg${path}`;
  const html = await (await read(pageURL)).text();
  const header = html.match(/class="wf-avatar team-header-logo"[\s\S]*?<img\s+src="([^"]+)"/);
  assert.ok(header, `Missing team logo: ${organization.name}`);
  const imageURL = new URL(header[1], pageURL).href;
  assert.equal(new URL(imageURL).hostname, "owcdn.net");
  const response = await read(imageURL);
  assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const localPath = `/images/teams/${organization.slug}.png`;
  await writeFile(`public${localPath}`, buffer);
  assets.push({ organizationId: organization.id, name: organization.name, pageURL, imageURL, localPath, sha256: createHash("sha256").update(buffer).digest("hex"), bytes: buffer.length });
  console.log(`${organization.name}: ${buffer.length} bytes`);
}
await writeFile("docs/VLR_ASSETS.json", JSON.stringify({ retrievedAt: new Date().toISOString(), sourcePage, assets }, null, 2) + "\n");
console.log(`Downloaded ${assets.length} verified PNG logos.`);
