# Edison Dev Portfolio & CyberStack AI

Welcome to the official development repository for **Edison Isaza**, a Senior Software Engineer specializing in Full Stack Development, Cybersecurity, and Financial Algorithms.

This project features **CyberStack**, an advanced AI Assistant designed to represent Edison professionally. It uses a custom **"Neural Activation"** architecture to allow the AI to act as an expert consultant, dynamically pulling context from LinkedIn and GitHub.

## 🚀 Key Features

### 🤖 CyberStack AI Agent
*   **Expert Persona**: A specialized AI assistant that acts as a third-party expert representing Edison. It answers questions about his skills, experience, and services with high precision.
*   **Neural Activation**: Powered by `src/app/utils/expert_persona.xml`, ensuring strict adherence to the expert persona and minimizing hallucinations.
*   **Dynamic Context**:
    *   **GitHub**: Fetches real-time project data from `editech-dev/editech-dev`.
    *   **LinkedIn**: Injects detailed verified experience from `src/data/profile.json`.
*   **Chat Memory**: Full conversation history persistence using Redis.
*   **Resilient answers**: The chat retries once on transient Gemini errors and never leaves an empty answer; tool calls (project views, repositories) run between model turns.
*   **Single model, compact context**: The chat always uses `gemini-flash-lite-latest`. Each message carries a compact portfolio context (descriptions and a short README preview per repository, about 15,000 tokens); full READMEs are fetched on demand by a tool.
*   **Tool Calling**: The agent can execute function calls to fetch profile data, repository lists, README content, and page view counts in real time.

### 📄 Interactive CV / Resume
*   **Bilingual**: Toggle between Spanish and English with smooth Framer Motion transitions.
*   **Export**: Print-to-PDF or download a professionally designed two-column PDF generated server-side via `@react-pdf/renderer` (`/api/cv-pdf?lang=es|en`).
*   **ATS-Optimized**: Structured data from `src/data/cv-profile.json` ensures compatibility with automated resume screening systems.

### 🌐 Bilingual Repository System
*   **AI-Powered Translation**: Repository descriptions and READMEs are automatically translated between Spanish and English using Gemini Flash Lite.
*   **Multi-Layer Caching**: Translated content is cached in Redis (30-day TTL) and backed by a static fallback file (`src/data/bilingual-repos-fallback.json`).
*   **Change Detection**: The system detects content alterations and re-translates only when the original text has changed.

### 📊 Real-time Analytics
*   **View Counter**: Each project page tracks unique visitors via cookie-based UUID, stored in Redis with deduplication.
*   **Cache Revalidation**: View increments trigger `revalidatePath` to keep the repositories list and detail pages up to date.
*   **Compact Display**: View counts are formatted with `Intl.NumberFormat` compact notation (e.g., 1.2K).

