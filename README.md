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
