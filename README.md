# Celestial Lobby — Client Portal & Store Ecosystem

A modern React SPA rewritten with TypeScript, Vite, and Tailwind CSS, preserving the client portal experience and the celestial orbit store ecosystem.

## Main entrance flow

- **SCREEN 1 · MAIN ENTRANCE**
  - **Sentinel / Security Guardian** — the entry guardian displayed on the main entrance.
  - **Client / Team Access** — opens the Environment Access Gate.
    - **Access Code**
    - **Join In / Access (Guest)**
  - **Hidden Owner Access** — revealed by tapping the Sentinel emblem five times.

## Features

- **Celestial Lobby Portal**:
  - **Guest Environment**: Explore celestial realm information, founder archives, and policies.
  - **New Client Journey**: Interactive 8-step onboarding flow covering 3S principles (Security, Secrecy, Safety), the 10 Non-Negotiables, process flow, calculation review, and automatic browser-demo credential provisioning.
  - **Regular Client Access Gate**: Access ID and Access Code verification flow with instant validation against browser-stored demo credentials.
  - **Client Dashboard**: Functions for direct store entry, order tracking, and order history inspection.

- **Orbit Store Ecosystem**:
  - **Stardust Server Lineup**: 9 distinct celestial realms (Cloud9, Mars, Venus, Saturn, Nibiru, Nemik, Vaelithar, Half G, One G) with reactive cart and quantity adjustment.
  - **Draco Bulk Add-Ons**: Essential lubricants and accessories with live subtotal calculation.
  - **Service & Special Handling**: Standard queue processing compliant with the "No Rush Orders" policy, promo code support (`ORBIT10`, `CELESTIAL` for ₱200 discount).
  - **Checkout**: Delivery address details, rider delivery / pickup / drop-off methods.
  - **Order Confirmation & Payment**: Real-time 60-minute countdown timer, payment sender initials, payment screenshot upload with preview.
  - **Order Tracking & Receipt**: Detailed multi-stage timeline (Order Submitted, Payment Submitted, Processing with live animation, Out for Delivery, Delivered) and live tracking indicator.
  - **Full Persistence**: Reactive state persisted in browser `localStorage`.
  - **Seamless Navigation**: Floating Lobby return switch and responsive mobile navigation bar.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS v4 + Custom Celestial Glassmorphism
- **Icons**: FontAwesome 6 + Lucide Icons


## Telegram bot and Mini App

The existing `@celestiallobbybot` integration is being prepared in `telegram-worker/`. It includes guided inline-button menus, returning-user recognition, the portal launch button, and a protected restriction-notification endpoint. The website now initializes Telegram's official Web Apps SDK when opened inside Telegram.

Deployment is intentionally pending until a replacement BotFather token is stored as a backend secret and the Worker/KV configuration is completed. See [telegram-worker/README.md](telegram-worker/README.md) for setup steps and security boundaries. Never commit bot tokens or send them in chat.
