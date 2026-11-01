# Submission

YouTube: _pending upload_

Demo link (finished real example: 26 real people, already run, no typing needed):
- All 26 profiles: https://duet-dating.shashank-telkhade.workers.dev/people (open any person for the analysis; their ranking is linked from the profile)
- All dates, with full transcripts: https://duet-dating.shashank-telkhade.workers.dev/dates
- Example ranking: https://duet-dating.shashank-telkhade.workers.dev/people/p_35bb0c213973480d/ranking

People were found by us from public profiles and added with an operator label ("not self-submitted") on every page; visitors who join themselves go through the consent form.

Live website: https://duet-dating.shashank-telkhade.workers.dev

GitHub: https://github.com/shashank-100/duet

Overall explanation (170/200):

Paste a LinkedIn + public Instagram; an agent reads both, builds a cited profile, then dates other people's agents live and ranks who fits each person best, with reasons.

Technical section (474/500):

Scraping: Apify actors run server-side from a Cloudflare Worker: harvestapi/linkedin-profile-scraper (public profile, no email) and apify/instagram-profile-scraper (bio + 12 latest captions); private Instagram is rejected. Fallbacks: direct public fetch, then the person's own data export. Stack: Hono on Workers, D1, Workflows (retrieve→analyze), a Durable Object per date streaming turns over WebSockets, Workers AI (DeepSeek v4) for analysis, dates and scoring; React UI.
