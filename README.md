# Arkane Aid

**A spoken companion for a live Dungeons and Dragons table.**

Arkane Aid keeps the game moving. Ask a rule and hear the answer. File a note without leaving the table. Keep a character sheet that travels with the party. The dungeon master still decides.

Built with Expo (React Native, TypeScript), Supabase, and Groq. Android first. Tested in Expo Go.

---

## 1. Overview

### Problem

A live table stops when someone has to look up a rule, write a note, or find a number on a character sheet. Paper and rulebooks are slow. Most digital tools are built for the dungeon master, not for the player who is already holding dice.

### Solution

Arkane Aid is a player-side companion.

Sage answers a ruling in short spoken sentences. Scribe turns what just happened into a note in the Codex. The Ledger holds the character sheet for the current party. Settings handles the account and the party code. The dungeon master is never replaced.

### Target users

A small live table. Two personas drove the design.

- Jack Thompson, 26, Johannesburg. A developer. Wants a fast ruling and no rulebook dump.
- Alex Carter, 24, Cape Town. A student with dyslexia. Needs short plain sentences that can be read aloud.

### Platform

Android first. The client runs in Expo Go for the milestone. A development build is required later for speech in and a full native orb. There is no Play Store release this year.

---

## 2. Features

### Authentication

Email sign up and login through **Supabase Auth** only. The app never hashes passwords itself and never writes them to AsyncStorage, SQLite, or logs: the password goes to Supabase over HTTPS, and Supabase stores a bcrypt hash on the server. The Expo client keeps only the session tokens (access/refresh) via the SQLite `localStorage` polyfill that `@supabase/supabase-js` uses. Sign-up asks for the password twice and checks they match; both screens require at least 8 characters (also set **Minimum password length** to 8+ in the Supabase Auth settings). Auth error messages do not say whether an email is already registered. Google/Facebook buttons are on the Login screen but need the matching providers enabled in the Supabase dashboard before they do anything. A profile row is created on first sign in. Logout from Settings.

### Parties

Create a party and get a code. Join a party with that code. The creator is the dungeon master. Joiners are players. Switch the active party in Settings. Codex notes and the character sheet are scoped to the selected party. One sheet per person per party.

### Sage

Ask a ruling. The reply is spoken aloud: a Google Chirp 3 HD voice from the `tts` Edge Function when it is set up, otherwise the phone's own text to speech (expo-speech), so it always works in Expo Go. A compact player sheet is attached only when the question depends on the character. General rules send no sheet. Plain voice is short and direct. Wizard voice is the same ruling in a warmer, ornate tone. The voice is picked on the Tome, and the Sage screen colours the orb fire to match: red for Wizard, blue for Plain, fading between them when the voice changes. The fire is a smooth 3-second loop (an animated WebP morphed offline from the 8 Figma frames, played natively by expo-image), with a thin heat glow at the orb's rim and a few rising embers; the glow is faint while idle, brighter and quicker while the Sage thinks, and pulses gently while it speaks (Reduce Motion shows a still frame and no embers). Under the orb a short status line sets the mood and changes while the Sage thinks or speaks. Two buttons pick the mode: Sage (microphone) on the left, Scribe (quill) on the right. The question or note is typed in a square parchment box docked at the bottom, with the round red send button (a cream pen nib) in its corner; it grows as you type and stays above the keyboard. The reply writes itself out on a parchment card like a quill, roughly in step with the speech; tap the card to show it all at once. Speech in is a placeholder until a development build. The header floats over the page with no strip of its own: content scrolling under the title, or down towards the typing box, melts into the paper through soft fades made of the same parchment.

### Scribe

Turn what the table just said into one ledger line. Past tense. No advice. The line is written into the Codex for the current party.

### Codex

The session book. Tabs for All, Notes, and Items. The Ledger tab opens the player sheet. Add a note or an item. Long-press a card to delete it. Notes from other parties do not appear.

### Ledger

The player sheet. Name, race, class, level, hit points, armour class, speed, proficiency bonus, six abilities, skills, languages, features, background, traits, equipment, and a gallery portrait. Race and class pick from the official species and class list, with a custom option. Edit, save, and delete the sheet for the current party.

### Rules

The `sage` Edge Function searches the full System Reference Document 5.2.1 (CC-BY-4.0, by Wizards of the Coast), bundled as chunks in `supabase/functions/_shared/srd/`. The search forgives typos ("firebal", "grapled", "owlbaer") and tells the model what it corrected. Answers that come from the SRD end with a short citation such as `(SRD: Fireball, p. 131)`. When the SRD has nothing on the question, the Sage does not refuse: it answers from general lore or offers a homebrew idea, and starts that part with "Lore:" or "Homebrew idea:" so the table knows it is not an official rule. The dungeon master still has the final say.

### Personalities

