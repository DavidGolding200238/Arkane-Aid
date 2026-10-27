# Arkane Aid <img src="assets/images/app-icon/icon.png" alt="Arkane Aid icon" width="52" />

**A spoken companion for a live Dungeons and Dragons table.**

Arkane Aid keeps the game moving. Ask a rule and hear the answer. Say what just happened and it lands in the session notes. Keep a character sheet that travels with your party. The dungeon master still has the final say.

Built with Expo (React Native, TypeScript), Supabase and Groq. Android first.

My final year project for Interactive Development (4th year).

---

## 1. Overview

### Problem

A live table stalls every time someone has to look up a rule, write down what happened, or dig for a number on a character sheet. Rulebooks are slow at the table. Most digital tools are built for the dungeon master, not for the player who is already holding dice.

### Solution

Arkane Aid is a player-side companion.

The Sage answers a ruling in a few short spoken sentences, grounded in the official 5e rules. The Scribe turns what the table just said into a note in the Codex. The Character Sheet holds your character for the current party and saves itself as you type. None of it replaces the dungeon master.

### Target users

Players at a small live table who want a quick ruling, a note or a number without stopping the game.

### Platform

Android first. The app is built with EAS as an APK. A development build is used while working on the code. Voice input needs a native build, so it does not work in Expo Go.

---

## 2. Features

### Authentication

Email sign up and login through Supabase Auth. The app never handles password hashing itself and never writes passwords to the device. Only the session tokens are kept on the phone. Sign up asks for the password twice, and both screens require at least 8 characters. Error messages never reveal whether an email is already registered. A profile row is created on first sign in. Sign out is in the Tome.

Google and Facebook buttons are on the Login screen, but they only show a notice for now. They need the matching providers switched on in Supabase before they can sign anyone in.

### Password reset

"Forgot password?" on the Login screen sends a reset email through Supabase's built-in mailer. Tapping the link on the phone opens the app on the reset screen (`arkaneaid://reset-password`), where you set a new password twice and are signed straight in. No custom SMTP is needed.

### Parties

Create a party and get a join code, or join one with a code. The creator is the dungeon master and everyone who joins is a player. Switch the active party in the Tome. Notes and the character sheet are scoped to the selected party, so one campaign never leaks into another.

### Sage

Ask a ruling by typing it or by holding the orb and speaking. The answer comes back in short sentences, writes itself out on a parchment card and is read aloud by the phone's own text to speech. Your character sheet is only sent along when the question depends on it, so a general rules question costs fewer tokens.

The Sage has three voices, picked in the Tome:

| Voice | Style | Orb |
|-------|-------|-----|
| Wizard | The same ruling in a warmer, ornate court-mage tone | Red |
| Arbiter | Short, sure rulings from the bench | Blue |
| Bard | The ruling with a bit of rhythm and a wink | Green |

All three share the same rules, scope and limits and only differ in tone. Each has its own speech rate and pitch, so they sound different too.

The Sage keeps the last three exchanges of the current session, so a follow-up like "how long does it last?" works. That memory is cleared when you leave the screen, switch mode or change voice, and it is never saved.

### Voice input

Hold the orb to talk and let go to send. It uses the phone's own speech recogniser, so there is no extra key or paid service. It listens in South African English and falls back to US English on phones without that language pack. A short list of game words (cantrip, saving throw, spell slot and so on) is passed to the recogniser so they are heard correctly.

### Rules and sources

The `sage` Edge Function searches the full System Reference Document 5.2.1, bundled with the function. Search is hybrid: keyword search that forgives typos ("firebal", "grapled"), plus meaning search using Supabase's built-in `gte-small` embeddings, so a plain question like "can I hit someone running away" still finds Opportunity Attacks. If the embeddings table is empty, it falls back to keyword search alone.

Answers taken from the SRD show a small "Source:" line under the reply, such as "Fireball, p. 131". That line is never read aloud. When the SRD has nothing on a question, the Sage answers from general lore or offers a homebrew idea and labels it "Lore:" or "Homebrew idea:", so an invented idea is never passed off as an official rule. Questions that have nothing to do with D&D get a short in-character refusal and a nudge back to the game.

### Scribe

Switch the Sage screen to Scribe mode, say or type what just happened, and the Scribe writes it as a single past-tense line in the Codex for the current party. No advice, no rulings.

### Codex

The session book, with All, Notes, Items, Weapons, Spells and Sheet tabs. Add a note or an item, tap your own note to edit it, or long-press a card to delete it. Only the current party's entries show.

Weapons and Spells are your own, per party. Pick from the SRD list or write your own. Exactly one weapon is in hand; it sits at the top and the Sage uses it. The to-hit box suggests STR (or DEX for Finesse and ranged weapons) plus your Proficiency Bonus. Spells are grouped in level tabs, Cantrip to 9th. The Sheet tab opens the Character Sheet.

### Character Sheet

