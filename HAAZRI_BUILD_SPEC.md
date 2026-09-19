# हाज़िरी (Haazri) — Engineering Build Specification

**Purpose of this document**: This is a self-contained build spec for an autonomous coding agent (Claude Code). It contains every architectural decision, schema, contract, and code skeleton needed to build and deploy the project without the agent having to make judgment calls. Where the earlier ideation pass (Qwen) left something ambiguous, unsafe, or fragile under time pressure, this document overrides it and says so explicitly in **Section 2.5**.

**Event context**: First Commit Hackathon, Sept 17–20, 2026 (today is Day 1). Teams of 1–4. Tracks: Build It (open-source AWS stack, local), Ship It (deployed on AWS, live URL — this is where the grand prize is decided), Best UI. One submission is judged across all three tracks simultaneously.

**Project**: Haazri — a one-button, voice-first, offline-first proof-of-attendance app for India's daily wage workers. A worker taps one button; the app captures GPS + timestamp + an optional voice note + an optional selfie; Amazon Bedrock structures the voice note into worksite/task/contractor fields; the record becomes a permanent, append-only, GPS-and-time-stamped entry the worker can turn into a shareable monthly wage-proof image on WhatsApp.

---

## 0. How the Agent Should Use This Document

1. Read Sections 1–5 fully before writing any code. They define scope and prevent wasted work.
2. Build in the exact phase order given in **Section 19**. Each phase has a verification gate — do not start the next phase until the current one's gate passes.
3. Treat **Section 2 (Scope Contract)** as binding. If a phase's core requirement is done and time/tokens are constrained, stop and move to the next phase rather than polishing. A working Phase 3 beats a beautiful, incomplete Phase 5.
4. Never silently deviate from the API contract (Section 10) or DB schema (Section 7) — they are the seam between frontend and backend and both sides are written against them in this document.
5. Where a step requires a human (AWS console action, phone verification, recording a video), stop and clearly tell the user what to do — do not attempt to fake or skip it.
6. Use the exact package versions/APIs given here where specified (e.g., AWS SDK v3, Node 20). Do not "helpfully" swap in a different auth library or state manager not listed in Section 3.

---

## 1. Project Snapshot

**The problem**: ~150 million Indian daily wage workers have no attendance record. At month's end, the contractor's memory is the only ledger, and it favors the contractor. There is no punch clock, no app, no paper trail that survives a dispute.

**The insight**: The worker doesn't need an "app" in the HR-software sense. They need a **timestamped, geolocated, tamper-evident receipt of their own presence** — captured in under 5 seconds, with zero typing, in Hindi, with or without internet.

**The unit of value**:
```
PROOF = { who: worker_id, when: ISO-8601 timestamp, where: GPS lat/lng/accuracy,
          what: optional voice note → structured by Bedrock, evidence: optional selfie }
```
Everything else — the calendar view, the WhatsApp share, the auth — exists to make that one unit of proof easy to create and easy to distribute.

**Why this beats a "reject on ambiguity" build**: the whole design is optimized for a semi-literate user on a ₹6,000 Android phone with a cracked screen, in sunlight, on a 1GB/month data plan. One giant button. Two choices per screen, max. No English required in the core flow. Dark UI by default (battery + glare). This is also the strongest lever for the Best UI track.

---

## 2. Scope Contract

### 2.1 MUST ship (this is what gets judged — build this first, protect it at all costs)

| # | Capability | Why it's core |
|---|---|---|
| 1 | Phone-OTP login (Cognito, passwordless) | Gatekeeps everything; must be rock solid on Day 1 |
| 2 | Tap button → capture GPS + timestamp → save (works fully offline via IndexedDB, syncs when online) | This is the entire value proposition |
| 3 | Optional voice note → Web Speech API transcription → Bedrock structures it into worksite/task/contractor | The "wow" / AI-integration moment for the demo |
| 4 | Optional selfie capture, compressed, uploaded via pre-signed S3 URL | Evidence layer |
| 5 | Calendar screen: month view with present/absent dots, computed total days & wages | Turns raw records into something a worker/contractor can read at a glance |
| 6 | Client-side generated monthly summary image + WhatsApp share (`navigator.share` / `wa.me` fallback) | The distribution mechanism — this is what actually ends a wage dispute |
| 7 | Deployed live on AWS Amplify Hosting with a public HTTPS URL | Mandatory for Ship It track |
| 8 | `sam local start-api` working against the same Lambda code | Mandatory for Build It track overlap — same codebase, two tracks |
| 9 | Attendance records are append-only (no update/delete endpoint exists) | Baseline tamper-proofing — see 2.5 item 4 |

### 2.2 SHOULD ship if time remains (do these only after 2.1 is fully working end-to-end and demoable)

- Worker profile screen (name, phone, language, daily wage rate) — Section 12 covers it; not hard, low risk.
- Automated EventBridge monthly cron that pre-computes summaries server-side.
- Amazon Verified Permissions (Cedar) fine-grained authorization layer (Section 15.3).

### 2.3 EXPLICITLY OUT OF SCOPE — do not build these, do not let the agent wander into them

- Contractor-facing dashboard, contractor accounts/roles, or a "verify attendance" endpoint.
- Hourly wages, multiple wage rates per worker, shift differentials.
- Any language beyond Hindi + English UI strings.
- A native mobile app (Android/iOS). This is a PWA. Full stop.
- Server-side canvas image rendering (`@napi-rs/canvas` in Lambda). Summary images are generated **client-side only** for this build (see 2.5 item 3).
- Step Functions orchestration for the summary pipeline (see 2.5 item 5).
- Redux, MobX, Zustand, or any state library beyond React Context — the app has 4 screens.
- Any backend language other than Node.js 20 (no Python Lambdas, no Go).

### 2.4 Definition of "done" for this hackathon

A stranger can: open the live Amplify URL on a phone → log in with a phone number + OTP → tap the button → see a green confirmation with a Hindi voice line → open Calendar and see today marked → generate and share a monthly summary image on WhatsApp — all without the app ever crashing or losing the tap, online or offline.

### 2.5 Corrections & Deviations From the Original Concept Pass

The earlier ideation document (produced with Qwen) was excellent for pitching but contains a few decisions that would cause real bugs or wasted hackathon time if implemented literally. This spec makes the following corrections, and the rest of this document is written consistently with them:

1. **Idempotent upsert instead of "reject duplicate POST."** An offline-first app *must* retry failed syncs. If `POST /attendance` hard-rejects a second call for the same day, a client that successfully synced but never received the response (flaky 2G) will treat a 409 as an error forever. Instead, `POST /attendance` is an **idempotent upsert** keyed on `(worker_id, record_date)`: the first call creates the record and preserves the original GPS/timestamp forever; later calls the same day only add fields that are still null (e.g., attaching a voice note a few minutes after the GPS tap). This is safer and is what production attendance systems actually do.
2. **GPS accuracy never blocks a record from being saved.** The concept doc contradicted itself (API contract said "reject if accuracy > 500m," edge-case table said "warn and let the user record anyway"). We keep the second behavior: the backend stores a `gps_quality` tier (`high` ≤ 50m, `medium` ≤ 500m, `low` > 500m) and never refuses to save. Losing a record is worse than a low-confidence record. The frontend still shows a "GPS is weak, save anyway?" prompt above 500m, but the answer the user picks doesn't change what the backend does.
3. **Summary images are generated 100% client-side with `<canvas>`.** The original doc proposed a server-side Lambda using `@napi-rs/canvas` (a native binary module) for "production." Native binary Lambda layers are a common source of "works on my machine, fails in Lambda" bugs and are not worth the risk in a 4-day build. Client-side canvas → `toBlob` → upload via pre-signed URL is simpler, has zero extra AWS surface, and is demoable identically.
4. **Tamper-proofing baseline is structural, not policy-based.** Rather than depending on Cedar/Amazon Verified Permissions being correctly wired before the demo, the API simply **never implements an update or delete endpoint for attendance records**. You cannot violate an invariant enforced by an endpoint that does not exist. Cedar/AVP (Section 15.3) is an optional, additive layer for "Built on AWS" scoring — it is never a dependency for the core flow to work.
5. **Monthly summary generation is one Lambda, not a Step Functions state machine**, for the MVP. Step Functions adds visual/architectural nicety but real orchestration risk for a feature that isn't even in the critical demo path (the demo shows the *client-side* summary generation, which works the moment a worker has any records this month — it doesn't need to wait for a monthly cron at all). Step Functions is listed as an optional Phase 5 enhancement only.
6. **Cognito phone-OTP auth is implemented via the Custom Authentication Lambda trigger flow** (Define/Create/VerifyAuthChallenge + PreSignUp), which is the standard, correct way to do passwordless SMS OTP in Cognito. The original doc said "Cognito sends OTP via SMS" without specifying the mechanism — that one sentence hides real complexity. Section 14 gives the full, correct implementation. **Also note the SNS sandbox trap**: new AWS accounts can only send SMS to *verified* numbers until you request production access. Do this on Day 1 (Section 14.4), not Day 4, or your own demo phone number won't receive an OTP.

