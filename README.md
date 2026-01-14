# Deposition Prep Tools Demo

**AI-powered witness testimony and deposition preparation tools.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black)](https://nextjs.org)
[![Case.dev](https://img.shields.io/badge/Case.dev-Powered-blue)](https://case.dev)

> Built on the [Create Legal App](https://github.com/CaseMark/create-legal-app) starter kit.

## Overview

This demo application showcases AI-powered legal preparation tools:

- **Testimony Prep Tool**: Prepare witnesses for cross-examination with AI-generated questions based on case documents. Practice with an AI examiner that provides real-time feedback.

- **Deposition Prep Tool** (Coming Soon): Strategic deposition planning with document analysis, gap identification, and question outline generation.

## Features

### Testimony Prep Tool

1. **Document Upload**: Upload case documents (PDF, DOCX, TXT) for analysis
2. **AI Question Generation**: Generate 20 challenging cross-examination questions based on document content
3. **Interactive Practice Mode**: Practice answering questions with an AI examiner
4. **Real-time Feedback**: Get instant feedback on responses with suggested improvements
5. **Session Review**: Review your practice history and performance

### Demo Limits

This demo version includes the following usage limits:

| Limit Type | Value |
|------------|-------|
| Session duration | 24 hours |
| Price per session | $5.00 |
| Max documents per session | 20 |
| Max file size | 10 MB |

**Pricing**: $0.0005 per 1,000 characters processed (~$0.50 per million characters)

**Disabled Features:**
- Bulk upload
- Advanced export
- Premium features

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com) + [Shadcn UI](https://ui.shadcn.com) (Maia Theme)
- **Icons**: [Phosphor Icons](https://phosphoricons.com)
- **Storage**: localStorage (client-side, no database required)
- **AI**: [Case.dev API](https://case.dev) (LLM + OCR)

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd witness-testimony-prep-demo
npm install
# or
bun install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Add your Case.dev API key:

```env
# .env.local
CASE_API_KEY=your-api-key-here
```

Get your API key from [Case.dev](https://case.dev).

### 3. Run Development Server

```bash
npm run dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── testimony/          # Testimony prep API routes
│   │   │   ├── generate-questions/
│   │   │   ├── practice/
│   │   │   └── ocr/
│   │   └── deposition/         # Deposition prep API routes
│   ├── layout.tsx              # Root layout with DemoBanner
│   └── page.tsx                # Tool selector page
├── components/
│   ├── demo/                   # Demo-specific UI components
│   │   ├── DemoBanner.tsx
│   │   ├── UsageMeter.tsx
│   │   ├── LimitWarning.tsx
│   │   └── UpgradeCTA.tsx
│   ├── testimony/              # Testimony prep components
│   │   └── TestimonyPrepTool.tsx
│   └── ui/                     # Shadcn UI components
├── lib/
│   ├── case-dev/               # Case.dev API client
│   │   └── api.ts
│   ├── demo-limits/            # Demo limit configuration
│   │   ├── config.ts
│   │   ├── token-limit-service.ts
│   │   ├── ocr-limit-service.ts
│   │   └── feature-gate.ts
│   ├── storage/                # localStorage services
│   │   ├── session-storage.ts
│   │   ├── deposition-storage.ts
│   │   └── usage-storage.ts
│   └── types/                  # TypeScript types
│       ├── testimony.ts
│       ├── deposition.ts
│       └── demo-limits.ts
└── skills/                     # AI agent documentation
```

## Key Differences from Production

This demo version differs from the full production app in several ways:

1. **Storage**: Uses localStorage instead of Case.dev Vaults
2. **Authentication**: Anonymous sessions (no user accounts required)
3. **Rate Limits**: Enforced demo limits on tokens and OCR usage
4. **Features**: Some advanced features are disabled

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CASEDEV_API_KEY` | Yes | Case.dev API key for LLM and OCR |
| `DEMO_TOKENS_PER_REQUEST` | No | Override default token limit per request |
| `DEMO_TOKENS_PER_SESSION` | No | Override default session token limit |
| `DEMO_TOKENS_PER_DAY` | No | Override default daily token limit |

See [.env.example](.env.example) for all available options.

## API Routes

### Testimony Prep

- `POST /api/testimony/generate-questions` - Generate cross-examination questions
- `POST /api/testimony/practice` - Submit practice response and get AI feedback
- `POST /api/testimony/ocr` - Process document with OCR

### Deposition Prep

- `POST /api/deposition/generate-questions` - Generate deposition questions

## License

This project is licensed under the [Apache 2.0 License](LICENSE).

## Contact

For unlimited access and custom integrations, contact [Case.dev](https://case.dev).