The character sheet: name, species, lineage, class, subclass, level, hit points, armour class, speed, proficiency bonus, the six abilities, skills, languages, features, background, traits, equipment and a portrait from the gallery. Species and class pick from the official 2024 lists (SRD 5.2.1), with a custom option; a custom species gets a Homebrew box for its traits, which the Sage treats as your table's homebrew. The sheet saves itself 0.8 s after you stop typing, and when you leave, switch tab or party, or put the app away. A blank sheet is never saved. One sheet per person per party.

### Tome (settings)

Shows which party you are in. Account options cover sign out, creating or joining a party, switching the active party and reloading. Guidance has the how-to tips, which also pop up once (with a Got it button) the first time each account opens the app on a phone. Voice Personality picks Wizard, Arbiter or Bard, and a toggle turns spoken replies on or off. Both choices are saved on the device.

---

## 3. Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Expo SDK 58 with expo-dev-client (React Native 0.88, React 19.3) |
| Language | TypeScript |
| Auth and data | Supabase Auth, Postgres, Storage, Row Level Security |
| Rules search | SRD 5.2.1 chunks, pgvector, Supabase `gte-small` embeddings |
| AI | Groq (`gpt-oss-120b` for the Sage, `gpt-oss-20b` for the Scribe and as a fallback), called only from a Supabase Edge Function |
| Speech out | expo-speech |
| Speech in | expo-speech-recognition |
| Images | expo-image, expo-image-picker |
| Fonts | Cinzel Decorative, Atkinson Hyperlegible |
| Builds | EAS Build |

The Groq key only lives as a Supabase function secret. It is never in the app, the APK or this repository.

---

## 4. Installation (APK)

The normal way to try the app. The APK is a standalone preview build, so it runs on its own without a computer or Metro.

### Requirements

- An Android phone (Android 7 or newer)
- An internet connection, for signing in and asking the Sage

### Install

1. On the phone, open the EAS install link for the latest preview build (or scan its QR code).
2. Tap **Install** and download the APK.
3. Open the downloaded file from the notification or the Downloads folder.
4. If Android blocks it, tap **Settings** and turn on **Allow from this source** for the browser you used, then go back and tap **Install**.
5. If Google Play Protect warns about an unknown app, tap **More details** and then **Install anyway**. That warning shows up for any APK that doesn't come from the Play Store.

If an older Arkane Aid or a development build is already on the phone, uninstall it first (long-press the icon, then **Uninstall**). Both use the same package name, and installing over the top keeps the old app's data.

### Open the app

1. Open **Arkane Aid** from the app drawer.
2. Wait for the splash screen to finish loading.
3. Sign up with an email and password, or sign in.
4. Create a party, or join one with a code from your dungeon master.
5. Fill in your Character Sheet (Codex, Sheet tab), then open the Sage and ask a ruling.
6. Allow the microphone the first time you hold the orb to speak.

You stay signed in between launches.

---

## 5. Development setup

Only needed if you want to run or change the code.

### Prerequisites

- Node.js 22.13 or newer (Expo SDK 58 does not run on Node 20) and npm
- Git
- An Expo account and EAS CLI (`npm install -g eas-cli`)
- An Android phone
- A Supabase project and the Supabase CLI
- A Groq API key (free tier works)
- Deno, only for seeding the rules search, the function tests and the evals

### Clone and install

```bash
git clone https://github.com/DavidGolding200238/Arkane-Aid.git
cd Arkane-Aid
git checkout Apk-Build
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in two values from your Supabase dashboard (Project Settings, API):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`.env` is git-ignored. Never commit real keys.

### Supabase

From the repo root:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push                          # runs supabase/migrations in order
supabase secrets set GROQ_API_KEY=YOUR-GROQ-KEY
supabase functions deploy sage
```

Migration `20261027000007_sheet_rework.sql` adds the sheet's subclass, lineage and homebrew species traits and the `character_weapons` and `character_spells` tables (Row Level Security: only you change yours; your party can read them). Until it is pushed the sheet still saves without those fields, and the Weapons and Spells tabs say the database needs updating.

Then seed the meaning search once (needs Deno). The service role key is only typed into this command, never saved to a file:

```bash
SUPABASE_URL=YOUR-PROJECT-URL SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY npm run seed:srd
```

The Sage still works without this step, using keyword search only.

In the Supabase dashboard:

1. Authentication, URL Configuration, Redirect URLs: add `arkaneaid://**` so the password reset link opens the app.
2. Authentication, Providers, Email: set the minimum password length to 8 to match the app.

### Build with EAS

`app.json` points at my Expo project. To build under your own account, remove `owner` and `extra.eas.projectId` from `app.json`, then:

```bash
eas login
eas init
```

`.env` is not uploaded to EAS, so add the two Supabase values to the EAS environments the build profiles use (`development` and `preview`), either on expo.dev under Environment variables or with `eas env:create`.

```bash
# Development client
eas build --profile development --platform android

# Standalone preview APK, runs without a computer
eas build --profile preview --platform android
```

