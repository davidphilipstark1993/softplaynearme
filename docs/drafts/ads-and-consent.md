# Ads, consent and privacy: what's needed before AdSense can serve in the UK

Status on 27 Nov 2026, from the code in this repository. This is a checklist for you. Nothing
here has been changed on the live site.

## ads.txt: done, nothing to do

`public/ads.txt` already holds the site's real publisher line:

```
google.com, pub-1521157758368352, DIRECT, f08c47fec0942fa0
```

It matches the `ca-pub-1521157758368352` client in `app/layout.tsx`, so no placeholder is
needed. Check that `https://www.softplaynearme.co.uk/ads.txt` returns it as plain text, and
that AdSense > Sites shows "Authorised" once the site is approved.

## Consent: missing, and a blocker for UK/EEA ads

- **What Google requires:** to serve ads to users in the UK, EEA or Switzerland, a site
  must use a Google-certified consent management platform (CMP) that integrates with the
  IAB Transparency & Consent Framework v2.2. Without one, AdSense serves no ads (or only
  limited ads) to those users, which is nearly all of this site's audience.
- **What the site does now:** there is no cookie banner and no CMP. The AdSense script
  (`app/layout.tsx`, `<head>`) and Google Analytics 4 (`G-LELV01QR3Z`, `afterInteractive`)
  load on every page before any choice. Under UK PECR, analytics and advertising cookies
  need consent first, AdSense or not.
- **Simplest fix: AdSense's own CMP.** In AdSense, go to *Privacy & messaging > European
  regulations*, create a GDPR message for softplaynearme.co.uk and publish it. It's free,
  certified, and loads through the AdSense tag already on the page. It also needs:
  1. **Google Consent Mode v2** defaults set *before* gtag/AdSense load, e.g. an inline
     script at the top of `<head>`:
     `gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 })`.
     The CMP updates these when the visitor chooses.
  2. GA4 keeps its tag, but runs in consent mode (cookieless pings until consent).
  3. A "Privacy & cookie settings" link in the footer that reopens the message.
- **Alternatives:** any other Google-certified CMP (e.g. Cookiebot, Usercentrics,
  OneTrust, Didomi, Quantcast Choices). Check Google's current certified list before
  choosing. The code changes are the same: load the CMP first, consent defaults, footer link.

When you choose, the code change is small: a consent-default script in `app/layout.tsx`,
the CMP tag, a footer link. I can make it once you've picked which CMP to use.

## Privacy policy: needs an advertising section

`app/privacy/page.tsx` covers Google Analytics and owner data well, but it doesn't mention
advertising, even though the AdSense script is live. Add, roughly:

> **Advertising.** We show ads served by Google AdSense. Google and its partners use cookies
> to serve ads based on your visits to this and other websites, and to measure ads. You can
> choose whether to allow personalised ads in our cookie settings, and opt out of
> personalised advertising at Google's Ad Settings (adssettings.google.com). How Google uses
> information from sites that use its services: policies.google.com/technologies/partner-sites.

Also update the **Cookies** paragraph. It currently says you can "control cookie settings
through your browser preferences". It should point to the consent message and say that
analytics and advertising cookies are only set with consent.

## Before reapplying (2–3 months after deploying the content changes)

- [ ] Phase 2 deployed; DB migrations phase18-01 and phase18-02 run; `npm run data:rebuild`
- [ ] CMP live and tested from a UK IP (message shows; no ad/analytics cookies before consent)
- [ ] Privacy policy updated; About, methodology and corrections pages published from the drafts
- [ ] Search Console: sitemap resubmitted; "Crawled – currently not indexed" trending down
- [ ] Spot-check the 20 URLs in reports/adsense-phase2-verification.md
