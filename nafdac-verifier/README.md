# NAFDAC Verify 🇳🇬

**AI-powered NAFDAC product verification app** — snap or upload a product photo, and instantly check if it's registered in Nigeria's official NAFDAC Greenbook database.

## How It Works

1. **Upload or snap** a photo of any product label/packaging
2. **Claude Vision AI** reads the label and extracts: product name, NAFDAC registration number (NRN), manufacturer, and ingredients
3. **Live search** against `greenbook.nafdac.gov.ng` — Nigeria's official registered product database
4. **Result displayed:** ✅ Approved / ❌ Not Found / ⚠️ Expired

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **AI:** Anthropic Claude claude-sonnet-4-20250514 (Vision)
- **Data Source:** NAFDAC Greenbook (`greenbook.nafdac.gov.ng`)
- **Deployment:** Vercel

---

## Local Development

### 1. Clone and install

```bash
git clone <your-repo>
cd nafdac-verifier
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key at: https://console.anthropic.com

### 3. Run dev server

```bash
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel
```

### Option B: GitHub + Vercel Dashboard

1. Push this project to a GitHub repo
2. Go to https://vercel.com/new
3. Import your GitHub repo
4. Add environment variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from console.anthropic.com
5. Click **Deploy**

That's it! Vercel auto-deploys on every push.

---

## Project Structure

```
nafdac-verifier/
├── app/
│   ├── layout.tsx              # Root layout + metadata
│   ├── page.tsx                # Main UI (upload, camera, results)
│   ├── globals.css             # All styles
│   └── api/
│       ├── extract/route.ts    # Claude Vision → extract product info
│       └── verify/route.ts     # Query NAFDAC Greenbook
├── .env.local.example
├── package.json
└── README.md
```

---

## Important Notes

### NAFDAC Greenbook Access
The NAFDAC Greenbook (`greenbook.nafdac.gov.ng`) is a **public government website**. This app queries it server-side on behalf of users. The app:
- Does NOT store any product data
- Queries in real-time for every check
- Links back to the official NAFDAC Greenbook for full details

### Best Results
For accurate verification, ensure:
- The product label is clearly visible and in focus
- The NAFDAC registration number (NRN) is readable in the photo
- Good lighting when using the camera

### Disclaimer
This is **not an official NAFDAC service**. Always verify critical health decisions directly on the official NAFDAC Greenbook at https://greenbook.nafdac.gov.ng

---

## Features

- 📸 **Camera capture** on mobile (uses rear camera by default)
- 🖼️ **Image upload** from gallery (drag & drop on desktop)
- 🤖 **AI label reading** — extracts text even from angled/imperfect photos
- 🔍 **Smart search** — tries NAFDAC number first, falls back to product name
- ✅ **Clear results** — shows approval status, NRN, applicant, approval date
- 🔗 **Deep link** to NAFDAC Greenbook for full details
- 📱 **Mobile-first** responsive design

---

Built with ❤️ for Nigerian consumers · Data from NAFDAC Greenbook
