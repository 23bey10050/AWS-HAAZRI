# Haazri — Android app (Trusted Web Activity)

The Android app is a **Trusted Web Activity (TWA)** wrapping the same React PWA that's
already built in `../frontend/` — not a separate codebase. This was the deliberate choice
for "offline-capable, lightweight, one app that role-routes for both worker and
organization" (see the plan this build followed): the TWA is a thin native shell around
the exact same JS/HTML/CSS, so every screen, every offline behavior
(`frontend/src/hooks/useOfflineQueue.js` for data, `frontend/public/service-worker.js`
for the app shell), and the worker/org role-routing in `App.jsx` work identically on
Android with zero duplicated code. This is the same technique Twitter Lite, Starbucks,
and Google's own PWA-as-app examples use.

## Why this folder isn't a buildable Android Studio project yet

Generating the actual Gradle/Kotlin project requires **Google's `bubblewrap` CLI**, which
in turn requires a **live, deployed HTTPS URL** — it fetches your real
`manifest.json` to read your icons, colors, and name, and it generates + verifies a
signing keystore as part of the same step. Hand-writing that generated project without a
working `sam deploy` + Amplify URL to point at (and without Android SDK/Gradle installed
in this environment to compile-check it) would risk shipping a project with subtle,
unverifiable errors — the base spec's own rule is to stop and tell you rather than fake a
step like this. `twa-manifest.json` in this folder is the **input** to that generator,
already filled in with this project's real values (name, colors, icon paths) so the
generation step is a single command once you're deployed.

## Steps to generate and build the real app (after `sam deploy` + Amplify are live)

1. **Fill in your deployed domain.** In `android/twa-manifest.json`, replace every
   `REPLACE_WITH_AMPLIFY_DOMAIN` with your Amplify domain (e.g.
   `main.d1234abcd.amplifyapp.com`, or your custom domain if you attach one).

2. **Install the Bubblewrap CLI** (needs Node, which you already have, plus a JDK —
   Bubblewrap will offer to download Android SDK components on first run):
   ```bash
   npm install -g @bubblewrap/cli
   ```

3. **Generate the Android project** from the filled-in manifest:
   ```bash
   cd android
   bubblewrap init --manifest=./twa-manifest.json
   ```
   This creates the signing keystore (keep `android.keystore` and its password safe — you
   need it for every future update) and prints the **SHA-256 certificate fingerprint**.

4. **Wire up Digital Asset Links** (this is what proves your app and your website are the
   same thing, so the TWA opens with no browser UI at all instead of falling back to a
   Chrome Custom Tab): copy that SHA-256 fingerprint into
   `frontend/public/.well-known/assetlinks.json` (replacing
   `REPLACE_WITH_SIGNING_KEY_SHA256_FINGERPRINT`), then redeploy the frontend so
   `https://<your-domain>/.well-known/assetlinks.json` is live. **Double-check Amplify is
   actually serving it** — if you ever add an SPA/history-API rewrite rule in the Amplify
   console, make sure it excludes `/.well-known/*`, or the asset-links file will get
   swallowed by the rewrite and the TWA will silently fall back to showing browser chrome.

5. **Build the APK/AAB**:
   ```bash
   bubblewrap build
   ```
   This opens (or creates) the Android Studio project under `android/` and produces a
   signed release AAB/APK you can sideload, distribute directly, or upload to the Play
   Store.

## What's already true about this app on Android without any of the above

Because `frontend/` is already a fully spec'd PWA (manifest with real icons, an offline
service worker for the app shell, IndexedDB offline queue for data, GPS/camera/mic access
through standard web APIs), a worker or org admin can **already** open the deployed URL in
Chrome on Android and tap "Add to Home Screen" today, before any of the steps above — they
get an icon, a standalone window with no browser chrome, and full offline behavior. The
TWA/Play Store path above is for real installable-APK distribution, not a prerequisite for
the app working like an app on Android.