Sage, Scribe and Bard share one set of fact rules (`supabase/functions/_shared/personas.ts`) and differ only in voice:

- **Sage** (Plain): short, direct rulings. **Wizard** is the same Sage in a warmer, ornate court-mage tone.
- **Scribe**: one past-tense ledger line, no advice, written into the Codex.
- **Bard**: the same ruling told with flair, a little rhythm and a wink, still accurate and cited.

The Sage button uses the voice picked on the Tome (Plain, Wizard or Bard), so Bard needs no extra button. Each persona has its own Chirp 3 HD voice (Charon, Algenib, Kore, Puck).

### Settings (Tome)

The settings screen is called the Tome. It shows which party you are bound to. ACCOUNT holds sign out, create party, join party, reload, and switching the active party. GUIDANCE has quick how-to tips. Voice Personality picks the Sage voice (Wizard or Plain; Bard is ready on the server and switches on by setting `available: true` for Bard in `src/context/VoiceContext.tsx`). The choice is saved on the device in `VoiceContext` and the Sage screen reads it.

---

## 3. Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Expo SDK 57 |
| Language | TypeScript |
| UI | React Native |
| Auth and data | Supabase Auth, Postgres, Storage, Row Level Security |
| AI | Groq, called from a Supabase Edge Function |
| Speech | Google Cloud Text-to-Speech (Chirp 3 HD) through the `tts` Edge Function, expo-audio playback, expo-speech fallback |
| Portrait | expo-image-picker |
| Orb slot | three, @react-three/fiber, expo-gl |
| Fonts | Cinzel Decorative, Atkinson Hyperlegible |
| Icons | react-native-svg |
| Android package | za.co.openwindow.arkaneaid |

The Groq and Google keys live only as Supabase function secrets. They are never in the client, the APK, or this public repository.

---

## 4. Run it

Expo Go on Android is the main way to run it. A development build is optional.

### Requirements

Node.js 20 or newer. The Expo Go app on the phone. The phone and the laptop on the same network, or a tunnel.

### Steps

```bash
git clone https://github.com/DavidGolding200238/Arkane-Aid.git
cd Arkane-Aid
npm install
```

Copy `.env.example` to `.env` and fill in your project URL and publishable key (Supabase dashboard, Project Settings, API). `.env` is git-ignored.

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Start Metro for Expo Go.

```bash
npm start            # expo start --go
```

If the phone is not on the same network, use `npx expo start --go --tunnel`. Scan the QR code with Expo Go.

### Development build (optional)

`eas.json` has `development` (dev client, internal APK), `preview` (internal APK) and `production` profiles. Everything the app uses also ships in Expo Go, so the same code runs in both.

```bash
npx eas-cli build --profile development --platform android
npm run start:dev    # expo start --dev-client
```

### Backend

Install the Supabase CLI, then from the repo root:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push                                   # applies supabase/migrations in order
supabase secrets set GROQ_API_KEY=... GOOGLE_TTS_API_KEY=...
supabase functions deploy sage
supabase functions deploy tts
```

- `supabase/migrations/` holds the schema: profiles, parties and members, characters, equipment, traits, the Codex, the portrait bucket, Row Level Security, and `party_sheets`, a read-only function the Sage uses for party questions (it runs as the caller, so it only sees parties they belong to).
- `supabase/functions/sage` answers questions with Groq. `supabase/functions/tts` turns a reply into speech. Both require a signed-in user.
- Without `GOOGLE_TTS_API_KEY` the app uses the phone's voice; without `GROQ_API_KEY` the Sage reports that it is not configured.
- `npm run test:functions` type-checks, lints and tests the functions (needs Deno). `deno run -A scripts/ask-sage.ts bard "how much damage does firebal do"` asks Groq locally with the same prompts.

---

## 5. How the app works

1. The player signs in.
2. They create a party or join one with a code.
3. They open the Ledger and fill a sheet for that party.
4. At the table, they ask Sage a ruling. The reply is spoken.
5. They tell Scribe what just happened. The line lands in the Codex.
6. Switching party loads only that party's sheet and notes.

---

## 6. Screens

| Screen | Purpose |
|--------|---------|
| Splash | Title, and real loading: fonts, the main screens' art, the Sage's fire, code and orb model, with the percentage driven by finished tasks (never longer than 15 s) |
| Login and Sign up | Email authentication |
| Dashboard | Home. Seals for Sage, Codex, Ledger, and Settings |
| Sage | Ask a ruling or note the table. Voice (Plain or Wizard) comes from the Tome |
| Codex | Session book. Notes and items. Ledger tab opens the sheet |
| Ledger | Player sheet for the current party |
| Tome (Settings) | Account and parties, guidance, voice personality |
| Create and Join | Party code |

Figma is the source of truth for layout. File: ARKANE-AID-DEV.

---

## 7. Project structure

```
App.tsx                 screen gate and tab bar
src/
  screens/              Splash, Login, Home, Sage, Codex, Ledger, Settings, Create, Join
  components/           TabBar, SageAvatar, SageOrb (+ flames/: FireLoop, FlameGlow, Embers, useFlameMotion), SageModeButtons, SageInputBar, SageReplyCard, ScreenVignette, ScreenFrame, PageHeader, CircleButton,
                        ParchmentPanel, ThemedButton, TornButton, VoiceCarousel, Rule (inked underline), PageFade, icons
  theme/                colors, spacing, typography (fonts, heading ink), scale (360-wide sizing)
  context/              AuthContext, PartyContext, VoiceContext (saved Sage voice)
  lib/                  supabase, parties, character, codex, sage (typed Sage client), voice (cloud voice + device fallback), preload (what the splash loads)
