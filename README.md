# Topstep Tracker Dashboard

A unified dashboard for tracking Topstep trading combines, spending, and payouts all in one place.

## Features

- Single dashboard view with combines, spending, and payouts
- Real-time data fetching from Gmail
- Summary cards showing key metrics (total earned, total spent, net profit)
- Three-column layout with detailed tables
- Dark mode design
- Google OAuth authentication

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Gmail API
4. Create OAuth 2.0 credentials (OAuth Consent Screen > Create Credentials > OAuth 2.0 Client ID)
5. Set authorized redirect URIs to `http://localhost:3000/api/auth/callback/google`
6. Copy your Client ID and Client Secret

### 3. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXTAUTH_SECRET=generate_a_random_string_here
NEXTAUTH_URL=http://localhost:3000
```

To generate a random secret:
```bash
openssl rand -base64 32
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
topstep-dashboard/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.js    # NextAuth configuration
│   │   ├── combines/route.js              # Combines API
│   │   ├── spending/route.js              # Spending API
│   │   └── payouts/route.js               # Payouts API
│   ├── layout.js                          # Root layout
│   ├── page.js                            # Main dashboard
│   ├── providers.js                       # NextAuth provider
│   └── globals.css                        # Global styles
├── lib/
│   └── gmail.js                           # Gmail utility functions
├── package.json
├── next.config.js
└── .env.local                             # Environment variables (not in repo)
```

## Usage

1. Click "Sign in with Google" to authenticate
2. Click "Refresh All Data" to fetch your combines, spending, and payouts
3. View all three sections on one page with summary metrics
4. Sign out to logout

## API Routes

- `GET /api/combines` - Fetches combine emails from Topstep
- `GET /api/spending` - Fetches spending/reset emails
- `GET /api/payouts` - Fetches approved payout emails

## Customization

Edit the email search queries in the API routes to match your actual Topstep email subjects.

## Production Deployment

Before deploying:
1. Change `NEXTAUTH_URL` to your production domain
2. Generate a new `NEXTAUTH_SECRET`
3. Update Google OAuth redirect URIs to include your production domain
4. Build: `npm run build`
5. Start: `npm start`