---

## 3. Tech Stack (final — do not substitute)

### Frontend
| Layer | Choice | Version/Notes |
|---|---|---|
| Framework | React 18 (Create React App) | No Next.js — we don't need SSR, and Amplify Hosting deploys CRA output trivially |
| Styling | Tailwind CSS | Utility classes only, no component library |
| State | React Context + `useReducer` | No Redux/Zustand |
| Offline storage | IndexedDB via `idb-keyval` | Zero-boilerplate key-value wrapper |
| Voice input | Web Speech API (`webkitSpeechRecognition`), `lang: 'hi-IN'` | Not supported on iOS Safari — must degrade gracefully (Section 20) |
| Geolocation | `navigator.geolocation` | Native, no SDK |
| Camera | `<input type="file" accept="image/*" capture="environment">` | Native, no SDK |
| Auth calls | `@aws-sdk/client-cognito-identity-provider` | Direct SDK calls, no Amplify Auth library, no `amazon-cognito-identity-js` — fewer moving parts for a custom-auth flow |
| Voice synthesis | `speechSynthesis.speak()` | Native |
| Deployment | AWS Amplify Hosting | Connected to the `frontend/` sub-folder of the repo |

### Backend
| Layer | Choice | Version/Notes |
|---|---|---|
| Compute | AWS Lambda, Node.js 20.x, ESM (`"type": "module"`) | |
| API | Amazon API Gateway (REST API / `AWS::Serverless::Api`), Cognito User Pool authorizer | |
| Database | Amazon DynamoDB, on-demand billing | 3 tables, see Section 7 |
| Object storage | Amazon S3 | Pre-signed URLs only, nothing uploaded through Lambda |
| AI | Amazon Bedrock, `anthropic.claude-3-haiku-20240307-v1:0` | Text-only input (transcript), never audio |
| Auth | Amazon Cognito User Pool, Custom Authentication Lambda triggers | Phone number as username |
| SMS | Amazon SNS (via Cognito's Lambda triggers, not Cognito's built-in SMS-MFA) | |
| Scheduling (stretch) | Amazon EventBridge | Monthly cron |
| IaC | AWS SAM CLI | `template.yaml`, one stack |
| Local dev | `sam local start-api` + `sam local invoke` | Runs Lambda code locally; hits real AWS DynamoDB/S3/Bedrock/Cognito by default using your AWS credentials (this alone satisfies "Build It" track's local-execution requirement) |
| AWS SDK | `@aws-sdk/*` v3, modular imports | No SDK v2 anywhere |

---

## 4. Repository Layout

```
haazri/
├── README.md
├── backend/
│   ├── template.yaml
│   ├── package.json
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── record-attendance.js
│   │   │   ├── get-attendance.js
│   │   │   ├── get-profile.js
│   │   │   ├── update-profile.js
│   │   │   ├── bedrock-structure.js
│   │   │   ├── presigned-url.js
│   │   │   └── monthly-summary.js        (stretch)
│   │   ├── auth-triggers/
│   │   │   ├── pre-sign-up.js
│   │   │   ├── define-auth-challenge.js
│   │   │   ├── create-auth-challenge.js
│   │   │   └── verify-auth-challenge-response.js
│   │   └── lib/
│   │       ├── ddb.js
│   │       ├── http.js
│   │       └── dates.js
│   └── tests/
│       └── events/
│           ├── record-attendance.json
│           └── bedrock-structure.json
├── frontend/
│   ├── public/
│   │   └── manifest.json
│   ├── src/
│   │   ├── api/client.js
│   │   ├── auth/
│   │   │   ├── AuthContext.jsx
│   │   │   └── cognitoClient.js
│   │   ├── hooks/
│   │   │   ├── useGeolocation.js
│   │   │   ├── useSpeechToText.js
│   │   │   └── useOfflineQueue.js
│   │   ├── utils/
│   │   │   ├── canvasSummary.js
│   │   │   ├── whatsappShare.js
│   │   │   └── imageCompression.js
│   │   ├── components/
│   │   │   ├── HaazriButton.jsx
│   │   │   ├── StatusBanner.jsx
│   │   │   ├── BottomNav.jsx
│   │   │   └── CalendarGrid.jsx
│   │   ├── screens/
│   │   │   ├── Login.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── Calendar.jsx
│   │   │   └── Profile.jsx
│   │   ├── theme/colors.js
│   │   ├── i18n/strings.js
│   │   ├── App.jsx
│   │   └── index.js
│   ├── tailwind.config.js
│   ├── package.json
│   ├── .env.example
│   └── amplify.yml
```

---

## 5. Prerequisites & One-Time Manual Setup (human, not the agent)

Tell the user to do these before/alongside Phase 0 — the agent cannot do them:

1. An AWS account with the hackathon's AWS credits applied, and AWS CLI configured locally (`aws configure`) with a region of `ap-south-1` (Mumbai — lowest latency for India, and required for the hackathon's India-based judging/demo).
2. Node.js 20.x and the AWS SAM CLI installed locally.
3. **Day 1, not Day 4**: go to the SNS console → "Text messaging (SMS)" → check whether the account is in the SMS sandbox. If it is, add your own test phone number(s) as verified sandbox destinations (an SMS with a code arrives instantly), or submit a request to move to production access. Either path can have a delay — start it immediately.
4. A GitHub repo to push this project to (Amplify Hosting deploys from a connected Git branch).

If any of these are missing when the agent reaches a step that needs them, it should stop and ask, not fabricate credentials or skip the step silently.

---

## 6. Environment Variables & Config

`frontend/.env.example`:
```
REACT_APP_API_URL=https://<api-id>.execute-api.ap-south-1.amazonaws.com/prod/v1
REACT_APP_AWS_REGION=ap-south-1
REACT_APP_USER_POOL_ID=ap-south-1_XXXXXXXXX
REACT_APP_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```
These four values come from the `sam deploy` outputs (Section 18) — copy them into `frontend/.env` (which must be gitignored) before running the frontend.

`backend/package.json` dependencies (all handlers share this one dependency tree; SAM zips the whole `backend/` folder per function):
```json
{
  "name": "haazri-backend",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.600.0",
    "@aws-sdk/lib-dynamodb": "^3.600.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "@aws-sdk/client-bedrock-runtime": "^3.600.0",
    "@aws-sdk/client-sns": "^3.600.0"
  }
}
```

---

## 7. Data Model — DynamoDB Tables

