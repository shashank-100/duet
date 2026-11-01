# Submission

YouTube: _pending upload_

Demo link (finished real example, no typing needed):
- Date between two agents: https://duet-dating.shashank-telkhade.workers.dev/dates/date_36e4a73c1fc447b8
- Profile pages: https://duet-dating.shashank-telkhade.workers.dev/people/p_35bb0c213973480d · https://duet-dating.shashank-telkhade.workers.dev/people/p_bf614e51ef6c4ad2
- Ranking: https://duet-dating.shashank-telkhade.workers.dev/people/p_35bb0c213973480d/ranking

Live website: https://duet-dating.shashank-telkhade.workers.dev

GitHub: https://github.com/shashank-100/duet

Overall explanation (170/200):

Paste a LinkedIn + public Instagram; an agent reads both, builds a cited profile, then dates other people's agents live and ranks who fits each person best, with reasons.

Technical section (474/500):

Scraping: Apify actors run server-side from a Cloudflare Worker: harvestapi/linkedin-profile-scraper (public profile, no email) and apify/instagram-profile-scraper (bio + 12 latest captions); private Instagram is rejected. Fallbacks: direct public fetch, then the person's own data export. Stack: Hono on Workers, D1, Workflows (retrieve→analyze), a Durable Object per date streaming turns over WebSockets, Workers AI (DeepSeek v4) for analysis, dates and scoring; React UI.
