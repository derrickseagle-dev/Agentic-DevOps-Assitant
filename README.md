# PipelineForge

**AI-powered CI/CD automation for engineering teams.** Ship faster with fewer misconfigurations — PipelineForge uses AI agents to generate, manage, and execute CI/CD pipelines while keeping humans in the loop at critical checkpoints.

## Features

- **AI Pipeline Generation** — Analyze your repo and generate optimized pipeline configurations
- **Visual DAG Editor** — Drag-and-drop pipeline stage editor with React Flow
- **Human-in-the-Loop Checkpoints** — Approval gates that pause deployments until a human signs off
- **Deployment Tracking** — Complete history of what was deployed, when, and by whom
- **GitHub Integration** — OAuth login, repo connection, Check Runs, and commit statuses
- **Email Notifications** — Alerts for checkpoint approvals, run failures, and deployments

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, React Router v6, React Flow, Recharts |
| Backend | Hono (Node.js), TypeScript, Drizzle ORM |
| Database | PostgreSQL (Neon) / SQLite (local dev) |
| Auth | GitHub OAuth, JWT |
| Integrations | Octokit (GitHub API), OpenAI SDK, Resend (email) |
| Runtime | Bun |

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your GitHub OAuth credentials, database URL, etc.

# Run database migrations
bun run db:migrate

# Start development servers (backend + frontend)
bun run dev

# Start the background worker (pipeline execution)
bun run dev:worker
```

The frontend dev server runs on `http://localhost:5173` with API requests proxied to the backend on port `3001`.

## Architecture

For a complete architectural overview — including data model, API design, pipeline execution model, and beta milestones — see [ARCHITECTURE.md](/home/team/shared/ARCHITECTURE.md) in the team shared directory.

## Project Structure

```
pipelineforge/
├── src/
│   ├── frontend/        # React + Vite app
│   │   └── src/
│   │       ├── components/  # UI components (layout, pipeline editor, etc.)
│   │       ├── routes/      # Page components
│   │       ├── hooks/       # Custom React hooks
│   │       └── lib/         # API client, utilities
│   ├── backend/         # Hono API server
│   │   └── src/
│   │       ├── routes/      # API route handlers
│   │       ├── middleware/  # Auth, team-scoping
│   │       ├── services/    # Business logic (pipeline executor, AI generator)
│   │       └── db/          # Drizzle schema & migrations
│   └── shared/          # Shared types and Zod schemas
├── worker/              # Background pipeline execution worker
└── package.json
```

## License

Proprietary — all rights reserved.
