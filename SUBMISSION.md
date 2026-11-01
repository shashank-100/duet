# Submission

Live website: https://duet-dating.shashank-telkhade.workers.dev

Demo: https://duet-dating.shashank-telkhade.workers.dev/demo (fictional; verify completion before submission)

GitHub: https://github.com/shashank-100/duet

YouTube: pending

Overall explanation (180/200):

Duet turns LinkedIn and public Instagram profiles into cited agent personas, lets those agents date in live conversations, and ranks compatibility with evidence and clear unknowns.

Technical section (410/500):

React + TypeScript frontend; Hono on Cloudflare Workers with D1, Workflows and Durable Objects. Server-side Apify actors harvestapi/linkedin-profile-scraper and apify/instagram-profile-scraper retrieve public profile text and Instagram captions. Private Instagram accounts are rejected. Analysis cites only the two profiles; credentials stay in Worker secrets. Workers AI drives analysis, dates and evaluation.

Real-person example: pending verified same-person links, source retrieval, and completed simulation. Do not present the fictional demo as that example.