### 7.1 `haazri-attendance` (the core table)

```
PK: worker_id   (String, Cognito `sub`)
SK: record_date (String, "YYYY-MM-DD")
```

| Attribute | Type | Notes |
|---|---|---|
| `worker_id` | S | Cognito `sub` |
| `record_date` | S | `YYYY-MM-DD`, IST |
| `timestamp` | S | ISO-8601, **server time**, set once, never overwritten |
| `gps_lat`, `gps_lng` | N | |
| `gps_accuracy` | N | meters |
| `gps_quality` | S | `high` / `medium` / `low` — derived, never blocks a save (see 2.5.2) |
| `selfie_s3_key` | S | nullable |
| `voice_s3_key` | S | nullable |
| `voice_transcript` | S | nullable, raw text from Web Speech API |
| `worksite_name`, `task_type`, `contractor_name`, `shift_type` | S | nullable, filled by Bedrock |
| `bedrock_confidence` | N | nullable |
| `wage_rate` | N | ₹/day, copied from worker profile at write time |
| `status` | S | `"present"` (only value written by this app in MVP) |
| `is_retroactive` | BOOL | true if `record_date` ≠ date of `timestamp` |
| `created_at` | S | set once via `if_not_exists` |
| `updated_at` | S | set on every write |

GSI-1 `contractor-index`: PK `contractor_name`, SK `record_date` — not used by any MVP endpoint; kept for the out-of-scope contractor view, cheap to include now, free to ignore later.

**No update or delete API exists for this table's items outside of the upsert described in 2.5.1.** This is the tamper-proofing baseline.

### 7.2 `haazri-workers`

```
PK: worker_id (String, Cognito `sub`)
```
| Attribute | Type |
|---|---|
| `worker_id` | S |
| `phone_number` | S |
| `display_name` | S, nullable |
| `preferred_language` | S, `"hi"` \| `"en"` |
| `default_wage_rate` | N |
| `created_at` | S |

### 7.3 `haazri-summaries` (stretch — only needed if Phase 5's EventBridge cron is built)

```
PK: worker_id (String)
SK: month_key  (String, "YYYY-MM")
```
| Attribute | Type |
|---|---|
| `total_days` | N |
| `total_wages` | N |
| `generated_at` | S |

---

## 8. AWS Infrastructure — `backend/template.yaml`

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Haazri - Digital Wage Proof for Daily Wage Workers

Globals:
  Function:
    Runtime: nodejs20.x
    MemorySize: 256
    Timeout: 15
    CodeUri: ./
    Environment:
      Variables:
        ATTENDANCE_TABLE: !Ref AttendanceTable
        WORKERS_TABLE: !Ref WorkersTable
        SUMMARIES_TABLE: !Ref SummariesTable
        BUCKET_NAME: !Ref HaazriBucket
        BEDROCK_MODEL_ID: "anthropic.claude-3-haiku-20240307-v1:0"
  Api:
    Cors:
      AllowMethods: "'GET,POST,PUT,OPTIONS'"
      AllowHeaders: "'Content-Type,Authorization'"
      AllowOrigin: "'*'"

Resources:

  # ───────────────────────── API Gateway ─────────────────────────
  HaazriApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Auth:
        DefaultAuthorizer: CognitoAuthorizer
        Authorizers:
          CognitoAuthorizer:
            UserPoolArn: !GetAtt HaazriUserPool.Arn

  # ───────────────────────── DynamoDB ─────────────────────────
  AttendanceTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: haazri-attendance
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: worker_id
          AttributeType: S
        - AttributeName: record_date
          AttributeType: S
        - AttributeName: contractor_name
          AttributeType: S
      KeySchema:
        - AttributeName: worker_id
          KeyType: HASH
        - AttributeName: record_date
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: contractor-index
          KeySchema:
            - AttributeName: contractor_name
              KeyType: HASH
            - AttributeName: record_date
              KeyType: RANGE
          Projection:
            ProjectionType: ALL

  WorkersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: haazri-workers
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: worker_id
          AttributeType: S
      KeySchema:
        - AttributeName: worker_id
          KeyType: HASH

  SummariesTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: haazri-summaries
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: worker_id
          AttributeType: S
        - AttributeName: month_key
          AttributeType: S
      KeySchema:
        - AttributeName: worker_id
          KeyType: HASH
        - AttributeName: month_key
          KeyType: RANGE

  # ───────────────────────── S3 ─────────────────────────
  HaazriBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      CorsConfiguration:
        CorsRules:
          - AllowedMethods: [GET, PUT]
            AllowedOrigins: ['*']
            AllowedHeaders: ['*']
      LifecycleConfiguration:
        Rules:
          - Id: DeleteVoiceAfter90Days
            Prefix: voice/
            Status: Enabled
            ExpirationInDays: 90

  # ───────────────────────── API Lambdas ─────────────────────────
  RecordAttendanceFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-record-attendance
      Handler: src/handlers/record-attendance.handler
      Policies:
        - DynamoDBCrudPolicy: { TableName: !Ref AttendanceTable }
        - DynamoDBReadPolicy: { TableName: !Ref WorkersTable }
      Events:
        Post:
          Type: Api
          Properties: { RestApiId: !Ref HaazriApi, Path: /v1/attendance, Method: POST }

  GetAttendanceFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-get-attendance
      Handler: src/handlers/get-attendance.handler
      Policies:
        - DynamoDBReadPolicy: { TableName: !Ref AttendanceTable }
      Events:
        Get:
          Type: Api
          Properties: { RestApiId: !Ref HaazriApi, Path: /v1/attendance, Method: GET }

  GetProfileFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-get-profile
      Handler: src/handlers/get-profile.handler
      Policies:
        - DynamoDBReadPolicy: { TableName: !Ref WorkersTable }
      Events:
        Get:
          Type: Api
          Properties: { RestApiId: !Ref HaazriApi, Path: /v1/worker/profile, Method: GET }

  UpdateProfileFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-update-profile
      Handler: src/handlers/update-profile.handler
      Policies:
        - DynamoDBCrudPolicy: { TableName: !Ref WorkersTable }
      Events:
        Put:
          Type: Api
          Properties: { RestApiId: !Ref HaazriApi, Path: /v1/worker/profile, Method: PUT }

  BedrockStructureFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-bedrock-structure
      Handler: src/handlers/bedrock-structure.handler
      Timeout: 20
      Policies:
        - Statement:
            - Effect: Allow
              Action: [bedrock:InvokeModel]
              Resource: "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      Events:
        Post:
          Type: Api
          Properties: { RestApiId: !Ref HaazriApi, Path: /v1/voice/structure, Method: POST }

  PresignedUrlFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-presigned-url
      Handler: src/handlers/presigned-url.handler
      Policies:
        - S3WritePolicy: { BucketName: !Ref HaazriBucket }
      Events:
        Post:
          Type: Api
          Properties: { RestApiId: !Ref HaazriApi, Path: /v1/media/upload-url, Method: POST }

  # ───────────────────────── Monthly summary (stretch) ─────────────────────────
  MonthlySummaryFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-monthly-summary
      Handler: src/handlers/monthly-summary.handler
      Timeout: 60
      Policies:
        - DynamoDBReadPolicy: { TableName: !Ref AttendanceTable }
        - DynamoDBReadPolicy: { TableName: !Ref WorkersTable }
        - DynamoDBCrudPolicy: { TableName: !Ref SummariesTable }
      Events:
        MonthlyCron:
          Type: Schedule
          Properties:
            Schedule: "cron(30 0 1 * ? *)"   # 06:00 IST on the 1st

  # ───────────────────────── Cognito ─────────────────────────
  HaazriUserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: haazri-users
      UsernameAttributes: [phone_number]
      AutoVerifiedAttributes: [phone_number]
      Schema:
        - Name: phone_number
          Required: true
          Mutable: false
      LambdaConfig:
        PreSignUp: !GetAtt PreSignUpFunction.Arn
        DefineAuthChallenge: !GetAtt DefineAuthChallengeFunction.Arn
        CreateAuthChallenge: !GetAtt CreateAuthChallengeFunction.Arn
        VerifyAuthChallengeResponse: !GetAtt VerifyAuthChallengeResponseFunction.Arn

  HaazriUserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      UserPoolId: !Ref HaazriUserPool
      ExplicitAuthFlows: [ALLOW_CUSTOM_AUTH, ALLOW_REFRESH_TOKEN_AUTH]
      GenerateSecret: false

  PreSignUpFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-pre-sign-up
      Handler: src/auth-triggers/pre-sign-up.handler

  DefineAuthChallengeFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-define-auth-challenge
      Handler: src/auth-triggers/define-auth-challenge.handler

  CreateAuthChallengeFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-create-auth-challenge
      Handler: src/auth-triggers/create-auth-challenge.handler
      Policies:
        - Statement:
            - Effect: Allow
              Action: [sns:Publish]
              Resource: "*"

  VerifyAuthChallengeResponseFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: haazri-verify-auth-challenge
      Handler: src/auth-triggers/verify-auth-challenge-response.handler

  # Cognito needs explicit permission to invoke each trigger
  PreSignUpPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref PreSignUpFunction
      Action: lambda:InvokeFunction
      Principal: cognito-idp.amazonaws.com
      SourceArn: !GetAtt HaazriUserPool.Arn

  DefineAuthChallengePermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref DefineAuthChallengeFunction
      Action: lambda:InvokeFunction
      Principal: cognito-idp.amazonaws.com
      SourceArn: !GetAtt HaazriUserPool.Arn

  CreateAuthChallengePermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref CreateAuthChallengeFunction
      Action: lambda:InvokeFunction
      Principal: cognito-idp.amazonaws.com
      SourceArn: !GetAtt HaazriUserPool.Arn

  VerifyAuthChallengePermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref VerifyAuthChallengeResponseFunction
      Action: lambda:InvokeFunction
      Principal: cognito-idp.amazonaws.com
      SourceArn: !GetAtt HaazriUserPool.Arn

