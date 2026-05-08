# Relatably

Daily synchronized opinion ritual for Gen Z. One question per day at a globally-random moment, free-text answers aggregate into a live wordcloud, and the first person to call the eventual #1 answer is crowned "most relatable on Earth."

**Status:** Design phase. Implementation has not started.

## Design

The full v1.0 design specification lives at:

- [`docs/superpowers/specs/2026-05-08-relatably-design.md`](docs/superpowers/specs/2026-05-08-relatably-design.md)

That document is the single source of truth for product, UX, technical architecture, monetization, growth strategy, and kill criteria.

## Stack (planned)

- iOS client: Expo (React Native)
- Backend: Next.js 16 on Vercel
- Database: Supabase (Postgres + Realtime + Auth)
- Cache: Upstash Redis
- Push: Expo Push Service
- Ads: Google AdMob
- Analytics: PostHog
- Crash: Sentry
- Install attribution: Branch.io

## Owner

Levin Schwab — built under existing Nebengewerbe.
