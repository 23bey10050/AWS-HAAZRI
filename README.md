# हाज़िरी (Haazri) — Digital Wage Proof for Daily Wage Workers

Built for **First Commit** (Bharat Builds Tour, WeMakeDevs × AWS), September 17–20, 2026.
Submitted for **Ship It**, **Build It**, and **Best UI**.

## The problem

~150 million Indian daily wage workers have no attendance record. At month's end, the
contractor's memory is the only ledger — and it favors the contractor. There is no punch
clock, no app, no paper trail that survives a wage dispute.

## What Haazri does

A worker taps **one button**. The app captures GPS + a server-anchored timestamp, and
optionally a voice note (structured into worksite/task/contractor fields by Amazon
Bedrock) and a selfie. That becomes a permanent, append-only, GPS-and-time-stamped proof
of presence the worker can review (full detail per day, including a map link and the
photo) and turn into a shareable monthly wage-proof image on WhatsApp — in Hindi, with a
64px-minimum touch target, dark UI, and zero typing required for the core flow.

Full engineering spec: [`HAAZRI_BUILD_SPEC.md`](./HAAZRI_BUILD_SPEC.md) — this build
follows it as written.

## Architecture at a glance

- **Attendance records are append-only** — there is no update/delete endpoint. The one
  `POST /v1/attendance` is an idempotent upsert keyed on `(worker_id, record_date)`;
  fields are set once via `if_not_exists` and never overwritten. The attendance Lambda's
  IAM role is scoped to `dynamodb:UpdateItem` only — it structurally cannot delete a row,
  not just "no endpoint calls delete."
- **Offline-first**: every tap is optimistic (saved to IndexedDB immediately, synced in
  the background, with a visible amber→green status once the server actually confirms
  the write); the backend's idempotent upsert makes retries always safe.
- **AI**: only the *text* transcript from the on-device Web Speech API is sent to Amazon
  Bedrock (Claude 3 Haiku) to extract worksite/task/contractor fields — audio never
  leaves the phone, keeping the AI call tiny, fast, and cheap.
- Every handler derives `worker_id` from the verified Cognito JWT (`sub`), never from
  client input — a caller can only ever read/write their own records. Photo/voice
  evidence is stored in a private S3 bucket and only ever exposed via short-lived
  presigned URLs, scoped server-side to the caller's own key prefix.
- Persistent login via Cognito refresh tokens (no repeated OTP for daily use), a
  mandatory profile-completion step for first-time phone numbers, and a fully offline
  app shell (hand-written service worker, not just offline data) so the app also *loads*
  with zero network.

## AWS usage, mapped to the hackathon's tracks

**Build It** (open-source AWS stack, local, no account/card/bill required):
- **AWS SAM CLI** — `sam local start-api` runs the exact same Lambda code locally against
  real AWS resources; `sam build --cached --parallel` and `sam sync --watch` for fast
  local iteration.

**Ship It** (deployed live on AWS):
- **Amazon Cognito** — phone-number-as-username user pool with a fully custom
  Lambda-trigger auth flow (Define/Create/VerifyAuthChallenge + PreSignUp) for
  passwordless SMS OTP, not Cognito's built-in SMS-MFA.
- **AWS Lambda** (Node.js 20, ESM) — 12 functions: 4 Cognito auth triggers, and 8
  API-facing handlers (record/get attendance, get/update profile, Bedrock structuring,
  presigned upload URL, presigned view URL, monthly summary cron).
- **Amazon API Gateway** (REST) — Cognito User Pool authorizer as the default authorizer
  on every route.
- **Amazon DynamoDB** — 3 on-demand tables (attendance, workers, summaries).
- **Amazon S3** — private bucket for selfies/voice notes, accessed only via short-lived
  presigned PUT (upload) and GET (view) URLs, never a public bucket policy.
- **Amazon Bedrock** (Claude 3 Haiku) — structures a Hindi/English/Hinglish voice
  transcript into worksite/task/contractor/shift fields.
- **Amazon SNS** — OTP SMS delivery, invoked from the Cognito custom-auth Lambda trigger.
- **AWS Amplify Hosting** — deploys the `frontend/` sub-folder straight from the connected
  Git branch.

All free-tier-eligible / near-$0 at hackathon scale, covered by the event's AWS credits.

## Prerequisites (do these first — see spec §5)

1. AWS account with hackathon credits applied; AWS CLI configured (`aws configure`),
   region `ap-south-1`.
2. Node.js 20.x and AWS SAM CLI installed.
3. **Day 1**: verify your test phone number(s) in the SNS sandbox (SNS console → "Text
   messaging (SMS)" → sandbox destinations), or request production SMS access. Do this
   immediately — it can take time to process.
4. A GitHub repo for Amplify Hosting to deploy from.

## Backend

```bash
cd backend
npm install
sam build
sam local start-api        # serves the API on localhost:3000 against real AWS resources
```

Deploy:
```bash
sam build --cached --parallel
sam deploy --guided --stack-name haazri --region ap-south-1 --capabilities CAPABILITY_IAM
```
Copy the four `Outputs` (`ApiUrl`, `UserPoolId`, `UserPoolClientId`, `BucketName`) into
`frontend/.env`. For fast iteration afterward, `sam sync --stack-name haazri --watch`
pushes code-only changes directly to the deployed functions in seconds.

## Frontend

```bash
cd frontend
npm install
cp .env.example .env       # fill in the four values from sam deploy output
npm start                  # localhost:3000 (use PORT=3001 if sam local is also running)
```

Connect the `frontend/` subfolder to AWS Amplify Hosting (it reads `frontend/amplify.yml`,
which also sets cache headers so the app auto-updates on every reopen with no reinstall)
and set the same four `REACT_APP_*` variables in the Amplify console.

## The screens

- **Login** (pre-auth): phone number → OTP → verified, session persists across reloads.
- **Complete your profile** (first-time phone numbers only): name required before
  anything else is reachable.
- **Home**: the big green button; optional photo/voice-note capture right after a tap,
  each with its own visible upload/sync status.
- **Calendar**: month grid with present/absent dots and totals; tap any day for full
  detail — time, GPS accuracy with a map link, worksite/task/contractor if voice-captured,
  the wage, and the selfie itself (via a short-lived signed URL); WhatsApp share of a
  client-side-generated summary image.
- **Profile**: name, phone (read-only), language, daily wage rate, log out.

## Android app

`frontend/` is a full PWA (installable manifest with real icons, an offline service
worker for the app shell on top of the existing IndexedDB data queue) — a worker can
already "Add to Home Screen" on Android and get an app-like, offline-capable experience
with zero extra work. For a real installable APK/Play Store listing, see
[`android/README.md`](./android/README.md): it's wrapped as a single Trusted Web Activity
(TWA), reusing 100% of this codebase instead of a separate native rewrite. Generating the
actual Android project is one command (`bubblewrap init`) but needs your live deployed
URL first — see that README for the exact steps once `sam deploy` + Amplify are done.

## What we'd build next

Amazon Verified Permissions/Cedar for a fine-grained Cedar policy layer on top of the
existing structural row-ownership checks, an EventBridge monthly cron to pre-compute
summaries server-side, and a Lambda Layer to speed up cold builds further (today's 12
functions share one dependency tree, rebuilt per-function by default).