Outputs:
  ApiUrl:
    Value: !Sub "https://${HaazriApi}.execute-api.${AWS::Region}.amazonaws.com/prod/v1"
  UserPoolId:
    Value: !Ref HaazriUserPool
  UserPoolClientId:
    Value: !Ref HaazriUserPoolClient
  BucketName:
    Value: !Ref HaazriBucket
```

---

## 9. Backend — Lambda Function Code

### 9.1 `src/lib/ddb.js`
```javascript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
```

### 9.2 `src/lib/http.js`
```javascript
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export const ok = (body, statusCode = 200) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...CORS },
  body: JSON.stringify(body),
});

export const err = (statusCode, message) => ok({ error: message }, statusCode);

export const getWorkerId = (event) =>
  event.requestContext?.authorizer?.claims?.sub;
```

### 9.3 `src/lib/dates.js`
```javascript
// IST is UTC+5:30, no DST. This is the single source of truth for "what date is it".
export const toISTDateString = (isoTimestamp) => {
  const d = new Date(isoTimestamp);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10); // "YYYY-MM-DD"
};

export const nowIST = () => new Date().toISOString();
```

### 9.4 `src/handlers/record-attendance.js`
```javascript
import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";
import { ok, err, getWorkerId } from "../lib/http.js";
import { toISTDateString, nowIST } from "../lib/dates.js";

const gpsQuality = (accuracy) => {
  if (accuracy == null) return "unknown";
  if (accuracy <= 50) return "high";
  if (accuracy <= 500) return "medium";
  return "low";
};

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const { timestamp, gps_lat, gps_lng, gps_accuracy } = body;
  if (!timestamp || gps_lat == null || gps_lng == null) {
    return err(400, "timestamp, gps_lat, gps_lng are required");
  }

  const serverNow = nowIST();
  const record_date = body.record_date || toISTDateString(timestamp);
  if (record_date > toISTDateString(serverNow)) {
    return err(400, "record_date cannot be in the future");
  }
  const is_retroactive = record_date !== toISTDateString(timestamp);

  // Idempotent upsert (see spec 2.5.1): original timestamp/gps are set once via
  // if_not_exists and never overwritten by a later call the same day.
  const updateExpr = [
    "SET #ts = if_not_exists(#ts, :ts)",
    "gps_lat = if_not_exists(gps_lat, :lat)",
    "gps_lng = if_not_exists(gps_lng, :lng)",
    "gps_accuracy = if_not_exists(gps_accuracy, :acc)",
    "gps_quality = if_not_exists(gps_quality, :qual)",
    "created_at = if_not_exists(created_at, :now)",
    "updated_at = :now",
    "#st = if_not_exists(#st, :present)",
    "is_retroactive = if_not_exists(is_retroactive, :retro)",
  ];
  const names = { "#ts": "timestamp", "#st": "status" };
  const values = {
    ":ts": timestamp,
    ":lat": gps_lat,
    ":lng": gps_lng,
    ":acc": gps_accuracy ?? null,
    ":qual": gpsQuality(gps_accuracy),
    ":now": serverNow,
    ":present": "present",
    ":retro": is_retroactive,
  };

  // Optional fields: only set if provided and not already present.
  const optionalFields = {
    selfie_s3_key: body.selfie_s3_key,
    voice_s3_key: body.voice_s3_key,
    voice_transcript: body.voice_transcript,
    worksite_name: body.worksite_name,
    task_type: body.task_type,
    contractor_name: body.contractor_name,
    shift_type: body.shift_type,
    bedrock_confidence: body.bedrock_confidence,
    wage_rate: body.wage_rate,
  };
  for (const [key, val] of Object.entries(optionalFields)) {
    if (val !== undefined && val !== null) {
      updateExpr.push(`${key} = if_not_exists(${key}, :${key})`);
      values[`:${key}`] = val;
    }
  }

  await ddb.send(
    new UpdateCommand({
      TableName: process.env.ATTENDANCE_TABLE,
      Key: { worker_id, record_date },
      UpdateExpression: updateExpr.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );

  return ok(
    {
      status: "recorded",
      record_id: `${worker_id}#${record_date}`,
      message_hi: "हाज़िरी हो गई ✓",
    },
    201
  );
};
```

### 9.5 `src/handlers/get-attendance.js`
```javascript
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";
import { ok, err, getWorkerId } from "../lib/http.js";

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  const qs = event.queryStringParameters || {};
  let { from, to, month } = qs;
  if (month && !(from && to)) {
    from = `${month}-01`;
    to = `${month}-31`;
  }
  if (!from || !to) return err(400, "Provide from & to (YYYY-MM-DD) or month (YYYY-MM)");

  const result = await ddb.send(
    new QueryCommand({
      TableName: process.env.ATTENDANCE_TABLE,
      KeyConditionExpression: "worker_id = :wid AND record_date BETWEEN :from AND :to",
      ExpressionAttributeValues: { ":wid": worker_id, ":from": from, ":to": to },
    })
  );

  const records = result.Items || [];
  const present = records.filter((r) => r.status === "present");
  const total_wages = present.reduce((sum, r) => sum + (r.wage_rate || 0), 0);

  return ok({
    worker_id,
    records,
    summary: { total_days: present.length, total_wages },
  });
};
```

### 9.6 `src/handlers/get-profile.js`
```javascript
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";
import { ok, err, getWorkerId } from "../lib/http.js";

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  const result = await ddb.send(
    new GetCommand({ TableName: process.env.WORKERS_TABLE, Key: { worker_id } })
  );

  return ok(result.Item || { worker_id, profile_incomplete: true });
};
```

### 9.7 `src/handlers/update-profile.js`
```javascript
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";
import { ok, err, getWorkerId } from "../lib/http.js";
import { nowIST } from "../lib/dates.js";

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const phone_number = event.requestContext.authorizer.claims.phone_number;
  const item = {
    worker_id,
    phone_number,
    display_name: body.display_name ?? null,
    preferred_language: body.preferred_language ?? "hi",
    default_wage_rate: body.default_wage_rate ?? 0,
    created_at: nowIST(),
  };

  await ddb.send(new PutCommand({ TableName: process.env.WORKERS_TABLE, Item: item }));
  return ok(item);
};
```

### 9.8 `src/handlers/bedrock-structure.js`
```javascript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ok, err } from "../lib/http.js";

