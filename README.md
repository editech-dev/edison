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

### ⚡ Tech Stack
*   **Frontend**: Next.js 16 (App Router), Tailwind CSS, Framer Motion.
*   **AI Core**: Google Gemini Flash Lite (via Google Generative AI SDK).
*   **Database**: Redis (for chat logs).
*   **SEO**: Dynamic Sitemap, Robots.txt, JSON-LD Schema, and Open Graph Metadata.
*   **Language**: TypeScript.

## 🛠️ Architecture

### 1. The Expert Brain (`src/app/utils/expert_persona.xml`)
The core of the agent is defined in an XML file that mimics "neural instructions". This file dictates:
*   **Identity**: "Professional Assistant for Edison Isaza".
*   **Prime Directive**: Always speak in the third person ("Edison has...", "He is...").
*   **Context Slots**: Placeholders `{{PROFILE_CONTEXT}}` and `{{GITHUB_CONTEXT}}` are injected at runtime.

### 2. Context API (`src/app/api/agent-context/route.ts`)
This endpoint constructs the system prompt dynamically on every request:
1.  Fetches public repos from GitHub.
2.  Reads `src/data/profile.json`.
3.  Injects both into `expert_persona.xml`.
4.  Returns the compiled "Brain" to the chat interface.

### 3. Persistent Memory (`src/app/api/log-chat/route.ts`)
Every conversation turn is automatically logged to Redis.
*   **List Chats**: `GET /api/chats`
*   **View Chat**: `GET /api/chats/[id]`

### 4. Data Caching Layer (`src/app/utils/github.ts`)
To ensure speed and avoid GitHub API rate limits, the agent's knowledge of your projects is cached.
*   **Mechanism**: `src/app/utils/redis.ts` handles generic caching.
*   **Key**: `github:repos:public` stores the filtered repository list.
*   **TTL**: Data is refreshed every hour (3600s).

### 5. Real-time Analytics (`src/app/api/views/[slug]`)
Tracks page views for each project repository in real-time.
*   **Storage**: Redis Integer Keys (`views:{slug}`).
*   **Mechanism**:
    *   `incrementView`: Called via client-side API on page load.
    *   `getMultipleViews`: Fetched server-side to display counts on the landing page.

## 📂 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── agent-context/   # Dynamic context generation (XML + GitHub + Profile)
│   │   ├── chats/           # Chat history retrieval APIs
│   │   └── log-chat/        # Chat logging endpoint (to Redis)
│   ├── components/
│   │   └── ChatBot/         # React Chat Widget (Powered by Gemini)
│   └── utils/
│       ├── expert_persona.xml # Neural Activation Prompt
│       ├── github.ts          # GitHub API Fetcher + Cache
│       └── redis.ts           # Redis Client & Helpers
└── data/
    └── profile.json         # Static Professional Profile Data (LinkedIn source)
```

## 📦 Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/editech-dev/edison-dev.git
    cd edison-dev
    ```

2.  **Install dependencies** (pnpm only — the project pins `pnpm@11.12.0` via the `packageManager` field; enable [Corepack](https://nodejs.org/api/corepack.html) with `corepack enable` to use the exact pinned version automatically):
    ```bash
    pnpm install
    ```

3.  **Configure Environment**:
    Create a `.env.local` file with:
    ```env
    NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_key
    GITHUB_TOKEN=your_github_token
    GITHUB_REPO_OWNER=editech-dev
    REDIS_URL=redis://localhost:6379 (optional, defaults to local)
    ```

4.  **Run Development Server**:
    ```bash
    pnpm dev
    ```

5.  **Access the App**:
    Open [http://localhost:3000](http://localhost:3000). The CyberStack chat widget will be available globally.

## 📊 API Documentation

### Get Chat History
Returns a list of all stored conversation sessions.
```http
GET /api/chats
```

### Get Single Chat
Returns the full message history for a specific session ID.
```http
GET /api/chats/{chatId}
```

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
