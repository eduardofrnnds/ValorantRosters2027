import { z } from "zod";
import data from "./vlr-rosters.json" with { type: "json" };

const sourceUrl = z.url().refine((url) => new URL(url).hostname === "www.vlr.gg");
const member = z.object({
  id: z.string().regex(/^vlr-\d+$/),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  nickname: z.string().min(1), name: z.string().optional(), nationality: z.string().optional(),
  photoUrl: z.string().regex(/^\/images\/players\/vlr-\d+\.(png|jpg|webp)$/).optional(),
  status: z.enum(["starter", "reserve", "inactive", "coach"]),
  sourceLabel: z.string().optional(), sourceUrl,
});

export const vlrSnapshot = z.object({
  checkedAt: z.iso.datetime(),
  teams: z.array(z.object({ organizationId: z.uuid(), name: z.string(), sourceUrl, members: z.array(member) })),
}).parse(data);