const client = new BedrockRuntimeClient({});

const SYSTEM_PROMPT = `You are a data extraction engine for a construction worker attendance system in India. You receive raw voice transcriptions in Hindi, English, or mixed Hindi-English (Hinglish).

Rules:
1. Return ONLY valid JSON. No markdown, no code fences, no explanation.
2. If a field cannot be determined, set it to null.
3. Worksite names often include the contractor's name (e.g., "Sharma ji ka site").
4. task_type must be one of: painting, plumbing, electrical, masonry, loading, digging, welding, carpentry, cleaning, gardening, farming, driving, tile_work, plastering, demolition, other, null.
5. shift_type must be one of: morning, afternoon, night, full_day, unknown.
6. If the transcript is too vague to extract anything reliable, return all fields null with confidence 0.0.

Output schema (exact keys, no extras):
{"worksite_name": string|null, "task_type": string|null, "contractor_name": string|null, "shift_type": string, "language_detected": string, "confidence": number}`;

const FALLBACK = {
  worksite_name: null,
  task_type: null,
  contractor_name: null,
  shift_type: "unknown",
  language_detected: "unknown",
  confidence: 0.0,
};

const stripFences = (text) => text.replace(/```json\s*|```/g, "").trim();

export const handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const { transcript } = body;
  if (!transcript || transcript.trim().length < 5) {
    return err(400, "Transcript too short");
  }

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: `Transcription: "${transcript}"` }] }],
  };

  try {
    const response = await client.send(
      new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      })
    );
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const rawText = responseBody.content?.[0]?.text || "";
    const structured = JSON.parse(stripFences(rawText));
    return ok(structured);
  } catch (e) {
    console.error("Bedrock structuring failed, saving raw transcript only:", e);
    return ok(FALLBACK); // never fail the request — the raw transcript is still saved by the caller
  }
};
```

### 9.9 `src/handlers/presigned-url.js`
```javascript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ok, err, getWorkerId } from "../lib/http.js";

const s3 = new S3Client({});
const LIMITS = { selfie: 2_000_000, voice: 5_000_000 }; // bytes, post-compression

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const { media_type, file_type, file_size_bytes } = body;
  if (!["selfie", "voice"].includes(media_type)) {
    return err(400, "media_type must be 'selfie' or 'voice'");
  }
  if (file_size_bytes > LIMITS[media_type]) {
    return err(400, `${media_type} exceeds ${LIMITS[media_type]} byte limit`);
  }

  const ext = media_type === "selfie" ? "jpg" : "webm";
  const s3_key = `${media_type === "selfie" ? "selfies" : "voice"}/${worker_id}/${Date.now()}.${ext}`;

  const upload_url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: s3_key, ContentType: file_type }),
    { expiresIn: 300 }
  );

  return ok({ upload_url, s3_key, expires_in: 300 });
};
```

### 9.10 `src/handlers/monthly-summary.js` (stretch)
```javascript
import { ScanCommand, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";

// NOTE: Scan is fine at hackathon scale (dozens of workers). At real scale,
// paginate or move this to a Step Functions Map state. Not needed for the demo.
export const handler = async () => {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthKey = prevMonth.toISOString().slice(0, 7); // "YYYY-MM"

  const workers = await ddb.send(new ScanCommand({ TableName: process.env.WORKERS_TABLE }));

  for (const worker of workers.Items || []) {
    const records = await ddb.send(
      new QueryCommand({
        TableName: process.env.ATTENDANCE_TABLE,
        KeyConditionExpression: "worker_id = :wid AND begins_with(record_date, :m)",
        ExpressionAttributeValues: { ":wid": worker.worker_id, ":m": monthKey },
      })
    );
    const present = (records.Items || []).filter((r) => r.status === "present");
    const total_wages = present.reduce((s, r) => s + (r.wage_rate || 0), 0);

    await ddb.send(
      new PutCommand({
        TableName: process.env.SUMMARIES_TABLE,
        Item: {
          worker_id: worker.worker_id,
          month_key: monthKey,
          total_days: present.length,
          total_wages,
          generated_at: new Date().toISOString(),
        },
      })
    );
  }
};
```

### 9.11 Auth trigger Lambdas

`src/auth-triggers/pre-sign-up.js`
```javascript
export const handler = async (event) => {
  event.response.autoConfirmUser = true;
  event.response.autoVerifyPhone = true;
  return event;
};
```

`src/auth-triggers/define-auth-challenge.js`
```javascript
export const handler = async (event) => {
  const session = event.request.session;
  if (session.length === 0) {
    Object.assign(event.response, { issueTokens: false, failAuthentication: false, challengeName: "CUSTOM_CHALLENGE" });
  } else if (session.length >= 1 && session.slice(-1)[0].challengeResult === true) {
    Object.assign(event.response, { issueTokens: true, failAuthentication: false });
  } else if (session.length >= 3) {
    Object.assign(event.response, { issueTokens: false, failAuthentication: true }); // 3 wrong OTPs = fail
  } else {
    Object.assign(event.response, { issueTokens: false, failAuthentication: false, challengeName: "CUSTOM_CHALLENGE" });
  }
  return event;
};
```

`src/auth-triggers/create-auth-challenge.js`
```javascript
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
const sns = new SNSClient({});

export const handler = async (event) => {
  let otp;
  if (event.request.session.length === 0) {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
    await sns.send(
      new PublishCommand({
        PhoneNumber: event.request.userAttributes.phone_number,
        Message: `Your Haazri OTP is ${otp}. Valid 5 minutes. Do not share it.`,
      })
    );
  } else {
    // Re-prompt within the same session (e.g. UI retry) — do not resend a new SMS.
    const prev = event.request.session.slice(-1)[0];
    otp = prev.challengeMetadata?.replace("OTP-", "");
  }
  event.response.publicChallengeParameters = { phone: event.request.userAttributes.phone_number };
  event.response.privateChallengeParameters = { otp };
  event.response.challengeMetadata = `OTP-${otp}`;
  return event;
};
```

`src/auth-triggers/verify-auth-challenge-response.js`
```javascript
export const handler = async (event) => {
  event.response.answerCorrect =
    event.request.privateChallengeParameters.otp === event.request.challengeAnswer;
  return event;
};
```

---

## 10. API Contract

Base URL comes from `sam deploy` output `ApiUrl`. Every endpoint requires `Authorization: Bearer <Cognito ID token>` except none — all are protected.

| Method | Path | Body / Query | Success | Notes |
|---|---|---|---|---|
| POST | `/v1/attendance` | `{timestamp, gps_lat, gps_lng, gps_accuracy?, selfie_s3_key?, voice_s3_key?, voice_transcript?, worksite_name?, task_type?, contractor_name?, shift_type?, bedrock_confidence?, wage_rate?, record_date?}` | `201 {status, record_id, message_hi}` | Idempotent upsert — see 2.5.1 |
| GET | `/v1/attendance?from&to` or `?month=YYYY-MM` | — | `200 {worker_id, records[], summary:{total_days,total_wages}}` | |
| GET | `/v1/worker/profile` | — | `200 {...profile}` or `{profile_incomplete:true}` | |
| PUT | `/v1/worker/profile` | `{display_name?, preferred_language?, default_wage_rate?}` | `200 {...profile}` | |
| POST | `/v1/voice/structure` | `{transcript}` | `200 {worksite_name, task_type, contractor_name, shift_type, language_detected, confidence}` | Never errors on the client — returns a null-filled object on any Bedrock failure |
| POST | `/v1/media/upload-url` | `{media_type: "selfie"\|"voice", file_type, file_size_bytes}` | `200 {upload_url, s3_key, expires_in}` | Client then `PUT`s the file bytes directly to `upload_url` |

**Frontend capture sequencing (resolves an ambiguity in the original concept)**: on tap, GPS capture starts immediately and is the only mandatory field. Photo and voice are optional and, if the worker chooses to add them, must be captured within an ~8-second window before the client fires a single `POST /attendance` with everything gathered so far. If the worker adds a voice note after that window (record already synced), the client is allowed to call `POST /attendance` again with just the new field — the idempotent upsert (9.4) fills only the still-null fields.

---

## 11. Amazon Bedrock — Voice Intelligence

**Design decision (kept from the original concept, and correct)**: audio is never uploaded to AWS. The Web Speech API transcribes Hindi/English/Hinglish **locally on the phone**, and only the resulting **text** is sent to Bedrock via the `/v1/voice/structure` endpoint (Section 9.8). This is faster, works on flaky connections (text is tiny), and keeps Amazon Transcribe (not in the hackathon's stack) out of the picture entirely.

Example:
- Input: `"Sharma ji ke site pe Block C mein painting ka kaam kar raha hoon subah ki shift hai"`
- Output: `{"worksite_name": "Sharma ji ka site, Block C", "task_type": "painting", "contractor_name": "Sharma ji", "shift_type": "morning", "language_detected": "hi", "confidence": 0.95}`

The frontend calls this endpoint right after transcription completes, then merges the structured fields into the pending attendance record before syncing.

---

## 12. Frontend — Application Spec

### 12.1 Screens (4 total, bottom nav for Home/Calendar/Profile; Login is pre-auth, full-screen)

- **`Login.jsx`**: phone number input (E.164, `+91` prefix, digits only) → "Send OTP" → 6-digit OTP input → "Verify". On success, tokens go into `AuthContext` and route to `Home`.
- **`Home.jsx`**: the big green button (`HaazriButton`), today's status (`StatusBanner`), optional photo/voice buttons. Orchestrates the capture flow (12.4).
- **`Calendar.jsx`**: month grid (`CalendarGrid`) with green/amber/grey dots, totals, "Share on WhatsApp" button.
- **`Profile.jsx`**: name, phone (read-only), language toggle, daily wage rate input, lifetime totals.

No router library — a single `activeScreen` string in `App.jsx` state is enough for 4 screens.

### 12.2 `src/theme/colors.js`
```javascript
export const colors = {
  primaryGreen: "#22C55E",
  deepRed: "#EF4444",
  amber: "#F59E0B",
  background: "#0F172A",
  card: "#1E293B",
  textPrimary: "#F8FAFC",
};
```
Tailwind config should extend its palette with these exact tokens. Dark background is the *only* mode — no light theme toggle. Minimum touch target: 64×64px on every interactive element. Minimum font size: 18px body / 24px headings. Contrast ratio ≥ 7:1.

### 12.3 `src/hooks/useGeolocation.js`
```javascript
export function captureLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          gps_lat: pos.coords.latitude,
          gps_lng: pos.coords.longitude,
          gps_accuracy: pos.coords.accuracy,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}
