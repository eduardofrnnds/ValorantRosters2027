import type { VctCatalog } from "@/types/vct";

// Manually curated snapshot. Sources and naming decisions: docs/DADOS_VCT_2027.md.
// Local UUIDs were assigned once; preserve them through renames and future seeds.
export const DEFAULT_SEASON_YEAR = 2027;

export const vct2027Sources = {
  checkedAt: "2026-11-03",
  announcedAt: "2026-10-22",
  riot: "https://valorantesports.com/en-US/valorantesports/news/introducing-the-vct-2027-partner-teams",
  organizations: "https://escharts.com/news/partner-teams-vct-2027",
} as const;

export const vct2027: VctCatalog = {
  "regions": [
    {
      "id": "americas",
      "slug": "americas",
      "name": "Americas"
    },
    {
      "id": "emea",
      "slug": "emea",
      "name": "EMEA"
    },
    {
      "id": "china",
      "slug": "china",
      "name": "China"
    },
    {
      "id": "pacific",
      "slug": "pacific",
      "name": "Pacific"
    }
  ],
  "seasons": [
    {
      "id": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "year": 2027,
      "name": "VCT 2027"
    }
  ],
  "organizations": [
    {
      "id": "bc09f5d6-4183-4ca4-80aa-065d060f1e1a",
      "name": "100 Thieves",
      "slug": "100-thieves",
      "logoUrl": "/images/teams/100-thieves.png"
    },
    {
      "id": "7858bce3-351a-446b-a79d-375a974f8f99",
      "name": "G2 Esports",
      "slug": "g2-esports",
      "logoUrl": "/images/teams/g2-esports.png"
    },
    {
      "id": "44ebc860-dd2b-44b1-8d0c-631d8bf75c7f",
      "name": "KRÜ Esports",
      "slug": "kru-esports",
      "logoUrl": "/images/teams/kru-esports.png"
    },
    {
      "id": "ff5c5425-4a70-4a4e-adde-fdbf2bc87a37",
      "name": "Leviatán",
      "slug": "leviatan",
      "logoUrl": "/images/teams/leviatan.png"
    },
    {
      "id": "501f7832-68d7-4163-811e-197f4fc22f0e",
      "name": "LOUD",
      "slug": "loud",
      "logoUrl": "/images/teams/loud.png"
    },
    {
      "id": "17603c5f-b7c3-4140-8411-f28391935538",
      "name": "MIBR",
      "slug": "mibr",
      "logoUrl": "/images/teams/mibr.png"
    },
    {
      "id": "d281e0f5-7505-4102-a028-047e244e0ead",
      "name": "NRG",
      "slug": "nrg",
      "logoUrl": "/images/teams/nrg.png"
    },
    {
      "id": "77732b62-ae24-42df-a739-8bb1d278e7b2",
      "name": "Sentinels",
      "slug": "sentinels",
      "logoUrl": "/images/teams/sentinels.png"
    },
    {
      "id": "826ec70e-f97a-447b-9ca0-be92f06bbf9e",
      "name": "BBL Esports",
      "slug": "bbl-esports",
      "logoUrl": "/images/teams/bbl-esports.png"
    },
    {
      "id": "11457405-202c-4e18-b668-3d69e52c93b6",
      "name": "Fnatic",
      "slug": "fnatic",
      "logoUrl": "/images/teams/fnatic.png"
    },
    {
      "id": "ba47982b-4a5c-4aad-a66d-648b17e3a35f",
      "name": "FUT Esports",
      "slug": "fut-esports",
      "logoUrl": "/images/teams/fut-esports.png"
    },
    {
      "id": "e4b6c65c-11d5-4c90-a60b-80b4c095360e",
      "name": "Gentle Mates",
      "slug": "gentle-mates",
      "logoUrl": "/images/teams/gentle-mates.png"
    },
    {
      "id": "5e83018f-0657-4e98-a323-19eddd488c84",
      "name": "Karmine Corp",
      "slug": "karmine-corp",
      "logoUrl": "/images/teams/karmine-corp.png"
    },
    {
      "id": "380f264d-a23d-43de-b0b6-2ad3ec6c8ade",
      "name": "Team Heretics",
      "slug": "team-heretics",
      "logoUrl": "/images/teams/team-heretics.png"
    },
    {
      "id": "600b275b-af04-4189-b129-4ab6a0698058",
      "name": "Team Liquid",
      "slug": "team-liquid",
      "logoUrl": "/images/teams/team-liquid.png"
    },
    {
      "id": "7401e259-1703-4042-827f-44998e0864ed",
      "name": "Team Vitality",
      "slug": "team-vitality",
      "logoUrl": "/images/teams/team-vitality.png"
    },
    {
      "id": "6a9b903f-6b40-4826-b049-a41ce34d4847",
      "name": "All Gamers",
      "slug": "all-gamers",
      "logoUrl": "/images/teams/all-gamers.png"
    },
    {
      "id": "552c7d64-53cc-45ab-bad2-b203400550d4",
      "name": "Bilibili Gaming",
      "slug": "bilibili-gaming",
      "logoUrl": "/images/teams/bilibili-gaming.png"
    },
    {
      "id": "4cec387f-0f3c-4486-9ddf-ccf7e1251d05",
      "name": "EDward Gaming",
      "slug": "edward-gaming",
      "logoUrl": "/images/teams/edward-gaming.png"
    },
    {
      "id": "0d17b910-8c1c-4093-b022-120339af26e4",
      "name": "JD Gaming",
      "slug": "jd-gaming",
      "logoUrl": "/images/teams/jd-gaming.png"
    },
    {
      "id": "fdcd8718-23a6-4cb9-bf51-5f0fc3653da1",
      "name": "Trace Esports",
      "slug": "trace-esports",
      "logoUrl": "/images/teams/trace-esports.png"
    },
    {
      "id": "14c9539d-ab64-451b-9b3a-94ef763a9ffd",
      "name": "TYLOO",
      "slug": "tyloo",
      "logoUrl": "/images/teams/tyloo.png"
    },
    {
      "id": "407cd5ad-3029-4149-b130-b3158f490b09",
      "name": "Weibo Gaming",
      "slug": "weibo-gaming",
      "logoUrl": "/images/teams/weibo-gaming.png"
    },
    {
      "id": "9cfd944b-c060-463e-bb58-ec29f941e1b9",
      "name": "Xi Lai Gaming",
      "slug": "xi-lai-gaming",
      "logoUrl": "/images/teams/xi-lai-gaming.png"
    },
    {
      "id": "d69a5c62-0741-4f5c-a5be-2bb6d053457d",
      "name": "Crazy Raccoon",
      "slug": "crazy-raccoon",
      "logoUrl": "/images/teams/crazy-raccoon.png"
    },
    {
      "id": "43ba390f-fe04-47e4-a6f8-dc8db0109e1e",
      "name": "FULL SENSE",
      "slug": "full-sense",
      "logoUrl": "/images/teams/full-sense.png"
    },
    {
      "id": "113c81cc-2f0a-4094-8d94-97992fd02ef4",
      "name": "GAM Esports",
      "slug": "gam-esports",
      "logoUrl": "/images/teams/gam-esports.png"
    },
    {
      "id": "469284d0-f5f9-48f0-8f04-7ae87168d727",
      "name": "Gen.G",
      "slug": "gen-g",
      "logoUrl": "/images/teams/gen-g.png"
    },
    {
      "id": "2525e270-5e18-44dd-91ea-5ba12c337115",
      "name": "Paper Rex",
      "slug": "paper-rex",
      "logoUrl": "/images/teams/paper-rex.png"
    },
    {
      "id": "715c5ff6-27f1-4854-8194-4fdbb49cb02b",
      "name": "Rex Regum Qeon",
      "slug": "rex-regum-qeon",
      "logoUrl": "/images/teams/rex-regum-qeon.png"
    },
    {
      "id": "641a0757-4c65-479e-ac26-1482a8cd51bb",
      "name": "T1",
      "slug": "t1",
      "logoUrl": "/images/teams/t1.png"
    },
    {
      "id": "524c67bf-38d9-4cd8-875e-5f89b639a614",
      "name": "ZETA DIVISION",
      "slug": "zeta-division",
      "logoUrl": "/images/teams/zeta-division.png"
    }
  ],
  "teamSeasons": [
    {
      "organizationId": "bc09f5d6-4183-4ca4-80aa-065d060f1e1a",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "americas",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "7858bce3-351a-446b-a79d-375a974f8f99",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "americas",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "44ebc860-dd2b-44b1-8d0c-631d8bf75c7f",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "americas",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "ff5c5425-4a70-4a4e-adde-fdbf2bc87a37",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "americas",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "501f7832-68d7-4163-811e-197f4fc22f0e",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "americas",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "17603c5f-b7c3-4140-8411-f28391935538",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "americas",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "d281e0f5-7505-4102-a028-047e244e0ead",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "americas",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "77732b62-ae24-42df-a739-8bb1d278e7b2",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "americas",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "826ec70e-f97a-447b-9ca0-be92f06bbf9e",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "emea",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "11457405-202c-4e18-b668-3d69e52c93b6",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "emea",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "ba47982b-4a5c-4aad-a66d-648b17e3a35f",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "emea",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "e4b6c65c-11d5-4c90-a60b-80b4c095360e",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "emea",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "5e83018f-0657-4e98-a323-19eddd488c84",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "emea",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "380f264d-a23d-43de-b0b6-2ad3ec6c8ade",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "emea",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "600b275b-af04-4189-b129-4ab6a0698058",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "emea",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "7401e259-1703-4042-827f-44998e0864ed",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "emea",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "6a9b903f-6b40-4826-b049-a41ce34d4847",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "china",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "552c7d64-53cc-45ab-bad2-b203400550d4",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "china",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "4cec387f-0f3c-4486-9ddf-ccf7e1251d05",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "china",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "0d17b910-8c1c-4093-b022-120339af26e4",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "china",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "fdcd8718-23a6-4cb9-bf51-5f0fc3653da1",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "china",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "14c9539d-ab64-451b-9b3a-94ef763a9ffd",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "china",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "407cd5ad-3029-4149-b130-b3158f490b09",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "china",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "9cfd944b-c060-463e-bb58-ec29f941e1b9",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "china",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "d69a5c62-0741-4f5c-a5be-2bb6d053457d",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "pacific",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "43ba390f-fe04-47e4-a6f8-dc8db0109e1e",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "pacific",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "113c81cc-2f0a-4094-8d94-97992fd02ef4",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "pacific",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "469284d0-f5f9-48f0-8f04-7ae87168d727",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "pacific",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "2525e270-5e18-44dd-91ea-5ba12c337115",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "pacific",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "715c5ff6-27f1-4854-8194-4fdbb49cb02b",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "pacific",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "641a0757-4c65-479e-ac26-1482a8cd51bb",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "pacific",
      "partnerStatus": "partner"
    },
    {
      "organizationId": "524c67bf-38d9-4cd8-875e-5f89b639a614",
      "seasonId": "d8cbeae7-23ec-48a6-a5de-6c7f10785d1d",
      "regionId": "pacific",
      "partnerStatus": "partner"
    }
  ]
};