Install the APK on your phone. A preview build opens straight from the app drawer. A development build needs Metro running on your computer:

```bash
npm run start:dev
```

`npm start` runs Expo Go. Most of the app runs there, but voice input does not.

#### Release build note: the Sage orb and code shrinking

The first preview APK crashed as soon as the Sage screen opened, while the development build was fine. Expo SDK 58 turns on R8 code shrinking for Android release builds, and `expo-gl` 58.0.3 ships without keep rules, so R8 strips the `GLView` constructor. When the 3D orb's canvas mounts, Android can't create the view and the app closes. Development builds don't shrink code, so the problem only shows up in preview and production builds. It is a known Expo issue ([expo/expo#51948](https://github.com/expo/expo/issues/51948)).

The fix lives in `app.json`. The `expo-build-properties` plugin adds a keep rule for `expo-gl` and leaves shrinking on for everything else:

```json
["expo-build-properties", { "android": { "extraProguardRules": "-keep class expo.modules.gl.** { *; }" } }]
```

If a future release build still crashes there, set `"enableMinifyInReleaseBuilds": false` under `android` in the same plugin instead. The APK gets bigger but nothing is stripped. Remove the rule once a fixed `expo-gl` is released.

### Checks

```bash
npm run typecheck          # TypeScript
npm run lint               # ESLint
npm run test:functions     # Edge Function type check, lint and tests (Deno)
npm run eval:search        # scores the rules search on 38 test questions
npm run eval:answers       # asks the deployed Sage the same questions and checks the replies
```

### Permissions used

android.permission.RECORD_AUDIO (voice input, only while the orb is held)

---

## 6. How the app works

1. The player signs in.
2. They create a party or join one with a code.
3. They fill in a Character Sheet for that party.
4. At the table they ask the Sage a ruling, by voice or text, and hear the answer.
5. They tell the Scribe what just happened, and the line lands in the Codex.
6. Switching party loads only that party's sheet and notes.

---

## 7. Screens

| Screen | Purpose |
|--------|---------|
| Splash | Loads fonts, art and the orb before the app opens |
| Login and Sign up | Email authentication |
| Reset password | New password from the emailed link |
| Home | Dashboard with seals for Sage, Codex and Tome |
| Sage | Ask a ruling or scribe a note, by voice or text |
| Codex | Session notes, items, weapons and spells for the current party |
| Character Sheet (LedgerScreen) | Character sheet for the current party |
| Tome | Account, parties, guidance and voice personality |
| Create and Join party | Make a party code or use one |

### Design direction

Parchment, ink and torn-paper panels, with a red, blue or green fire orb that matches the Sage's voice. Cinzel Decorative for titles and Atkinson Hyperlegible for body text, chosen for readability with dyslexia in mind. Layout was designed in Figma first.

---

## 8. Project structure

```
App.tsx                 auth gate, screens and tab bar
src/
  screens/              Splash, Login, ResetPassword, Home, Sage, Codex, Ledger (Character Sheet), Settings (Tome), CreateParty, JoinParty
  components/           orb and flames, Sage input and reply card, page header and fades, buttons, panels, tab bar
  context/              AuthContext, PartyContext, VoiceContext
  lib/                  Supabase client, parties, character, codex, Sage client, voice, hold to talk
  theme/                colours, spacing, typography, scaling
assets/                 icons, images, the orb model
supabase/
  migrations/           schema, Row Level Security, party sheets, SRD vectors
  functions/sage/       the Sage Edge Function
  functions/_shared/    personas, SRD search, memory, auth, Groq client (+ tests)
scripts/                SRD build and seed, local Sage test, art build scripts
evals/                  Sage test questions and scoring scripts
art-source/             source art for the build scripts (not bundled)
eas.json                development, preview and production build profiles
```

### Data

`parties` and `party_members` hold the table and roles.  
`characters` is one row per user per party, with equipment and traits hanging off it.  
`codex_entries` holds party notes and items.  
Portraits live in the `character-portraits` storage bucket.  
`srd_chunks` holds the SRD pieces and their embeddings (read-only for players).

---

## 9. Design choices

The Sage speaks in short sentences because Alex needs them and Jack wants a quick answer.

The sheet is only sent when the question needs it. A general rule does not spend tokens on it.

Official rules come from the SRD and are cited. Anything beyond it is labelled Lore or Homebrew, so the table always knows what is official, and the dungeon master still decides.

The Groq key stays on the server. The app only talks to the Edge Function, which checks the player's session first.

One sheet per person per party, so switching campaigns never mixes notes or gear.

Speech in and out use the phone's own engines. No paid speech services.

---

## 10. Repository

Public repository: DavidGolding200238/Arkane-Aid  
Active branch: Apk-Build

---

## 11. Notes for reviewers

The best way to evaluate the app is the preview APK on an Android phone.

The loop to walk is: sign up, create or join a party, fill in the Character Sheet, ask the Sage a ruling by holding the orb, scribe a note, then check it in the Codex.

## Credits

This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