```

### 12.4 `src/hooks/useSpeechToText.js`
```javascript
export function isSpeechSupported() {
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export function listenOnce({ lang = "hi-IN" } = {}) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new Error("unsupported")); // caller must fall back to manual text input
    const recognizer = new SR();
    recognizer.lang = lang;
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.onresult = (e) => resolve(e.results[0][0].transcript);
    recognizer.onerror = (e) => reject(e.error);
    recognizer.start();
  });
}
```
**iOS Safari does not implement this API at all.** `Home.jsx` must check `isSpeechSupported()` and, if false, show a small "Add a note" text input instead of the mic button. The GPS-tap flow is unaffected either way.

### 12.5 `src/hooks/useOfflineQueue.js` — the reliability core of the app
```javascript
import { get, set, del, keys } from "idb-keyval";
import { postAttendance } from "../api/client";

const QUEUE_PREFIX = "haazri-pending:";

export async function enqueue(record) {
  const id = `${QUEUE_PREFIX}${record.record_date}-${Date.now()}`;
  await set(id, record);
  return id;
}

export async function drainQueue() {
  if (!navigator.onLine) return;
  const allKeys = (await keys()).filter((k) => k.toString().startsWith(QUEUE_PREFIX));
  for (const key of allKeys) {
    const record = await get(key);
    try {
      await postAttendance(record); // idempotent server-side — safe to retry
      await del(key);
    } catch {
      // leave it queued; next interval retries. No backoff needed at this call volume.
    }
  }
}

export function startBackgroundSync(intervalMs = 30000) {
  const id = setInterval(drainQueue, intervalMs);
  window.addEventListener("online", drainQueue);
  drainQueue(); // attempt immediately on load too
  return () => {
    clearInterval(id);
    window.removeEventListener("online", drainQueue);
  };
}
```

**Home screen flow, precisely**: on tap → `captureLocation()` → build a record object → show the green checkmark + `speechSynthesis.speak("हाज़िरी हो गई")` **immediately, optimistically** → `enqueue(record)` → attempt `postAttendance` right away; on failure (offline or error) it just stays queued and `startBackgroundSync` (mounted once in `App.jsx`) picks it up. The user never sees a spinner and never sees a failure for a network problem — this is the entire point of the offline-first design.

### 12.6 `src/utils/imageCompression.js`
```javascript
export function compressImage(file, { maxBytes = 500_000, quality = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1024 / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob && blob.size <= maxBytes ? resolve(blob) : resolve(blob)), // accept best-effort; server enforces the hard limit
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
```

### 12.7 `src/utils/canvasSummary.js` — client-side summary image (see 2.5.3)
```javascript
export function drawCalendarSummary({ monthLabel, records, workerName, wageRate, totalDays, totalWages }) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText("हाज़िरी Summary", 40, 60);
  ctx.font = "24px sans-serif";
  ctx.fillText(`${workerName || ""} — ${monthLabel}`, 40, 100);

  // 7-column grid of dots, one per attended day present in `records`
  const presentDates = new Set(records.filter((r) => r.status === "present").map((r) => r.record_date));
  let x = 40, y = 160;
  const dotRadius = 12, colWidth = 90, rowHeight = 60;
  const [year, month] = monthLabel.split("-").map(Number); // expects "YYYY-MM"
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthLabel}-${String(day).padStart(2, "0")}`;
    const col = (day - 1) % 7;
    const row = Math.floor((day - 1) / 7);
    ctx.beginPath();
    ctx.arc(x + col * colWidth + 20, y + row * rowHeight, dotRadius, 0, 2 * Math.PI);
    ctx.fillStyle = presentDates.has(dateStr) ? "#22C55E" : "#334155";
    ctx.fill();
  }

  ctx.font = "28px sans-serif";
  ctx.fillStyle = "#F8FAFC";
  const summaryY = y + (Math.ceil(daysInMonth / 7) + 1) * rowHeight + 20;
  ctx.fillText(`Total Days: ${totalDays}`, 40, summaryY);
  ctx.fillText(`Rate: ₹${wageRate}/day`, 40, summaryY + 40);
  ctx.fillText(`Total: ₹${totalWages}`, 40, summaryY + 80);
  ctx.font = "18px sans-serif";
  ctx.fillText("✅ Verified via Haazri — GPS + Timestamp", 40, summaryY + 130);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
```