assets/
  Icons/                tab and seal icons
  images/
    backgrounds/        parchment.png
    splash/             die-d20-ink (4x PNG: inverted dashboard d20 with ink edges, no glow), loader-ring (3x PNG); the skull is dashboard/skull-dragon
    auth/               input-field, icon-google, icon-facebook (3x PNG, Login/Sign up)
    decor/              ink-underline + ink-underline-end (the splash heading's inked rule, 3x, tintable; Rule uses them for every heading and divider)
    buttons/            btn-circle-red@3x.png, btn-torn-parchment@3x.png, btn-torn-red@3x.png
    icons/              icon-quill@3x.png, icon-chevron-left.svg, icon-chevron-down.svg,
                        tab-home/logbook/hat/gear.svg (tab bar, currentColor),
                        icon-mic.svg, icon-hand-quill.svg (Sage and Scribe mode buttons, currentColor)
    tabbar/             tab-bar-texture@3x.jpg, tab-active@3x.png (red active square, transparent)
    panels/             torn-paper panels as frame (PNG, transparent) + fill (JPEG) pairs, 3x; panel-codex-cream and panel-ledger-cream (paper blended toward #FFF6E2 by scripts/build-cream-panels.py, outlines untouched) are the ones in use for the Codex book, Ledger, Tome sections and Sage box; the tan panel-codex/panel-ledger are the script sources
    dashboard/          skull-dragon, seal-parchment, ring-outer/inner, die-d20, gem-red/green/blue (3x PNG, transparent)
    sage/               fire-red-loop.webp, fire-blue-loop.webp (animated orb fire, 72 frames at 24 fps); fire-red-1..8 and fire-blue-1..8 (the Figma keyframes they are built from, on one shared canvas, 3x PNG; frame 1 is the Reduce Motion still)
    tome/               d20-badge, voice-orb-wizard/plain/bard, arrow-left/right (3x PNG, transparent)
    ledger/             stat-header, stat-body, portrait-ink (3x PNG, transparent), portrait-placeholder (3x JPEG)
  Sage/                 orb model
supabase/
  config.toml           local CLI config; both functions verify the user's JWT
  migrations/           schema, RLS and party_sheets, in order
  functions/
    _shared/            personas, SRD search, auth, Groq, voices, HTTP helpers (+ tests)
    _shared/srd/        SRD 5.2.1 chunks (CC-BY-4.0)
    sage/               rules Q&A (Groq)
    tts/                Chirp 3 HD speech
scripts/                build-srd.py (rebuilds the SRD chunks), ask-sage.ts (local test), panel tools
eas.json                development, preview and production build profiles
```

### Data

`parties` and `party_members` hold the table and the roles.
`characters` is one row per user per party.
`character_equipment` and traits hang off the character.
`codex_entries` are party notes and items.
Portraits live in the `character-portraits` bucket.

---

## 8. Design choices

Sage speaks in short sentences because Alex has dyslexia and Jack wants a fast ruling.

The player sheet is attached only when the question needs it. A general rule does not spend tokens on the sheet.

Official rules come from the SRD and are cited. Anything beyond it is clearly labelled Lore or Homebrew, so a made-up idea is never passed off as a rule, and the dungeon master still decides.

One sheet per person per party. Switching party must not leak another campaign's notes or gear.

The orb is a slot. A Spline embed will not run in Expo Go. Do not add an orb implementation unless asked.

Expo SDK 57 draws edge to edge, so the app bar sits above the phone's own navigation bar.

---

## 9. Repository

Public repository: DavidGolding200238/Arkane-Aid
Active branch: Improvement

---

## 10. Notes for reviewers

The recommended way to evaluate the app is Expo Go on an Android phone, on the same network as the laptop running Metro.

The loop to walk is: log in, open Sage, ask a ruling, Scribe a note, open Codex, open the sheet, create or join a party.

Speech in and a true 3D orb need a development build. They are out of scope for the Expo Go milestone.

## Credits

This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