### ⚡ Tech Stack
*   **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion.
*   **Styling**: Tailwind CSS v4 with custom CSS modules, Geist Sans/Mono fonts, forced dark mode.
*   **AI Core**: Google Gemini through the always-current alias `gemini-flash-lite-latest` (SDK `@google/genai`, API `v1beta`), for both the chat and the repository translations.
*   **Database & Cache**: Redis (chat logs, GitHub API cache, view counters, CV profile cache) with automatic in-memory fallback.
*   **PDF Generation**: `@react-pdf/renderer` for server-side professional CV/resume PDF.
*   **Markdown Rendering**: `react-markdown` + `remark-gfm` for chat message formatting.
*   **SEO**: Dynamic Sitemap (`sitemap.ts`), Robots.txt (`robots.ts`), JSON-LD Person Schema, Open Graph metadata, canonical URLs.
*   **Testing**: Vitest + React Testing Library + jsdom.
*   **Language**: TypeScript 5.
*   **Package Manager & Runtime**: [Bun](https://bun.sh) 1.4 — installs dependencies, runs scripts and runs Next.js and the Vercel Functions (`bunVersion` in `vercel.json`). New package versions are quarantined for 48 hours (`bunfig.toml`).
*   **Linting**: ESLint with `eslint-config-next` (`bun run lint`).

## 🗺️ Page Routes

| Route | Description |
|---|---|
| `/` | Home page with Neural Activation particles background, name title, and navigation |
| `/cv` | Interactive bilingual CV/Resume with toggle and PDF export/download |
| `/contact` | Contact page with LinkedIn, Email, and GitHub cards |
| `/repositories` | List of public GitHub repositories with descriptions, stars, languages, and view counts |
| `/repositories/[repoName]` | Repository detail page with README, bilingual toggle, and live view counter |

## 🛠️ Architecture

### 1. The Expert Brain (`src/app/utils/expert_persona.xml`)
The core of the agent is defined in an XML file that mimics "neural instructions". This file dictates:
*   **Identity**: "Professional Assistant for Edison Isaza".
*   **Prime Directive**: Always speak in the third person ("Edison has...", "He is...").
*   **Context Slots**: Placeholders `{{PROFILE_CONTEXT}}` and `{{GITHUB_CONTEXT}}` are injected at runtime.

### 2. Context API (`src/app/api/agent-context/route.ts`)
This endpoint constructs the system prompt dynamically on every request:
1.  Fetches public repos from GitHub.
2.  Reads profile from Redis (with `cv-profile.json` local fallback).
3.  Injects both into `expert_persona.xml`.
4.  Returns the compiled "Brain" to the chat interface.

### 3. Chat API (`src/app/api/chat/route.ts`)
Handles streaming chat responses with function-calling capabilities:
*   **Primary**: Google Gemini Flash Lite via `@google/genai` SDK with streaming, tool declarations, and automatic function call execution loops (max 5 iterations).
*   **Failure handling**: one retry on 503/429 before the answer starts; if it still fails the API answers `503` with a readable message, and a stream that breaks midway ends with a visible notice.
*   **Tools**: `getProfileInfo`, `getGithubRepos`, `getRepositoryReadme`, `getProjectViews` — defined in `src/app/utils/chatbot_tools.ts`.

### 4. Persistent Memory (`src/app/api/log-chat/route.ts`)
Every conversation turn is automatically logged to Redis.
*   **Log Chat**: `POST /api/log-chat`
*   **List Chats**: `GET /api/chats` (protected by `ADMIN_API_TOKEN` Bearer auth)
*   **View Chat**: `GET /api/chats/[id]` (protected by `ADMIN_API_TOKEN`)

### 5. CV PDF Generation (`src/app/api/cv-pdf/route.ts`)
Generates a professionally designed two-column PDF on the server:
*   Accepts `?lang=es|en` query parameter.
*   Reads profile from Redis/cv-profile.json, loads the photo from `public/`, and renders via `@react-pdf/renderer`.
*   Returns PDF as downloadable attachment with language-appropriate filename.

### 6. Data Caching Layer (`src/app/utils/github.ts`)
Visitors never wait for GitHub or Gemini: pages read cached data, and refreshing happens in the background.
*   **Read path**: `/repositories`, repository pages, the sitemap and `/api/agent-context` read the snapshot `github:repos:public:snapshot` from Redis — even when stale — or, if there is none, the static fallback `src/data/bilingual-repos-fallback.json`. GitHub is only queried (with a 2.5 s timeout) for a single repository that is unknown everywhere.
*   **Background refresh**: when the snapshot is older than 1 hour, a refresh is scheduled with Next.js `after()`, guarded by a Redis lock. It fetches GitHub, translates only new or changed text and saves a new snapshot. A failed translation is never stored: the previous version is kept and the snapshot is retried in 5 minutes.
*   **Bilingual Cache**: Per-repo keys `github:repo:bilingual:{name}` store translated descriptions and READMEs (30-day TTL).
*   **README Filtering**: Only repos with READMEs >= 100 characters are displayed.
*   **Translation Pipeline**: `src/app/utils/translation.ts` uses Gemini Flash Lite for language detection and translation with exponential backoff retry (up to 3 retries for rate limits).
*   **Redis resilience**: `src/app/utils/redis.ts` falls back to an in-memory store when Redis is missing or failing, bounds every command to 2 s and retries the connection after a 30 s cooldown.

### 7. Real-time Analytics (`src/app/api/views/[slug]`)
Tracks page views for each project repository with deduplicated unique visitor counting.
*   **Storage**: Redis integer keys (`views:{slug}`) with Set-based dedup (`viewed:{slug}`) per user.
*   **Client**: `ViewCounter` component uses cookie-persisted UUIDs (`uniqueId`) for visitor identification.
*   **Mechanism**:
    *   `POST /api/views/[slug]`: Increments view count and triggers Next.js `revalidatePath`.
    *   `GET /api/views/[slug]`: Returns current view count.

### 8. Redis Client with In-Memory Fallback (`src/app/utils/redis.ts`)
The Redis client includes a complete in-memory mock layer that activates automatically when Redis is unreachable (2-second connection timeout). This ensures local development and preview deployments work seamlessly without a Redis instance.

## 📂 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── agent-context/    # Dynamic context generation (XML + GitHub + Profile)
│   │   ├── chat/             # Streaming chat with Gemini (gemini-flash-lite-latest) + tool calling
│   │   ├── chats/            # Chat history retrieval (admin-protected)
│   │   │   └── [id]/         # Single chat detail
│   │   ├── cv-pdf/           # Professional PDF CV generation (@react-pdf/renderer)
│   │   ├── log-chat/         # Chat logging endpoint (to Redis)
│   │   └── views/
│   │       └── [slug]/       # View counter (POST increment + GET fetch)
│   ├── components/
│   │   ├── Card/             # Glassmorphic card with mouse-tracking gradient (Framer Motion)
│   │   ├── ChatBot/          # CyberStack chat widget (streaming, markdown)
│   │   ├── Contact/          # Contact page with social link cards
│   │   ├── CvPage/           # Interactive bilingual CV + professional PDF component
│   │   ├── HomePage/         # Landing page layout
│   │   ├── MainPartiles/     # Home page hero with particle background
│   │   ├── Mdx/              # Custom MDX components for README rendering
│   │   ├── NavHomePage/      # Home page navigation bar (Projects, CV, Contact)
│   │   ├── Navigation/       # Global sticky nav with smart back button (IntersectionObserver)
│   │   ├── Particles/        # Canvas-based shell code rain particle effect
│   │   └── Repositories/     # Repository list, detail, bilingual toggle, view counter
│   ├── contact/              # /contact page
│   ├── cv/                   # /cv page
│   ├── repositories/         # /repositories page
│   │   └── [repoName]/       # /repositories/[repoName] dynamic detail page (SSG + ISR)
│   ├── utils/
│   │   ├── chatbot_tools.ts   # Gemini function-calling tool declarations and execution
│   │   ├── expert_persona.xml # Neural Activation System Prompt
│   │   ├── github.ts          # GitHub API Fetcher + Bilingual Translation Pipeline
│   │   ├── mouse.ts           # Mouse position tracking hook
│   │   ├── redis.ts           # Redis Client + In-Memory Fallback + View Counter
│   │   └── translation.ts     # AI-powered language detection + translation (Gemini)
│   ├── globals.css            # Forced dark theme, custom animations (glow, fade, title)
│   ├── layout.tsx             # Root layout with SEO metadata, JSON-LD, ChatBot, skip-to-content
│   ├── robots.ts              # Dynamic robots.txt generation
│   └── sitemap.ts             # Dynamic sitemap.xml with static + GitHub repository routes
└── data/
    ├── profile.json                  # Static Professional Profile (LinkedIn source)
    ├── cv-profile.json               # Detailed bilingual CV (bilingual sections)
    └── bilingual-repos-fallback.json  # Static translation fallback for repositories
```

## 🧪 Testing

The project uses **Vitest** with React Testing Library and jsdom for unit and integration tests.

```bash
bun run test          # Run tests in watch mode
bun run test:run      # Single run
bun run test:coverage # With coverage report
bun run lint          # ESLint
bun run tsc --noEmit  # Type check
```

**Test files**:
- `src/app/api/chats/route.test.ts`
- `src/app/api/cv-pdf/route.test.ts`
- `src/app/components/Card/card.test.tsx`
- `src/app/components/ChatBot/ChatBotComponent.test.tsx`
- `src/app/components/CvPage/CvClientPage.test.tsx`
- `src/app/components/Repositories/ViewCounter.test.tsx`
- `src/app/repositories/[repoName]/page.test.tsx`
- `src/app/utils/github.test.ts`
- `src/app/utils/redis.test.ts`

## 📦 Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/editech-dev/edison-dev.git
    cd edison-dev
    ```

2.  **Install dependencies** with [Bun](https://bun.sh) (the project pins `bun@1.4.4` via the `packageManager` field):
    ```bash
    bun install --frozen-lockfile
    ```
    Dependency lifecycle scripts are blocked (`trustedDependencies` is empty) and versions published less than 48 hours ago are rejected (`bunfig.toml`).

3.  **Start the local Redis** (Docker) and fill it with synthetic data. Outside production the app always uses this local Redis (`redis://127.0.0.1:6399`) and never the `REDIS_URL` of `.env.local`; only Vercel production (`VERCEL_ENV=production`) reads `REDIS_URL`:
    ```bash
    bun run redis:up     # docker compose: Redis 7 on 127.0.0.1:6399 with a persistent volume
    bun run redis:seed   # synthetic view counters and fake chats (refuses non-local hosts)
    ```
    If Docker is not running, the app falls back to an in-memory store.

4.  **Configure Environment**:
    Create a `.env.local` file with:
    ```env
    # Required
    GEMINI_API_KEY=your_gemini_key
    GITHUB_TOKEN=your_github_token
    GITHUB_REPO_OWNER=editech-dev

    # Optional
    GEMINI_API_KEY_DEV=your_dev_gemini_key     # Optional: used instead of GEMINI_API_KEY outside production
    REDIS_URL=your_production_redis_url        # Only read in Vercel production
    REDIS_DEV_URL=redis://127.0.0.1:6399       # Optional: another local Redis, or `memory` to disable it
    ADMIN_API_TOKEN=your_admin_token           # Protects /api/chats endpoints
    NEXT_PUBLIC_BASE_URL=https://editech.dev   # Used for sitemap, robots.txt, OG metadata
    ```

5.  **Run Development Server**:
    ```bash
    bun run dev
    ```

6.  **Access the App**:
    Open [http://localhost:3002](http://localhost:3002). The CyberStack chat widget will be available globally.

## 📊 API Documentation

### Chat & AI

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/chat` | `POST` | None | Streaming chat with Gemini (`gemini-flash-lite-latest`) and tool calling. Body: `{ messages, systemInstruction }` |
| `/api/agent-context` | `GET` | None | Returns compiled system prompt with live GitHub data + CV profile injected |
| `/api/log-chat` | `POST` | None | Persists chat session to Redis. Body: `{ messages, timestamp, chatId? }` |
| `/api/chats` | `GET` | `Bearer ADMIN_API_TOKEN` | Lists all chat sessions with metadata (id, timestamp, preview) |
| `/api/chats/{id}` | `GET` | `Bearer ADMIN_API_TOKEN` | Retrieves a single chat session by ID |

### CV / PDF

| Endpoint | Method | Description |
|---|---|---|
| `/api/cv-pdf?lang=es\|en` | `GET` | Generates and downloads a professionally designed two-column ATS-optimized PDF resume |

### Analytics

| Endpoint | Method | Description |
|---|---|---|
| `/api/views/{slug}` | `POST` | Increments view count for a repository (deduplicated by cookie `uniqueId`). Body: `{ uniqueId }`. Triggers Next.js `revalidatePath` |
| `/api/views/{slug}` | `GET` | Returns current view count for a repository |

## 🚑 Troubleshooting

### Migration from pnpm to Bun

Until November 2026 the project used pnpm 11 through Corepack. The pinned `pnpm@11.12.0` was later retracted as a broken release (`ERR_PNPM_BROKEN_PNPM_RELEASE`), and pnpm 11 had already required an explicit `allowBuilds` list in `pnpm-workspace.yaml` plus `ENABLE_EXPERIMENTAL_COREPACK=1` on Vercel. The project now uses Bun:

*   `bun.lock` replaces `pnpm-lock.yaml` (migrated with the same resolved versions) and `pnpm-workspace.yaml` is gone.
*   Install scripts stay blocked: none of the four packages that pnpm used to approve (`@google/genai`, `esbuild`, `protobufjs`, `sharp`) needs its script — Bun installs their platform binaries as optional dependencies.
*   Corepack is not used with Bun; the `ENABLE_EXPERIMENTAL_COREPACK` variable is no longer needed on Vercel.

### `/repositories` intermittently failed in production

**Symptom**: `/repositories` sometimes failed through Cloudflare/Vercel and sometimes worked. Vercel logged `Task timed out after 10 seconds` on `/repositories` and `/api/agent-context`.

**Root cause**: whenever the 1-hour Redis cache expired, the visitor's request downloaded the repository list and every README from GitHub and translated them sequentially with Gemini (which often answered 503 under load), exceeding the function limit. A single Redis error also disabled Redis for the rest of the instance's life, so every following request rebuilt everything.

**Fix**: see *Data Caching Layer* above — reads come from a (possibly stale) snapshot or the static fallback, the refresh runs in the background with `after()`, and Redis recovers after failures. Unknown repositories now return a real 404.

## 📄 License

This project is licensed under the **MIT License**.
You are free to use, modify, and distribute this software for your own projects. See the [LICENSE](LICENSE) file for more details.

---
Built with ❤️ by [Edison Isaza](https://www.linkedin.com/in/edison-isaza/)