### 12.8 `src/utils/whatsappShare.js`
```javascript
import { getUploadUrl } from "../api/client";

export async function shareSummaryBlob(blob, shareText) {
  const { upload_url, s3_key } = await getUploadUrl({
    media_type: "selfie", // reuse the same signed-URL flow/limits path
    file_type: "image/png",
    file_size_bytes: blob.size,
  });
  await fetch(upload_url, { method: "PUT", body: blob, headers: { "Content-Type": "image/png" } });

  const file = new File([blob], "haazri-summary.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: shareText, title: "Haazri Monthly Summary" });
  } else {
    // Fallback: WhatsApp deep link with text only (image already uploaded, s3_key logged for reference)
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }
}
```

### 12.9 `src/auth/cognitoClient.js` — passwordless custom-auth flow
```javascript
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({ region: process.env.REACT_APP_AWS_REGION });
const ClientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;

export async function requestOtp(phoneE164) {
  try {
    const res = await client.send(
      new InitiateAuthCommand({ AuthFlow: "CUSTOM_AUTH", ClientId, AuthParameters: { USERNAME: phoneE164 } })
    );
    return res.Session; // pass this to verifyOtp
  } catch (e) {
    if (e.name === "UserNotFoundException") {
      await client.send(
        new SignUpCommand({
          ClientId,
          Username: phoneE164,
          Password: crypto.randomUUID() + "Aa1!", // never used again; custom auth bypasses passwords
          UserAttributes: [{ Name: "phone_number", Value: phoneE164 }],
        })
      );
      return requestOtp(phoneE164); // PreSignUp trigger auto-confirms, so this retry succeeds
    }
    throw e;
  }
}

export async function verifyOtp(phoneE164, otp, session) {
  const res = await client.send(
    new RespondToAuthChallengeCommand({
      ClientId,
      ChallengeName: "CUSTOM_CHALLENGE",
      Session: session,
      ChallengeResponses: { USERNAME: phoneE164, ANSWER: otp },
      ChallengeResponses: { USERNAME: phoneE164, ANSWER: otp },
    })
  );
  if (!res.AuthenticationResult) throw new Error("Incorrect OTP");
  return res.AuthenticationResult; // { IdToken, AccessToken, RefreshToken }
}
```
*(Note the duplicate `ChallengeResponses` key above is a copy-paste artifact to fix during implementation — keep only one.)*

Tokens are held in an `AuthContext` React state value (memory only, per the original security intent) and attached as `Authorization: Bearer <IdToken>` on every API call in `src/api/client.js`. Losing the session on a hard refresh is an acceptable trade-off for the hackathon; if time allows, the `RefreshToken` may additionally be kept in `sessionStorage` (cleared when the tab closes) to survive accidental reloads without weakening the "not in localStorage" guarantee.

---

## 13. Offline-First Sync Design (summary)

Already fully specified in code in Section 12.5. The contract in one sentence: **every tap succeeds locally and instantly; the network is a background concern the user never has to think about**, because (a) the UI is optimistic, (b) the queue lives in IndexedDB and survives refreshes, and (c) the backend upsert is idempotent so retries are always safe.

---

## 14. Auth Flow — Cognito Custom Phone-OTP

1. `Login.jsx`: user enters phone → `requestOtp()` (Section 12.9) → store returned `Session` in component state → show OTP input.
2. User enters 6-digit code → `verifyOtp(phone, otp, session)` → on success, tokens go to `AuthContext`; on failure, `DefineAuthChallenge` allows up to 3 attempts before failing the whole login (user must request a fresh OTP).
3. `phone_number` is the immutable Cognito username; there is no password the user ever sees or sets.

### 14.4 The SNS Sandbox Trap (read this before Day 4)
New AWS accounts default to the SNS **SMS sandbox**: messages only deliver to phone numbers you've explicitly verified in the SNS console, unless/until you request production access. **Do this on Day 1**: verify your own test number(s) under SNS → "Text messaging (SMS)" → "Sandbox destination phone numbers", and separately submit the production-access request in case it's needed for the live demo audience. If Day 4 arrives and a judge's or teammate's phone can't receive the OTP, that is an SNS sandbox issue, not a bug in the code above — verify the number, don't start debugging Lambda.

---

## 15. Tamper-Proofing & Authorization

### 15.1 Baseline (required, already satisfied by the API contract)
There is no `PATCH`/`DELETE` endpoint for attendance records, and the one `POST` upsert only ever fills fields that are still `null` for the immutable `(worker_id, record_date)` key (Section 9.4). A worker — or anyone with their token — cannot alter a past day's GPS/timestamp through this API. This alone satisfies "a worker cannot edit their own evidence" for the demo.

### 15.2 Row-level ownership (required)
Every handler in Section 9 derives `worker_id` from the verified Cognito JWT claims (`event.requestContext.authorizer.claims.sub`), never from client-supplied input, and only ever reads/writes items keyed by that `worker_id`. This is enforced structurally by every query/update in Section 9 — there is no code path where a caller can pass someone else's `worker_id`.

