import * as fs from 'node:fs/promises';
import { defineConfig, tierPresets } from 'sponsorkit';

type SidebarPlacementSize = 'normal' | 'small' | 'none';

interface JSONSponsor {
  name: string | null;
  login: string;
  avatar: string;
  amount: number;
  link: string;
  org: boolean;
  createdAt?: string;

  tierTitle: string;
  tierLevel: number;
  sidebarSize: SidebarPlacementSize;
  sidebarLogo: string;
}

/**
 * Per-sponsor customizations.
 *
 * If you meet requirements and want to show a custom logo in the sidebar,
 * add a `sidebarLogo` entry here with the URL of that logo.
 *
 * You can host logos in the /assets directory and reference them via:
 *   https://cdn.jsdelivr.net/gh/middleapi/static/assets/<your-logo>
 *
 * @example
 * ```ts
 *  const SPONSOR_CUSTOMIZATIONS = {
 *    'sponsor-login': {
 *       link: 'https://your-website.com', // Optional custom link for the sponsor
 *       sidebarLogo: 'https://cdn.jsdelivr.net/gh/middleapi/static/assets/YourLogo.png', // Custom logo for sidebar
 *     }
 * }
 * ```
 */
const SPONSOR_CUSTOMIZATIONS: Record<string, Partial<JSONSponsor>> = {
  screenshotone: {
    sidebarLogo:
      'https://cdn.jsdelivr.net/gh/middleapi/static/assets/ScreenshotOne_TextLogo.svg',
  },
  sanmurakami: {
    sidebarLogo:
      'https://cdn.jsdelivr.net/gh/middleapi/static/assets/MisskeyHQ_TextLogo.png',
  },
  zuplo: {
    link: 'https://zuplo.link/orpc',
  },
};

const BRONZE_TIER_THRESHOLD = 100;
const SILVER_TIER_THRESHOLD = 200;
const GOLD_TIER_THRESHOLD = 500;
const PLATINUM_TIER_THRESHOLD = 1000;

const TIERS = [
  {
    title: 'Past Sponsors',
    monthlyDollars: -1,
    preset: {
      avatar: { size: 20 },
      boxWidth: 22,
      boxHeight: 22,
      container: { sidePadding: 35 },
    },
  },
  {
    title: 'Backers',
    preset: tierPresets.small,
  },
  {
    title: 'Sponsors',
    monthlyDollars: 10,
    preset: tierPresets.base,
  },
  {
    title: 'Generous Sponsors',
    monthlyDollars: 50,
    preset: tierPresets.medium,
  },
  {
    title: '🥉 Bronze Sponsor',
    monthlyDollars: BRONZE_TIER_THRESHOLD,
    preset: tierPresets.large,
  },
  {
    title: '🥈 Silver Sponsor',
    monthlyDollars: SILVER_TIER_THRESHOLD,
    preset: tierPresets.xl,
  },
  {
    title: '🥇 Gold Sponsor',
    monthlyDollars: GOLD_TIER_THRESHOLD,
    preset: {
      avatar: { size: 90 * 1.4 },
      boxWidth: 120 * 1.4,
      boxHeight: 130 * 1.4,
      container: { sidePadding: 20 * 1.4 },
      name: { maxLength: 20 * 1.4 },
    },
  },
  {
    title: '🏆 Platinum Sponsor',
    monthlyDollars: PLATINUM_TIER_THRESHOLD,
    preset: {
      avatar: { size: 90 * 1.8 },
      boxWidth: 120 * 1.6,
      boxHeight: 130 * 1.6,
      container: { sidePadding: 20 * 1.6 },
      name: { maxLength: 20 * 1.6 },
    },
  },
];

export default defineConfig({
  tiers: TIERS,

  async onSponsorsReady(sponsors) {
    const json: JSONSponsor[] = sponsors
      .filter((sponsorEntry) => sponsorEntry.privacyLevel !== 'PRIVATE')
      .map((sponsorEntry) => {
        const customization = Object.entries(SPONSOR_CUSTOMIZATIONS).find(
          ([customLogin]) =>
            customLogin.toLocaleLowerCase() ===
            sponsorEntry.sponsor.login.toLocaleLowerCase(),
        )?.[1];

        const expiredAt = sponsorEntry.expireAt
          ? new Date(sponsorEntry.expireAt)
          : sponsorEntry.isOneTime && sponsorEntry.createdAt
            ? new Date(
                new Date(sponsorEntry.createdAt).setMonth(
                  new Date().getMonth() + 1,
                ),
              )
            : undefined;

        const isExpired = expiredAt ? expiredAt < new Date() : false;

        const sidebarSize =
          isExpired || !customization?.sidebarLogo
            ? 'none'
            : sponsorEntry.monthlyDollars >= SILVER_TIER_THRESHOLD
              ? 'normal'
              : sponsorEntry.monthlyDollars >= BRONZE_TIER_THRESHOLD
                ? 'small'
                : 'none';

        const profileUrl = `https://github.com/${encodeURIComponent(sponsorEntry.sponsor.login)}`;
        const canUseCustomOrWebsiteLink =
          sponsorEntry.monthlyDollars >= BRONZE_TIER_THRESHOLD;
        const link = canUseCustomOrWebsiteLink
          ? customization?.link ||
            sponsorEntry.sponsor.websiteUrl ||
            sponsorEntry.sponsor.linkUrl ||
            profileUrl
          : profileUrl;

        const tierLevel =
          TIERS.length -
          1 -
          TIERS.slice()
            .reverse()
            .findIndex(
              (tier) =>
                sponsorEntry.monthlyDollars >= (tier.monthlyDollars || 0),
            );
        const tier = TIERS[tierLevel];

        if (!tier) {
          throw new Error(
            `Could not determine tier for sponsor ${sponsorEntry.sponsor.login} with monthly amount ${sponsorEntry.monthlyDollars}`,
          );
        }

        return {
          name: customization?.name || sponsorEntry.sponsor.name,
          login: sponsorEntry.sponsor.login,
          avatar: customization?.avatar || sponsorEntry.sponsor.avatarUrl,
          amount: sponsorEntry.monthlyDollars,
          createdAt: sponsorEntry.createdAt,
          tierTitle: tier.title,
          tierLevel: tierLevel,
          link: link,
          org: sponsorEntry.sponsor.type === 'Organization',
          sidebarSize: sidebarSize,
          sidebarLogo:
            customization?.sidebarLogo || sponsorEntry.sponsor.avatarUrl,
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

    await fs.writeFile('sponsors.json', `${JSON.stringify(json, null, 2)}\n`);
  },

  outputDir: '.',
  formats: ['svg', 'png'],
  renderer: 'tiers',
});
