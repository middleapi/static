import * as fs from "node:fs/promises";
import { defineConfig, tierPresets } from "sponsorkit";

interface JSONSponsor {
  provider: string;
  login: string;
  name: string | null;
  avatar: string;
  amount: number;
  link: string;
  type: "User" | "Organization";
  createdAt?: string;
  tierTitle: string;
  tierTitlePlural: string;
  tierLevel: number;
  [extra: string]: unknown;
}

const OVERRIDES: Record<string, Partial<JSONSponsor>> = {
  "github:screenshotone": {
    description: "The screenshot API for developers",
    link: "https://screenshotone.com",
    background: { light: "#f7f5ff", dark: "#303147" },
    orpc: { slot: 1, rel: "" },
  },
  "github:sanmurakami": {
    name: "MisskeyHQ",
    avatar: "https://github.com/MisskeyIO.png",
    description: "Decentralized microblogging SNS born on Earth",
    link: "https://misskey.io",
    background: { light: "#f8faf0", dark: "#313a2e" },
    orpc: { slot: 2, rel: "sponsored" },
  },
};

function withTracking(link: string): string {
  try {
    const url = new URL(link);
    const hasTracking = [...url.searchParams.keys()].some(
      (key) => key === "ref" || key.startsWith("utm_"),
    );
    if (!hasTracking) {
      url.searchParams.set("ref", "middleapi");
      url.searchParams.set("utm_source", "middleapi");
      url.searchParams.set("utm_medium", "sponsor");
    }
    return url.toString();
  } catch {
    return link;
  }
}

const TIERS = [
  {
    title: "Past Sponsors",
    titleSingular: "Past Sponsor",
    monthlyDollars: -1,
    preset: {
      avatar: { size: 20 },
      boxWidth: 22,
      boxHeight: 22,
      container: { sidePadding: 35 },
    },
  },
  {
    title: "Backers",
    titleSingular: "Backer",
    preset: tierPresets.small,
  },
  {
    title: "Sponsors",
    titleSingular: "Sponsor",
    monthlyDollars: 10,
    preset: tierPresets.base,
  },
  {
    title: "Organization Sponsors",
    titleSingular: "Organization Sponsor",
    monthlyDollars: 50,
    preset: tierPresets.medium,
  },
  {
    title: "Premium Sponsors",
    titleSingular: "Premium Sponsor",
    monthlyDollars: 200,
    preset: tierPresets.large,
  },
  {
    title: "Special Sponsors",
    titleSingular: "Special Sponsor",
    monthlyDollars: 750,
    preset: tierPresets.xl,
  },
];

export default defineConfig({
  tiers: TIERS,

  providers: ["github", "opencollective"],

  sponsorsAutoMerge: true,

  includePastSponsors: true,

  async onSponsorsReady(sponsors) {
    const json: JSONSponsor[] = sponsors
      .filter((entry) => entry.privacyLevel !== "PRIVATE")
      .map((entry) => {
        const provider = entry.provider || "github";
        const login = entry.sponsor.login;
        const override = OVERRIDES[`${provider}:${login}`.toLowerCase()];

        const tierLevel =
          TIERS.length -
          1 -
          TIERS.slice()
            .reverse()
            .findIndex(
              (tier) => entry.monthlyDollars >= (tier.monthlyDollars ?? 0),
            );
        const tier = TIERS[tierLevel];

        if (!tier) {
          throw new Error(
            `Could not determine tier for sponsor ${login} with monthly amount ${entry.monthlyDollars}`,
          );
        }

        const profileUrl = provider.startsWith("opencollective")
          ? `https://opencollective.com/${encodeURIComponent(login)}`
          : `https://github.com/${encodeURIComponent(login)}`;
        const link = withTracking(
          override?.link ||
            entry.sponsor.websiteUrl ||
            entry.sponsor.linkUrl ||
            profileUrl,
        );

        // Make the rendered image use the same link
        entry.sponsor.websiteUrl = link;
        entry.sponsor.linkUrl = link;

        return {
          provider: provider,
          login: login,
          name: entry.sponsor.name,
          avatar: entry.sponsor.avatarUrl,
          amount: entry.monthlyDollars,
          type: entry.sponsor.type,
          createdAt: entry.createdAt,
          tierTitle: tier.titleSingular,
          tierTitlePlural: tier.title,
          tierLevel: tierLevel,
          ...override,
          link: link,
        } satisfies JSONSponsor;
      })
      .sort((a, b) => {
        const amountDiff = b.amount - a.amount;
        if (amountDiff !== 0) {
          return amountDiff;
        }

        const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdAtA - createdAtB;
      });

    await fs.writeFile("sponsors.json", `${JSON.stringify(json, null, 2)}\n`);
  },

  outputDir: ".",
  formats: ["svg"],
  renderer: "tiers",
});