### 15.3 Amazon Verified Permissions / Cedar (optional — Phase 5 only)
If the core product (Phases 0–4) is fully working and demoable with time to spare, add a Cedar policy layer via Amazon Verified Permissions for "Built on AWS" scoring:
1. Create a Policy Store in Amazon Verified Permissions with a schema defining `User`, `AttendanceRecord`, and actions `ReadAttendance`/`WriteAttendance`.
2. Add this policy (matches the original concept's intent):
   ```cedar
   permit(
     principal,
     action in [Action::"ReadAttendance", Action::"WriteAttendance"],
     resource
   ) when { principal.sub == resource.worker_id };
   ```
3. In `record-attendance.js` and `get-attendance.js`, call `IsAuthorizedCommand` from `@aws-sdk/client-verifiedpermissions` before the DynamoDB call and return `403` on a `DENY` decision.
This is additive — if it's not finished, the app is already correctly authorized per 15.1/15.2 and nothing about the core flow depends on it.

---

## 16. Design System

- **Colors**: see Section 12.2 — no other colors in the UI besides these six plus white/black text as needed for contrast.
- **Typography**: system sans-serif stack, 18px minimum body, 24px minimum headings, bold weights for anything actionable.
- **Layout**: one thumb-reachable primary action per screen, centered near the bottom third of the viewport. Maximum two choices per screen. No dropdowns, no multi-step forms outside Login/Profile.
- **Iconography**: every icon carries a visible text label — no icon-only controls.
- **Voice feedback**: `speechSynthesis.speak()` confirms every successful attendance tap in Hindi ("हाज़िरी हो गई").
- **Color-coded status**: green = present/synced, amber = saved locally / pending sync, red = error state only (should be rare given the offline-first design).

---

## 17. Build & Test Commands

```bash
# Backend
cd backend
npm install
sam build
sam local start-api                                   # serves the API on localhost:3000, hits real AWS resources
sam local invoke BedrockStructureFunction \
  --event tests/events/bedrock-structure.json
curl -X POST http://localhost:3000/v1/voice/structure \
  -H "Content-Type: application/json" \
  -d '{"transcript":"Sharma ji ke site pe painting ka kaam"}'

# Frontend
cd frontend
npm install
npm start                                              # localhost:3000 dev server (use a different port than sam local, e.g. PORT=3001)
```

`backend/tests/events/bedrock-structure.json`:
```json
{ "body": "{\"transcript\": \"Sharma ji ke site pe Block C mein painting ka kaam kar raha hoon subah ki shift hai\"}" }
```

---

## 18. Deployment Steps

```bash
# Backend
cd backend
sam build
sam deploy --guided \
  --stack-name haazri \
  --region ap-south-1 \
  --capabilities CAPABILITY_IAM
# Copy the four Outputs (ApiUrl, UserPoolId, UserPoolClientId, BucketName) into frontend/.env

# Frontend — connect the frontend/ subfolder to AWS Amplify Hosting via the Amplify console,
# pointing it at this Git repo and branch. Use frontend/amplify.yml (below) so Amplify
# knows the app lives in a sub-folder, not the repo root.
```

`frontend/amplify.yml`:
```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm install
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: build
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```
Set the four `REACT_APP_*` environment variables in the Amplify console (Environment variables section) rather than committing `frontend/.env`.

---

## 19. Execution Plan — Ordered Build Phases With Verification Gates

**Phase 0 — Setup (Day 1 morning)**
Build: repo skeleton, `backend/template.yaml`, `npm install` in both folders, SNS sandbox number verified (Section 14.4).
Gate: `sam build` succeeds with no resources deployed yet.

**Phase 1 — Auth (Day 1)**
Build: Cognito resources + all 4 auth-trigger Lambdas + `cognitoClient.js` + `Login.jsx`.
Gate: a real phone number receives an SMS OTP and `verifyOtp` returns a valid `IdToken`. Do not proceed until this works — everything else is behind this gate.

**Phase 2 — Core attendance loop (Day 1)**
Build: `AttendanceTable`, `record-attendance.js`, `get-attendance.js`, `HaazriButton.jsx`, `useGeolocation.js`, `useOfflineQueue.js`, `Home.jsx` (GPS-only path, no voice/photo yet).
Gate: tap button while online → item appears in DynamoDB. Turn off WiFi, tap again → item appears in IndexedDB and syncs automatically once WiFi is back on, without duplicating the online record.

**Phase 3 — Voice intelligence (Day 2)**
Build: `bedrock-structure.js`, `useSpeechToText.js`, wire transcript → Bedrock → merge into pending record before sync.
Gate: speaking a Hindi sentence produces a correctly structured JSON object with `confidence > 0.7` for a clear sentence, and a graceful null-filled object for a garbled one (never a thrown error visible to the user).

**Phase 4 — Calendar, photo, summary, share (Day 3)**
Build: `presigned-url.js`, `imageCompression.js`, `CalendarGrid.jsx`, `Calendar.jsx`, `canvasSummary.js`, `whatsappShare.js`.
Gate: Calendar shows correct dots and totals for a month with mixed present/absent days; tapping "Share on WhatsApp" produces a real image with correct numbers, shareable via the native share sheet or the `wa.me` fallback.

**Phase 5 — Profile, deploy, polish (Day 3–4)**
Build: `get-profile.js`, `update-profile.js`, `Profile.jsx`; deploy backend via `sam deploy`; connect frontend to Amplify Hosting; run the full flow on the deployed URL on an actual low-end Android phone if one is available.
Gate: the live Amplify URL, opened fresh on a phone with no prior state, completes the full login → tap → calendar → share flow.

**Phase 6 — Optional stretch (only if all of the above is solid and time remains)**
Pick from: `monthly-summary.js` + EventBridge cron, Amazon Verified Permissions/Cedar (Section 15.3), profile-driven `default_wage_rate` auto-fill into new attendance records.

---

## 20. Edge Case Requirements (explicit, testable — implement, don't skip)

| Scenario | Required behavior |
|---|---|
| GPS permission denied | Attendance still records with `gps_lat/lng = null`; UI shows a manual "pick a recent worksite" fallback list of the last 5 distinct `worksite_name` values for this worker. |
| GPS accuracy > 500m | Record saves regardless; `gps_quality: "low"` stored (Section 9.4); UI shows a subtle amber note, never blocks the save. |
| Camera permission denied | Selfie step is skipped silently; nothing else in the flow is affected. |
| `webkitSpeechRecognition` unavailable (iOS Safari) | Show a manual text-note input behind an "Add a note" affordance; the record still saves via GPS alone. |
| Bedrock throws or returns unparseable JSON | `bedrock-structure.js` catches it and returns the null-filled `FALLBACK` object (Section 9.8) with HTTP 200 — the raw `voice_transcript` is still saved on the attendance record either way. |
| DynamoDB `UpdateCommand` throttled/fails | The client never learns about it directly — the record stays in the IndexedDB queue and `drainQueue()` retries it on the next 30-second tick or next `online` event. |
| Device clock is wrong | The client sends its own `timestamp`, but `record_date` on the server always ultimately reflects `toISTDateString`, and `created_at`/`updated_at` use **server** time (`nowIST()`), so all dispute-relevant "when was this saved" evidence is server-anchored even if the phone's clock is off. |
| Worker taps again after already recording today | Idempotent upsert (9.4) — no duplicate record, no error shown, any new optional fields merge in. |
| Retroactive entry (record_date ≠ date derived from timestamp) | Allowed up to the future-date check; flagged with `is_retroactive: true` for lower evidentiary weight if ever surfaced to a contractor view (out of scope for MVP display, but the field exists). |
| Large selfie on a slow connection | `imageCompression.js` resizes to ≤1024px width and re-encodes at quality 0.7 client-side before requesting the upload URL. |

---

## 21. Definition of Done — Final Checklist

- [ ] `sam local start-api` runs the full backend locally against real AWS resources (Build It overlap).
- [ ] `sam deploy` produces a working `ApiUrl`; Amplify Hosting produces a working public HTTPS URL (Ship It requirement).
- [ ] A fresh phone number can log in end-to-end via OTP with no manual console intervention beyond the SNS sandbox verification already done on Day 1.
- [ ] Tapping the button online creates a DynamoDB item within ~1 second; offline, it creates an IndexedDB item that syncs automatically without duplication once back online.
- [ ] A Hindi voice note produces a correctly structured Bedrock response in the demo, and a garbled one degrades gracefully instead of erroring.
- [ ] Calendar totals (`total_days`, `total_wages`) are arithmetically correct against the raw records for at least one manually-verified test month.
- [ ] The WhatsApp share button produces a real, correctly-labeled image and either opens the native share sheet or the `wa.me` fallback.
- [ ] No endpoint anywhere allows updating or deleting an existing attendance record's `timestamp`/`gps_*` fields once set.
- [ ] The whole flow has been exercised at least once on an actual low-end Android phone, not just desktop Chrome dev tools' device emulator.
- [ ] Demo video (3 min, recorded separately — not built by the agent) and AWS Builder Center blog post are the only two remaining non-code deliverables before submission.

---

## 22. Notes for the (Human-Produced) Demo Video & Blog Post

These are not code deliverables and are not built by the coding agent, but the agent's README should make the following facts easy to find and quote correctly, since they'll be repeated in both:

- **AWS services actually used** (only list what's truly wired up, don't inflate the count): Cognito, API Gateway, Lambda, DynamoDB, S3, Bedrock (Claude 3 Haiku), Amplify Hosting, SNS (via Cognito triggers), SAM CLI. EventBridge/Step Functions/Amazon Verified Permissions only if Phase 6 was actually completed — do not claim them otherwise.
- **The one sentence that should open the demo video**: a real anecdote about a wage dispute the team has personally witnessed, followed immediately by the national scale of the problem (~150 million daily wage workers, NSSO 76th Round).
- **The cost line worth quoting**: DynamoDB on-demand + Lambda + API Gateway + S3 + Bedrock Haiku, all free-tier-eligible at hackathon scale — genuinely $0 for the demo weekend, and low single-digit dollars per month at 10,000-worker scale. Recompute this from actual usage before quoting a number publicly; don't just copy a projection.
