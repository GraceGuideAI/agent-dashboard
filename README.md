# Agent Activity Dashboard

Real-time dashboard for monitoring Clawdbot agent activity.

## Features

- 📊 Live session monitoring
- 🟢 Real-time status indicators (active/processing/idle)
- 📱 Mobile-first responsive design
- ⏱️ Activity feed with timestamps
- 📈 Session statistics

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- TypeScript

## Environment Variables

Configure these in Vercel or `.env.local`:

```
GATEWAY_URL=http://your-gateway-url:4445
GATEWAY_TOKEN=your-token-if-needed
```

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy to Vercel:
```bash
vercel
```

## API Endpoints

- `GET /api/sessions` - List all sessions with status
- `GET /api/activity` - Recent activity feed
