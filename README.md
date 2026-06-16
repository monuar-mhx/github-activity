# 🔥 GitHub Activity Bot

An automated GitHub commit bot that runs on **Vercel Cron Jobs** to keep your GitHub contribution graph active. It generates realistic, meaningful commit messages and pushes them directly to your repository via the GitHub API — fully serverless, no server required.

---

## 🎯 Live Stats

<div align="center">

### 🔥 Contribution Streak

<img src="https://streak-stats.demolab.com?user=SudipMHX&theme=tokyonight&hide_border=true&background=0D1117&ring=00ffff&fire=00ffff&currStreakLabel=00ffff" alt="SudipMHX's GitHub Contribution Streak"/>

</div>

---

<div align="center">

### 📈 Contribution Activity

<img src="https://github-readme-activity-graph.vercel.app/graph?username=SudipMHX&theme=tokyo-night&hide_border=true&line=00ffff&point=ffffff&area=true" alt="SudipMHX's GitHub Contribution Activity Graph"/>

</div>

---

## 🚀 How It Works

```
Vercel Cron Job (scheduled)
    │
    ▼
POST /api/commit  ──►  Authenticate (CRON_SECRET)
    │
    ▼
Generate Activity  ──►  Random type, category, emoji, message, tags
    │
    ▼
GitHub API (Git Database)
    ├── Fetch current branch & tree
    ├── Append new activity entry to activity.ts & activity.js
    ├── Create new Git tree
    ├── Create new commit
    └── Update branch reference (fast-forward)
```

### Step-by-step flow

1. **Vercel triggers** the `/api/commit` endpoint on a schedule (4 times per day by default).
2. The request is **authenticated** using a `CRON_SECRET` token passed in the `Authorization: Bearer` header.
3. An **activity object** is randomly generated with fields like `type`, `category`, `message`, `emoji`, `environment`, and `tags` using the library in `lib/`.
4. The bot fetches the current contents of `activity.ts` and `activity.js` from GitHub, **appends the new activity entry** to both files.
5. Using GitHub's **Git Database API**, it creates a new tree, commits both files in a single commit, and updates the branch reference.
6. The commit message is formatted as: `{emoji} {type}: {message}` (e.g., `🚀 refactor: optimize repository performance`).

---

## 📁 Project Structure

```
github-activity/
├── api/
│   └── index.js          # Express app — handles the /api/commit route
├── lib/
│   ├── activityGenerator.js  # Generates a random Activity object
│   └── messageLibrary.js     # Pool of 50+ realistic commit messages
├── activity.ts           # TypeScript activity log (auto-updated by the bot)
├── activity.js           # JavaScript activity log (auto-updated by the bot)
├── vercel.json           # Vercel cron schedule & route rewrites
├── .env.example          # Environment variable template
└── package.json
```

---

## ⚙️ Setup & Deployment

### Prerequisites

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account
- Node.js `>= 18.x` (for local development)

---

### 1. Fork / Clone the Repository

```bash
git clone https://github.com/SudipMHX/github-activity.git
cd github-activity
```

### 2. Update Your Repository Config

Open `api/index.js` and update the `owner` and `repo` values on **lines 25–26** to match your own GitHub username and repository name:

```js
// api/index.js — lines 25-26
const owner = "SudipMHX";       // ← Change to your GitHub username
const repo  = "github-activity"; // ← Change to your repository name
```

> **Important:** If these values are not updated, the bot will commit to the original repository instead of yours.

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable       | Description                                                                 |
|----------------|-----------------------------------------------------------------------------|
| `GITHUB_TOKEN` | A GitHub Personal Access Token (PAT) with `repo` (or `contents:write`) scope |
| `CRON_SECRET`  | A secret string used to authenticate cron requests from Vercel              |

#### Generating a GitHub Token

1. Go to **GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens**
2. Create a new token with **Contents: Read & Write** permission for this repository
3. Copy the token and paste it as `GITHUB_TOKEN`

#### Generating a CRON_SECRET

Use any strong random string. You can generate one quickly:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 5. Deploy to Vercel

#### Option A — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

During setup, add your environment variables when prompted, or add them afterward via the Vercel dashboard.

#### Option B — Vercel Dashboard

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo.
3. In **Environment Variables**, add `GITHUB_TOKEN` and `CRON_SECRET`.
4. Deploy.

#### Add CRON_SECRET to Vercel

After deploying, add `CRON_SECRET` as an environment variable in the Vercel project dashboard. Vercel automatically injects this as the `Authorization: Bearer <CRON_SECRET>` header when invoking cron jobs.

---

### 6. Verify the Cron Schedule

The default schedule in `vercel.json` fires the bot **4 times daily** (UTC):

```json
"crons": [
  { "path": "/api/commit", "schedule": "0 15 * * *" },
  { "path": "/api/commit", "schedule": "0 17 * * *" },
  { "path": "/api/commit", "schedule": "0 19 * * *" },
  { "path": "/api/commit", "schedule": "0 21 * * *" }
]
```

> **Note:** Vercel Cron Jobs are only available on paid plans (Pro and above) for custom schedules. On the free Hobby plan, only a once-daily cron is supported.

You can edit the schedule using standard [cron syntax](https://crontab.guru/).

---

## 🔧 Local Development

```bash
npm run dev
```

This starts the Express server with `nodemon` on port `3000`. You can test the endpoint manually:

```bash
curl -X POST http://localhost:3000/api/commit \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

> Local runs still call the **GitHub API**, so real commits will be pushed. Make sure your `GITHUB_TOKEN` is valid and `.env` is configured.

---

## 📦 Activity Data Format

Each generated commit adds a new entry to both `activity.ts` and `activity.js`:

```ts
export interface Activity {
  id: string          // Unix timestamp ID
  type: string        // e.g., "refactor", "feature", "build"
  category: string    // e.g., "workflow", "performance", "infrastructure"
  message: string     // e.g., "optimize repository performance"
  emoji: string       // e.g., "🚀"
  author: string      // "SudipMHX"
  system: string      // "vercel-cron"
  status: string      // "success"
  environment: string // "production" | "staging" | "development"
  tags: string[]      // e.g., ["performance", "optimization"]
  timestamp: string   // Bangladesh time (UTC+6), format: "YYYY-MM-DD HH:MM:00"
}
```

---

## 🛡️ Security

- The `/api/commit` endpoint is **protected** — all requests must include the `Authorization: Bearer <CRON_SECRET>` header.
- Unauthorized requests receive a `401 Unauthorized` response.
- Your `GITHUB_TOKEN` and `CRON_SECRET` should **never be committed** to the repository. They are managed as Vercel environment variables.

---

## 📄 License

ISC © [Mahatab Hossen Sudip](https://github.com/SudipMHX)