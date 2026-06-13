# AI Research Agent

Multi-agent research assistant powered by OpenAI.

## Features
- 6 specialized agents: Search, RAG, Summarization, Fact-check, Citation, Report
- Document ingestion (PDF / TXT drag & drop)
- APA 7th edition citation generation
- Full structured research report output

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your OpenAI API key
Edit `.env.local`:
```
OpenAI_API_KEY=your_key_here
```
Get your key at git https://platform.openai.com/api-keys

### 3. Run the dev server
```bash
npm run dev
```

Open http://localhost:3000

## Project structure
```
app/
  page.jsx           ← Main UI (React)
  page.module.css    ← Styles
  layout.jsx         ← Root layout
  api/
    claude/
      route.js       ← Anthropic API proxy route
.env.local           ← Your API key (never commit this)
```

## Tech stack
- Next.js 14 (App Router)
- React 18
- OpenAI Key
