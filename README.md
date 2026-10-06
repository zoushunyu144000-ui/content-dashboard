# Content Intelligence V0.1

Research desk for one project at a time. Pick a topic, watch a run move from keywords to insights, then review the videos and the patterns in them.

This is not the old multi-product content dashboard. Publishing, calendars, Drive, and Stripe are out of scope.

## Architecture

- **Next.js 14** app (`app/`, `components/`) talks only to its own HTTP API.
- **Postgres 16** holds projects, runs, videos, analyses, clusters, and ideas. Schema is applied on boot.
- **Built-in login** uses a signed `ci_session` cookie. There is no Supabase Auth.
- A **worker** inside the app process calls `POST /api/internal/research-tick` with `WORKER_SECRET`. Each tick advances one research step.
- **Scrapers**, in order: Apify TikTok, then TikHub TikTok when that fallback is enabled or the run starts there, then YouTube Shorts via yt-dlp. The run stores `scraper_provider` and, when it degrades, `scraper_note`.
- **AI** is an OpenAI-compatible HTTP API (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`). Keyword expansion, video analysis, insight merge, and content ideas all go through it. Video analysis reads `videos.transcript` when a subtitle download succeeded.

During normalizing, the pipeline downloads WebVTT for videos that have a subtitle URL (Apify `subtitleLinks[].downloadLink`, TikHub `caption_infos[].url`). It prefers `eng-US`, otherwise the first track, with concurrency 4 and an 8 second timeout. Failures are ignored. Viral rank does not exist until the next step, so every available track is fetched rather than a pre-score slice.

The feed plays a direct mp4 only while `video_url_expires_at` is still in the future. Otherwise it uses a TikTok embed (`/embed/v2/<id>`) or a YouTube embed (`/embed/<id>?playsinline=1&rel=0`).

## Environment

Names only. Put values in the runtime env file referenced by `docker-compose.yml`. Do not commit them.

Runtime:

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_RESET_PASSWORD`
- `SESSION_SECRET`
- `WORKER_SECRET`
- `AI_PROVIDER`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_BATCH_SIZE`
- `AI_ANALYSIS_LIMIT`
- `SCRAPER_PROVIDER`
- `APIFY_TOKEN`
- `APIFY_TIKTOK_ACTOR`
- `APIFY_MAX_RESULTS_PER_RUN`
- `APIFY_RESULTS_PER_KEYWORD`
- `APIFY_MAX_KEYWORDS_PER_RUN`
- `TIKHUB_API_KEY`
- `TIKHUB_BASE_URL`
- `TIKHUB_MAX_REQUESTS_PER_RUN`
- `TIKHUB_RESULTS_PER_REQUEST`
- `TIKHUB_REGION`
- `TIKHUB_AUTO_FALLBACK`
- `RESEARCH_WORKER`
- `RESEARCH_TICK_MS`
- `PORT`
- `HOSTNAME`

Build-time public:

- `NEXT_PUBLIC_BRAND_NAME`
- `NEXT_PUBLIC_APP_URL`

`SCRAPER_PROVIDER` may be `apify`, `tikhub`, `youtube`, or `auto`. `auto` starts at Apify. TikHub joins the automatic chain only when `TIKHUB_AUTO_FALLBACK` is on. YouTube Shorts is the last fallback and leaves likes, comments, shares, saves, followers, and publish time empty.

## Deploy

```bash
docker compose up -d --build
```

Postgres data and backups use the named volumes `content-intel-pgdata` and `content-intel-backups`.

## Login

On boot the app creates the admin user from the runtime values of `ADMIN_EMAIL` and `ADMIN_PASSWORD` when that email is missing. Sign in at `/login` with those credentials. Set `ADMIN_RESET_PASSWORD` to force a password overwrite on the next boot, then turn it off.
