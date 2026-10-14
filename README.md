# Arkane Aid

Spoken Dungeons and Dragons aid for a live table. Android first. Expo TypeScript client, Supabase for auth and data, Groq for Sage through a server-side Edge Function.

Stay in the game. Ask a rule, file a note, keep a character sheet. The dungeon master still decides.

## What it does now

- Sign up, log in, and log out with Supabase Auth. A profile row is created on first sign-in.
- Create or join a party with a code. Switch the active party in Settings. One character sheet per person per party. Codex notes stay with that party.
- Ledger is the player sheet. Name, race, class, six abilities, background, traits, equipment, and a gallery portrait. Race and class pick from the official species and class list, with a custom option. Edit, save, and delete the sheet for the current party.
- Codex is the session book. Tabs for All, Notes, and Items. The Ledger tab opens the player sheet. Long-press a card to delete it. Scribe mode writes a note into Codex for the current party.
- Sage answers a typed ruling. The reply is spoken with on-device text to speech. A compact player sheet is attached only when the question needs the character. General rules send no sheet. Speech in is a placeholder until the development build.
- Rules answers are meant to stay inside a short local extract in `src/data/rules.json`, drawn from the official Dungeons and Dragons rules (SRD 5.2.1, CC-BY-4.0). A question outside that extract is refused and sent to the dungeon master. That refusal is the design, not a bug.

## Run it now

Expo Go on Android. No APK yet.

1. Install Node 20 or newer, and the Expo Go app on the phone.
2. Clone the repo and install dependencies:

```bash
git clone https://github.com/DavidGolding200238/Arkane-Aid.git
cd Arkane-Aid
npm install
```

3. Copy `.env.example` to `.env` and set the publishable key:

```
EXPO_PUBLIC_SUPABASE_URL=https://pxbtkynhcnyrypskouwb.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The Groq key is not in the client. It lives on the Sage Edge Function in Supabase.

4. Start Metro:

```bash
npx expo start
```

If the phone is not on the same network, use `npx expo start --tunnel`.

5. Scan the QR code with Expo Go.

## Dependencies

Installed by `npm install`. Main ones:

- Expo 57, React Native 0.86, React 19, TypeScript
- `@supabase/supabase-js` for auth and data
- `expo-speech` for spoken replies
- `expo-image-picker` and `expo-file-system` for the portrait
- `expo-font` with Cinzel Decorative and Atkinson Hyperlegible
- `three`, `@react-three/fiber`, `@react-three/drei`, `expo-gl` for the orb slot
- `react-native-svg` and `react-native-svg-transformer` for icons
- `@expo/ngrok` for the tunnel

Backend, already applied on the Supabase project:

- `supabase/001_auth_and_parties.sql` for profiles, parties, members, and ledger entries
- `supabase/002_characters_codex_storage.sql` for characters, equipment, Codex entries, and the portrait bucket
- `supabase/functions/sage` for the Groq call. `GROQ_API_KEY` is set on the function, not in the APK or the client

## Moving to an APK build

Current testing is Expo Go. Speech in, the exported orb, and a few native packages need a development build, not Expo Go. That build is an Android preview APK, same pattern as previous modules. There is no Play Store release this year.

The free Expo plan allows a limited number of APK updates, so the development build is held until the screens are settled. The next pass finishes the frontend, then a small APK pass covers push-to-talk, the orb phases, and anything else Expo Go cannot run. The Groq key stays on the Edge Function and is never shipped in the APK.
