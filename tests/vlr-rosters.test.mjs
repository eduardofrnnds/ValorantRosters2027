import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { vlrSnapshot } from "../src/features/rosters/data/vlr-snapshot.ts";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";
import { localPlayers, localPlayerMemberships } from "../src/features/players/data/local-players.ts";
import { localRosterEntries } from "../src/features/rosters/data/local-roster.ts";

test("snapshot cobre as 32 equipes, preserva identidades e não inventa contratos", () => {
  assert.deepEqual(vlrSnapshot.teams.map(team => team.organizationId).sort(), vct2027.organizations.map(team => team.id).sort());
  assert.equal(new Set(localPlayers.map(player => player.id)).size, localPlayers.length);
  assert.equal(new Set(localPlayers.map(player => player.slug)).size, localPlayers.length);
  assert.equal(localPlayers.length, localRosterEntries.length);
  assert.deepEqual(localPlayerMemberships, []);
  for (const entry of localRosterEntries) {
    const player = localPlayers.find(player => player.id === entry.player.id);
    assert.equal(entry.organizationId, player.rosterObservation.organizationId);
    assert.equal(entry.status, player.rosterObservation.status);
    assert.equal(entry.publicationStatus, "published");
  }
});

test("reservas e inativos do VLR não se tornam titulares", () => {
  assert.equal(localRosterEntries.find(entry => entry.player.nickname === "sheydos").status, "inactive");
  assert.equal(localRosterEntries.find(entry => entry.player.nickname === "Chaza").status, "reserve");
  assert.equal(localRosterEntries.find(entry => entry.player.nickname === "Ewok").status, "coach");
  for (const slug of ["gam-esports", "crazy-raccoon"]) {
    const organization = vct2027.organizations.find(team => team.slug === slug);
    assert.equal(localRosterEntries.filter(entry => entry.organizationId === organization.id).length, 0);
  }
});

test("todas as fotos referenciadas existem e correspondem ao manifesto da fonte", () => {
  const manifest = JSON.parse(readFileSync(new URL("../docs/VLR_PLAYER_ASSETS.json", import.meta.url), "utf8"));
  for (const player of localPlayers.filter(player => player.photoUrl)) {
    const photo = manifest.photos.find(photo => photo.playerId === player.id);
    assert.equal(photo.localPath, player.photoUrl);
    const bytes = readFileSync(new URL(`../public${player.photoUrl}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), photo.sha256);
  }
});
