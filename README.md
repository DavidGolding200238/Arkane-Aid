# Arkane Aid

Android-first Expo app for a D&D table. Voice rulings and notes are the product. This pass wires the screens to Supabase.

## Run

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Then `npm install` and `npx expo start`.

## Backend still to apply

1. Paste `supabase/001_auth_and_parties.sql` into the Supabase SQL editor and run it once.
2. Authentication, Providers, Email: turn off Confirm email for the milestone demo.
3. Deploy `supabase/functions/sage` and set `GROQ_API_KEY` on the function. The key stays server-side.

Until those three are done, party and Sage screens will show the Supabase or function error. That is the failure state, not a silent miss.

## Screens

Splash, Login, Home, Sage, Codex, Ledger, Settings, Create party, Join party. Sage has a slot for the Spline avatar. It is not embedded. A Spline scene does not run in Expo Go.
