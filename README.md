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

Email sign up and login through Supabase Auth. A profile row is created on first sign in. Logout from Settings.

### Parties

Create a party and get a code. Join a party with that code. The creator is the dungeon master. Joiners are players. Switch the active party in Settings. Codex notes and the character sheet are scoped to the selected party. One sheet per person per party.

### Sage

Ask a ruling. The reply is spoken with on-device text to speech. A compact player sheet is attached only when the question depends on the character. General rules send no sheet. Plain voice is short and direct. Wizard voice is the same ruling in a warmer, ornate tone. The voice is picked on the Tome, and the Sage screen colours the orb fire to match: red for Wizard, blue for Plain, fading between them when the voice changes. The fire is a smooth 3-second loop (an animated WebP morphed offline from the 8 Figma frames, played natively by expo-image), with a thin heat glow at the orb's rim and a few rising embers; the glow is faint while idle, brighter and quicker while the Sage thinks, and pulses gently while it speaks (Reduce Motion shows a still frame and no embers). Under the orb a short status line sets the mood and changes while the Sage thinks or speaks. Two buttons pick the mode: Sage (microphone) on the left, Scribe (quill) on the right. The question or note is typed in a square parchment box docked at the bottom, with the round red send button (a cream pen nib) in its corner; it grows as you type and stays above the keyboard. The reply writes itself out on a parchment card like a quill, roughly in step with the speech; tap the card to show it all at once. Speech in is a placeholder until a development build. The header floats over the page with no strip of its own: content scrolling under the title, or down towards the typing box, melts into the paper through soft fades made of the same parchment.

### Scribe

Turn what the table just said into one ledger line. Past tense. No advice. The line is written into the Codex for the current party.

### Codex

The session book. Tabs for All, Notes, and Items. The Ledger tab opens the player sheet. Add a note or an item. Long-press a card to delete it. Notes from other parties do not appear.

### Ledger

The player sheet. Name, race, class, level, hit points, armour class, speed, proficiency bonus, six abilities, skills, languages, features, background, traits, equipment, and a gallery portrait. Race and class pick from the official species and class list, with a custom option. Edit, save, and delete the sheet for the current party.

### Rules

Answers are meant to stay inside a short local extract in `src/data/rules.json`, drawn from the official Dungeons and Dragons System Reference Document 5.2.1 (CC-BY-4.0). A question outside that extract is refused and sent to the dungeon master. That refusal is the design, not a bug.

### Settings (Tome)

The settings screen is called the Tome. It shows which party you are bound to. ACCOUNT holds sign out, create party, join party, reload, and switching the active party. GUIDANCE has quick how-to tips. Voice Personality picks the Sage voice (Wizard or Plain; Bard is coming soon). The choice is saved on the device in `VoiceContext` and the Sage screen reads it.

---

## 3. Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Expo SDK 57 |
| Language | TypeScript |
| UI | React Native |
| Auth and data | Supabase Auth, Postgres, Storage, Row Level Security |
| AI | Groq, called from a Supabase Edge Function |
| Speech | expo-speech |
| Portrait | expo-image-picker |
| Orb slot | three, @react-three/fiber, expo-gl |
| Fonts | Cinzel Decorative, Atkinson Hyperlegible |
| Icons | react-native-svg |
| Android package | za.co.openwindow.arkaneaid |

The Groq key lives on the Edge Function. It is never in the client or the APK.

---

## 4. Run it

Expo Go on Android. No APK yet.

### Requirements

Node.js 20 or newer. The Expo Go app on the phone. The phone and the laptop on the same network, or a tunnel.

### Steps

```bash
git clone https://github.com/DavidGolding200238/Arkane-Aid.git
cd Arkane-Aid
npm install
```

Copy `.env.example` to `.env` and set the publishable key.

```
EXPO_PUBLIC_SUPABASE_URL=https://pxbtkynhcnyrypskouwb.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Start Metro.

```bash
npx expo start
```

If the phone is not on the same network, use `npx expo start --tunnel`. Scan the QR code with Expo Go.

### Backend

Already applied on the Supabase project. Re-run only on a fresh project, in order.

- `supabase/001_auth_and_parties.sql` for profiles, parties, members, and ledger entries
- `supabase/002_characters_codex_storage.sql` for characters, equipment, Codex entries, and the portrait bucket
- `supabase/003_level_hp_traits.sql` for level, hit points, and traits
- `supabase/004_sheet_combat.sql` for armour class, speed, skills, languages, and features
- `supabase/functions/sage` for the Groq call. `GROQ_API_KEY` is set on the function

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
  lib/                  supabase, parties, character, codex, sage, preload (what the splash loads)
  data/
    rules.json          SRD 5.2.1 extract
    sage-personalities.json
assets/
  Splash Screen/        Dragon Logo (Login skull, still 1x)
  Icons/                tab and seal icons
  images/
    backgrounds/        parchment.png
    splash/             die-d20-glow, loader-ring (3x PNG, transparent; the skull is dashboard/skull-dragon)
    decor/              ink-underline + ink-underline-end (the splash heading's inked rule, 3x, tintable; Rule uses them for every heading and divider)
    buttons/            btn-circle-red@3x.png, btn-torn-parchment@3x.png
    icons/              icon-quill@3x.png, icon-chevron-left.svg, icon-chevron-down.svg,
                        tab-home/logbook/hat/gear.svg (tab bar, currentColor),
                        icon-mic.svg, icon-hand-quill.svg (Sage and Scribe mode buttons, currentColor)
    tabbar/             tab-bar-texture@3x.jpg, tab-active@3x.png (red active square, transparent)
    panels/             torn-paper panels as frame (PNG, transparent) + fill (JPEG) pairs, 3x
    dashboard/          skull-dragon, seal-parchment, ring-outer/inner, die-d20, gem-red/green/blue (3x PNG, transparent)
    sage/               fire-red-loop.webp, fire-blue-loop.webp (animated orb fire, 72 frames at 24 fps); fire-red-1..8 and fire-blue-1..8 (the Figma keyframes they are built from, on one shared canvas, 3x PNG; frame 1 is the Reduce Motion still)
    tome/               d20-badge, voice-orb-wizard/plain/bard, arrow-left/right (3x PNG, transparent)
    ledger/             stat-header, stat-body, portrait-ink (3x PNG, transparent), portrait-placeholder (3x JPEG)
  Sage/                 orb model
supabase/
  001_auth_and_parties.sql
  002_characters_codex_storage.sql
  003_level_hp_traits.sql
  004_sheet_combat.sql
  functions/sage/       Groq Edge Function
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

A question outside the local rules extract is refused. Inventing a rule is worse than saying the dungeon master should decide.

One sheet per person per party. Switching party must not leak another campaign's notes or gear.

The orb is a slot. A Spline embed will not run in Expo Go. Do not add an orb implementation unless asked.

The phone's own navigation bar stays white in Expo Go. The app bar is black and sits above it.

---

## 9. Repository

Public repository: DavidGolding200238/Arkane-Aid
Active branch: main

---

## 10. Notes for reviewers

The recommended way to evaluate the app is Expo Go on an Android phone, on the same network as the laptop running Metro.

The loop to walk is: log in, open Sage, ask a ruling, Scribe a note, open Codex, open the sheet, create or join a party.

Speech in, a true 3D orb, and a black system navigation bar need a development build. They are out of scope for the Expo Go milestone.
