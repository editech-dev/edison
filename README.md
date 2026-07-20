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
*   **AI Fallback**: If Gemini fails, the chat API automatically falls back to **OpenRouter** (with the same Gemini Flash model).
*   **Dual AI Mode**: Users can switch between **Cloud AI** (Gemini Flash) and **Local AI** (Chrome's built-in Gemini Nano) directly in the chat widget.
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
*   **AI Core**: Google Gemini Flash Lite (using Google Generative AI SDK `@google/genai`). Optional fallback via OpenRouter.
*   **Database & Cache**: Redis (chat logs, GitHub API cache, view counters, CV profile cache) with automatic in-memory fallback.
*   **PDF Generation**: `@react-pdf/renderer` for server-side professional CV/resume PDF.
*   **Markdown Rendering**: `react-markdown` + `remark-gfm` for chat message formatting.
*   **SEO**: Dynamic Sitemap (`sitemap.ts`), Robots.txt (`robots.ts`), JSON-LD Person Schema, Open Graph metadata, canonical URLs.
*   **Testing**: Vitest + React Testing Library + jsdom.
*   **Language**: TypeScript 5.
*   **Package Manager**: pnpm 11.12.0 (pinned via Corepack).

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
*   **Fallback**: If Gemini fails (e.g., missing API key), automatically falls back to OpenRouter with SSE streaming.
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
To ensure speed and avoid GitHub API rate limits, the agent's knowledge of your projects is cached.
*   **Mechanism**: `src/app/utils/redis.ts` handles generic caching with automatic in-memory Map fallback when Redis is unavailable.
*   **Cache Key**: `github:repos:public:bilingual` stores the filtered, translated repository list (1-hour TTL).
*   **Bilingual Cache**: Per-repo keys `github:repo:bilingual:{name}` store translated descriptions and READMEs (30-day TTL).
*   **README Filtering**: Only repos with READMEs >= 100 characters are displayed.
*   **Translation Pipeline**: `src/app/utils/translation.ts` uses Gemini Flash Lite for language detection and translation with exponential backoff retry (up to 3 retries for rate limits).

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
│   │   ├── chat/             # Streaming chat with Gemini + OpenRouter fallback + tool calling
│   │   ├── chats/            # Chat history retrieval (admin-protected)
│   │   │   └── [id]/         # Single chat detail
│   │   ├── cv-pdf/           # Professional PDF CV generation (@react-pdf/renderer)
│   │   ├── log-chat/         # Chat logging endpoint (to Redis)
│   │   └── views/
│   │       └── [slug]/       # View counter (POST increment + GET fetch)
│   ├── components/
│   │   ├── Card/             # Glassmorphic card with mouse-tracking gradient (Framer Motion)
│   │   ├── ChatBot/          # CyberStack chat widget (Cloud/Local AI toggle, streaming, markdown)
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
pnpm test          # Run tests in watch mode
pnpm test:run      # Single run
pnpm test:coverage # With coverage report
```

**Test files**:
- `src/app/api/chats/route.test.ts`
- `src/app/api/cv-pdf/route.test.ts`
- `src/app/components/Card/card.test.tsx`
- `src/app/components/ChatBot/ChatBotComponent.test.tsx`
- `src/app/components/CvPage/CvClientPage.test.tsx`
- `src/app/components/Repositories/ViewCounter.test.tsx`

## 🤖 AI Agent Development Workflow

The project uses a multi-agent architecture for development via OpenCode, with 5 specialized subagents and 12 skill packs.

### Subagents

| Agent | Role | Mode |
|---|---|---|
| `ui-ux-designer` | Tailwind CSS layouts, Framer Motion animations, responsive design | Read/Write |
| `a11y-auditor` | WCAG 2.2 Level AA compliance, ARIA, keyboard nav, screen readers | Read/Write |
| `test-engineer` | Vitest + React Testing Library unit/integration tests | Read/Write |
| `security-auditor` | Dependency vulnerability auditing (`pnpm audit`) | **ReadOnly** |
| `git-manager` | Git staging, Conventional Commits generation | Read/Write |

### Skill Packs (12 installed)

| Skill | Source | Purpose |
|---|---|---|
| `next-best-practices` | vercel-labs/next-skills | RSC, App Router, data patterns, error handling |
| `react-best-practices` | vercel-labs/agent-skills | Rendering optimization, bundle, server/client patterns |
| `composition-patterns` | vercel-labs/agent-skills | Compound components, render props, context, variants |
| `next-cache-components` | vercel-labs/next-skills | PPR, use cache directive, cacheLife, cacheTag |
| `tailwind-css-patterns` | giuseppe-trisciuoglio/developer-kit | Responsive design, layout, spacing, typography |
| `frontend-design` | anthropics/skills | Premium design & aesthetics |
| `typescript-advanced-types` | wshobson/agents | Generics, conditional types, mapped types |
| `accessibility` | addyosmani/web-quality-skills | WCAG 2.2 audit patterns |
| `seo` | addyosmani/web-quality-skills | Meta tags, structured data, sitemap |
| `next-upgrade` | vercel-labs/next-skills | Next.js version migration guides |
| `nodejs-best-practices` | sickn33/antigravity-awesome-skills | Async patterns, security, architecture |
| `nodejs-backend-patterns` | wshobson/agents | Express/Fastify middleware, error handling, auth |

## 📦 Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/editech-dev/edison-dev.git
    cd edison-dev
    ```

2.  **Enable Corepack and install dependencies** (pnpm only — the project pins `pnpm@11.12.0` via the `packageManager` field):
    ```bash
    corepack enable
    pnpm install
    ```

3.  **Configure Environment**:
    Create a `.env.local` file with:
    ```env
    # Required
    GEMINI_API_KEY=your_gemini_key
    GITHUB_TOKEN=your_github_token
    GITHUB_REPO_OWNER=editech-dev

    # Optional
    REDIS_URL=redis://localhost:6379           # Falls back to in-memory store if missing
    OPENROUTER_API_KEY=your_openrouter_key     # Fallback if Gemini fails
    ADMIN_API_TOKEN=your_admin_token           # Protects /api/chats endpoints
    NEXT_PUBLIC_BASE_URL=https://editech.dev   # Used for sitemap, robots.txt, OG metadata
    ```

4.  **Run Development Server**:
    ```bash
    pnpm dev
    ```

5.  **Access the App**:
    Open [http://localhost:3002](http://localhost:3002). The CyberStack chat widget will be available globally.

## 📊 API Documentation

### Chat & AI

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/chat` | `POST` | None | Streaming chat with Gemini (primary) or OpenRouter (fallback). Body: `{ messages, systemInstruction }` |
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

### Vercel production build fails with `ERR_PNPM_IGNORED_BUILDS`

**Symptom** (observed 2026-07-19): Preview deployments built successfully, but Production deployments died during dependency installation, before `next build` even started:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @google/genai@2.12.0, esbuild@0.28.1, protobufjs@7.6.5, sharp@0.34.5
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
Error: Command "pnpm install" exited with 1
```

**Root cause** — two factors combined:

1. **pnpm 11 breaking changes.** The repo pins `packageManager: pnpm@11.12.0`. In pnpm 11, `strictDepBuilds` defaults to `true`: any dependency shipping lifecycle scripts (`preinstall`/`postinstall`/`install`) that has not been explicitly approved or denied makes `pnpm install` exit with code 1. pnpm 11 also **removed** the legacy settings (`onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoredBuiltDependencies`, …) and **no longer reads configuration from `package.json` (`pnpm` field) or `.npmrc`/`.pnpmrc`** (those files are auth/registry-only now). Consequently, former fix attempts — a `pnpm.onlyBuiltDependencies` field, a `.pnpmrc` file, and a `PNPM_ONLY_BUILT_DEPENDENCIES` Vercel env var — were all silently ignored.
2. **Vercel environment divergence.** `ENABLE_EXPERIMENTAL_COREPACK=1` was configured for the **Production** environment only, so Production resolved the pinned pnpm 11.12.0 through Corepack. Preview had no such variable, so Vercel fell back to pnpm 9.x, which executes dependency build scripts by default — hence "works in Preview, fails in Production".

**Fix applied**:

1. **`pnpm-workspace.yaml`** (repo root) explicitly approves the four dependencies that ship install scripts, satisfying `strictDepBuilds`:
    ```yaml
    allowBuilds:
      "@google/genai": true
      esbuild: true
      protobufjs: true
      sharp: true
    ```
2. **`ENABLE_EXPERIMENTAL_COREPACK=1` enabled for all Vercel environments** (Production, Preview, Development) so every deployment installs with the same pinned pnpm version.
3. **Removed the dead `PNPM_ONLY_BUILT_DEPENDENCIES` env var** from Vercel (ignored by pnpm 11).

**Rejected alternatives**:

*   `strictDepBuilds: false` — the install passes, but the scripts still do not run, leaving `sharp`/`esbuild` potentially degraded at runtime.
*   `dangerouslyAllowAllBuilds: true` — works, but disables pnpm 11's supply-chain protection entirely.
*   Downgrading to pnpm 10 — loses the version pin and security posture for no real gain.

**References**: [pnpm 11 release notes](https://github.com/pnpm/pnpm/releases/tag/v11.0.0) · [pnpm `allowBuilds` setting](https://pnpm.io/settings#allowbuilds) · [pnpm `strictDepBuilds` setting](https://pnpm.io/settings#strictdepbuilds) · [Vercel Corepack support](https://vercel.com/docs/deployments/configure-a-build#corepack)

## 📄 License

This project is licensed under the **MIT License**.
You are free to use, modify, and distribute this software for your own projects. See the [LICENSE](LICENSE) file for more details.

---
Built with ❤️ by [Edison Isaza](https://www.linkedin.com/in/edison-isaza/)
