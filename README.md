# Trip Weaver

You are a Senior Principal UI/UX Designer and Front-End Engineer specializing in modern Travel & Tourism E-commerce platforms.

Task: Design and code a responsive, intuitive, and modern Web Application UI for "TAT Booking Website" (Tour & Attraction Ticket Booking Website) based on the provided technical specifications.

🎨 1. DESIGN SYSTEM & VISUAL STYLE GUIDE

Tech Stack: Next.js (App Router), React, Tailwind CSS, Lucide Icons, Shadcn UI / Radix UI components.

Color Palette:

Primary: Deep Emerald / Ocean Blue (#0F766E / #0284C7) - representing travel, trust, and discovery.

Secondary / Accent: Warm Amber / Sunset Coral (#F59E0B / #F97316) - for CTAs, ratings, badges, and primary highlights.

Background: Clean Slate Light (#F8FAFC), Card Backgrounds (#FFFFFF).

Text: Dark Slate (#0F172A) for primary headings, Slate Gray (#64748B) for body text.

Typography: Inter / Plus Jakarta Sans (Modern, clean, highly readable).

Style: Clean, spacious, rounded corners (rounded-xl), soft subtle shadows (shadow-sm / shadow-md), high contrast for accessibility.

🗺️ 2. CORE ARCHITECTURE & USER FLOWS (PAGES TO BUILD)

Page 1: Home & Discovery Page (/)

Header / Navigation Bar:

Brand Logo ("TAT Booking"), Navigation Links (Tours, Destinations, Attractions, About, My Bookings), Language Switcher, Currency Selector, Login/Register buttons (OAuth Google & Email).

Hero Search Bar (Combo Search Hub):

Main Headline: "Explore Destinations, Book Transport & Attraction Tickets in One Unified Trip"

Interactive Search Form:

Destination / Tour Location dropdown

Transport Type Filter (Bus, Train, Private Car)

Travel Date Range Picker

Passenger & Ticket Count

"Search Tours & Combos" CTA Button.

Featured Tours & Popular Combos:

Grid of tour cards with price badges, duration, rating, transport type icon, and "Combo E-Ticket Included" badge.

Why Choose Us Section:

Highlights: Integrated Transport + Attraction Combo E-Tickets, Interactive Route Maps, Real-time Seat Locking, 100% Transparent Costs.

Page 2: Tour Listing & Interactive Route Map Page (/tours)

Filter Sidebar:

Price range slider, Transport type selection, Attraction categories, Pickup point preferences.

Interactive Map & Card View Toggle (Split Screen View):

Left Panel (Tour List): Detailed cards showing itineraries, vehicle options, included entrance tickets.

Right Panel (Interactive Route Map): Displays vehicle routes, pickup points/stopovers, and attraction destinations on a dynamic map view.

Page 3: Tour Detail & Seat/Pickup Selection Page (/tours/[id])

Overview & Gallery: High-res image slider, itinerary timeline, included vs. excluded list.

Step-by-Step Booking Widget (Sticky Sidebar / Flow):

Step 1: Select Date & Passenger Count

Step 2: Vehicle & Seat Selection: Interactive bus/vehicle seat map layout allowing users to select exact seat numbers with real-time seat availability indicator.

Step 3: Pickup Point Dropdown: Select convenient pickup spots along the route with precise time estimates.

Step 4: Attraction Add-ons: Checkbox list of venue entry tickets included or optional add-ons.

Page 4: Order Review & Checkout Page (/checkout)

Booking Summary Card (Transparent Pricing Breakdown):

Itemized list: Vehicle Ticket Price + Seat #, Attraction Entry Tickets, Pickup Location, Taxes & Fees, Total Payable Amount.

Passenger Details Form: Lead passenger contact info (Name, Email, Phone number).

Payment Gateways Selection:

Options: E-Wallets (VNPay, Momo), Credit Card (Visa/Mastercard), Bank Transfer QR.

Countdown timer (e.g., 10-minute temporary seat lock timer).

Page 5: Combo E-Ticket & Confirmation Page (/booking/success)

Success Banner & Confirmation Message.

Unified Combo QR Code E-Ticket Card:

A single prominent QR Code valid for both transport boarding and venue entry.

Detailed trip itinerary, seat numbers, pickup time & location map snippet, and offline access note.

Action buttons: "Download E-Ticket PDF", "Save to Apple/Google Wallet", "Send to Email/SMS".

Page 6: Admin Dashboard (/admin/dashboard)

Analytics Cards: Total Bookings, Real-time Revenue, Seat Utilization Rate, Active Tours.

Management Tabs:

Tour & Catalog Management: Add/Edit/Hide tour routes and itineraries.
Tours past their travel date are automatically marked "Tạm đóng" by a Supabase `pg_cron` job; the public catalog also excludes them immediately.

Transport & Provider Management: Manage vehicle schedules, seat maps, attraction ticket quotas.

Booking & Revenue Dashboard: View customer orders, process cancellations, track daily sales.

User & Security Management: Manage user roles, staff permissions, account status.

⚡ 3. UI PERFORMANCE & ACCESSIBILITY REQUIREMENTS

Response time under 2 seconds for UI interactions.

Responsive Layout (Mobile-first, Tablet, and Desktop UI).

Clean component breakdown using React hooks and Tailwind utility classes.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f0381085-5390-490f-b546-95c01478d365).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

### Supabase configuration

The site displays its bundled sample tours when Supabase is not configured. Authentication,
live tour data, and booking require a Supabase project. Copy `.env.example` to `.env.local`,
then fill in the project URL and publishable/anon key from your Supabase project settings.
Server-side payment confirmation also requires `SUPABASE_SERVICE_ROLE_KEY`; set it only in
the server environment and never expose it through a `VITE_` or `NEXT_PUBLIC_` variable.
Restart the development server after changing environment variables.

Apply the newest SQL migration in `supabase/migrations/` to the connected Supabase project
before testing ticket creation or payment confirmation.

### FR10 email delivery (Module A)

Module A uses Resend as the default HTTP email provider because it works cleanly in Cloudflare Workers without SMTP or Node-only mail libraries. Set the server-only variables below in the local environment for the app:

```sh
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="TAT Booking <noreply@your-domain.com>"
APP_URL="https://your-app.example.com"
```

`APP_URL` is the base URL used for the "Xem vé" button in the e-ticket email. The e-ticket email contains a QR image attachment and a link to the account-owned e-ticket page; it never includes the raw JWT or its signed token in the email body or URL.

The order-level send is idempotent: if the order already has a `sent` log entry, the server skips duplicate sends and a resend attempt is limited to three attempts per order per hour. Failed sends are logged as `failed` without blocking the paid order or ticket issuance.

### E-ticket signing and QR

The server signs compact ES256 JWTs with `jose@6.2.17` (Web Crypto, MIT) and creates QR SVGs
with `qrcode-generator@2.0.4` (MIT, no runtime dependencies). Only `iss`, `sub` (e-ticket ID),
`jti`, `iat`, and `exp` are signed. The QR contains the JWT directly. Keep the private key in
server-only environment variables; never use a `VITE_` prefix.

Generate a P-256 key pair and paste its output into the ignored local `.env` file:

```sh
node scripts/generate-eticket-keys.mjs
```

Set `ETICKET_PRIVATE_KEY`, `ETICKET_PUBLIC_KEY`, `ETICKET_KEY_ID`, and `ETICKET_ISSUER` from
the output, and set `ETICKET_ADDITIONAL_PUBLIC_KEYS=[]` initially. Private keys are PKCS8 PEM;
public keys are SPKI PEM. For key rollover, change the active key ID and keys, and retain prior
public keys in `ETICKET_ADDITIONAL_PUBLIC_KEYS` as a JSON array of `{ "kid": "...", "pem": "..." }`.
The public keys are served at `/api/eticket/jwks`; do not remove an old key while unexpired
tokens signed by it may still be scanned offline.

Payment confirmation creates the e-ticket and QR metadata, signs the token, and renders SVG.
If any issuance step fails, the ticket remains sold, `ticket_issue_status` remains
`pending_issue`, and a later confirmation request for the already-paid order retries issuance.
Staff/admin can reissue a QR; this changes `jti` and `qr_issued_at`, invalidating the old `jti`
when a scanner checks it online. Offline scanning can only check the signature and expiry; it
cannot detect a rotated/revoked `jti` or whether a segment was already used.

Run the crypto and QR checks with Node.js 22.18+:

```sh
node --experimental-strip-types scripts/test-eticket-token.mjs
```

For integration checks, apply the migrations, configure the local Supabase environment, then
confirm a paid order, fetch its QR as its owner, try fetching it as another account, and reissue
it as staff/admin. An unauthenticated request must fail. Confirm `qr_jti`, `qr_issued_at`, and
`qr_key_id` in `public.eticket`, verify the old token's `jti` no longer matches after reissue,
and verify that a missing private key leaves the order paid and retryable.
