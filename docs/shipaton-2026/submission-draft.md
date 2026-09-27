# Shipaton 2026 — Devpost submission draft

Status: preparation only; not submitted or published. Prepared 2026-09-05.

**Verification gate:** Every product, functionality, monetization, and availability claim below is a draft based on the repository README, not evidence from a device test. Verify each claim on the exact submission build before submitting; remove or revise anything that cannot be demonstrated. Bracketed fields require factual completion. Do not present README targets as measured results.

## Submission facts

- Product name: **clearn.ai** (README product name; CloudLearn is the repository/project context).
- Entrant: **Andreas Ostheimer**, sole developer, as confirmed by Andreas.
- Previous public store release: **none**, as confirmed by Andreas.
- Intended category: **RevenueCat Peace Prize**, subject to regular-category eligibility and a qualifying public store release.
- First public store release: **[date, time, timezone, store, listing URL]**.
- US availability and installation: **[verified date, build/version, evidence]**.
- RevenueCat purchase integration: **[verified product, purchase type, device/build, result]**.
- Judge access: **[free trial or promo-code instructions; required test-account instructions]**.
- Public demo: **[YouTube or Vimeo URL]**.
- No users, revenue, learning outcomes, accessibility compliance, or measured time savings are claimed in this draft.

## Pitch

Turn a photo of your study material into editable flashcards, then build a study routine with spaced repetition.

## Description

### Inspiration

Preparing useful study materials can take time before learning even begins. clearn.ai is designed to shorten that preparation step: start with material you already have, turn it into questions, and return to those questions in manageable review sessions.

### What it does

Learners can capture a photo, choose an image, or enter text to generate structured flashcards. They can inspect and edit the cards, organize them into decks, and practice with a spaced-repetition review flow. A dashboard brings together due cards and study progress.

The initial audience is German-speaking students and other learners. The app aims to make it easier to begin a study session and maintain a regular practice habit. AI-generated material can contain mistakes; reviewing and correcting cards is part of the intended workflow.

### How it is built

clearn.ai uses React Native and Expo for its mobile interface, an API for AI processing and account services, and Supabase for authentication and persistent data. Its review flow uses FSRS scheduling. RevenueCat connects the app's purchase experience with paid access and learning-point purchases.

**Release-specific monetization:** [Describe only the products actually configured, publicly available, and verified in the submitted build. Include how RevenueCat handles the purchase and what the user receives.]

### RevenueCat Peace Prize: intended benefit

The intended social benefit is practical support for people who want to study independently using their own materials. Converting a page into editable questions can reduce the manual preparation required to start practicing. Scheduled reviews are intended to help learners return to material over time.

The planned free entry path lets people try the core learning experience, while optional paid features help support the service. [Confirm the exact free experience and limitations in the release build before retaining this sentence.]

These are product intentions, not measured learning outcomes. [Add consented user feedback or an accurately described usability test only if collected and documented.] We have not yet established that the app improves grades or long-term retention, and we do not claim those outcomes.

### What I learned

[Andreas: add one concrete development lesson and an example of how it changed the app. Do not invent a personal story or imply development started during Shipaton.]

### What's next

[Add the next specific improvement after device validation and launch. Keep unfinished capabilities separate from the submitted app's current features.]

## Demo storyboard — target 1:50

Record the actual submitted app on its target device. Use original study material and a demo account without personal information. English narration or subtitles must explain the visible flow. If the UI is German, translate the relevant actions in the subtitles. Cuts are allowed, but do not imply a measured processing speed by hiding a wait.

| Time | Screen/action | Suggested narration |
| --- | --- | --- |
| 0:00–0:10 | App name; open a prepared sample page | “clearn.ai turns your study material into editable flashcards and a repeatable study routine.” |
| 0:10–0:30 | Capture or import the sample; generate cards | “Start with a photo or text. The app turns the material into questions you can review.” |
| 0:30–0:45 | Inspect a card, correct wording, save a deck | “AI output needs checking. I can edit a question or answer before I start studying.” |
| 0:45–1:05 | Answer a card, reveal the answer, rate recall | “The review flow uses spaced repetition to schedule future practice.” |
| 1:05–1:15 | Show due cards/dashboard | “The dashboard gives me a clear place to continue.” |
| 1:15–1:40 | Show a configured RevenueCat offering, verified sandbox purchase and resulting entitlement or point balance | “[Name the verified purchase.] RevenueCat handles the purchase flow, and the app applies the result.” Label sandbox/test footage explicitly; never imply real revenue. |
| 1:40–1:50 | End card with public store listing | “My goal is to make the first step into independent study easier. Try clearn.ai: [store URL].” |

If any segment fails on the submission build, fix and verify it or revise the demo and description together. Do not substitute mock success screens for a functioning purchase or learning flow.

## Asset and evidence checklist

- [ ] Final product name, developer identity and store metadata agree.
- [ ] Public listing on a supported store, first released within the qualifying window; release date recorded.
- [ ] App downloadable and usable from the United States.
- [ ] Device walkthrough verifies every retained feature claim in the description.
- [ ] RevenueCat SDK purchase flow works; product, entitlement/LP outcome, version and verification evidence recorded.
- [ ] Premium features accessible to judges through a free trial or promo code, with any necessary instructions.
- [ ] Demo shorter than two minutes, publicly visible on YouTube or Vimeo, with English narration/subtitles.
- [ ] App icon: 1024 × 1024 pixels.
- [ ] At least one screenshot: 1179 × 2556 pixels, without a device frame.
- [ ] Demonstration content, images, music and other included materials are owned or licensed for this use.
- [ ] English text, video translations and testing instructions complete.
- [ ] All placeholders resolved; no unsupported impact, usage, revenue, competitor or speed claims remain.
- [ ] Judge access maintained through the judging period.
- [ ] Devpost submission finalized before **2026-10-01 08:45 Europe/Vienna** (2026-09-30 23:45 PDT).

The regular Peace Prize route does not require publishing source code. This draft does not propose changing the repository's proprietary license.

## Source and scope notes

Product copy is based on `README.md`, especially “Produktfokus & MVP-Abgrenzung,” “Monetarisierung,” and “Implementierungsstatus.” The README mixes targets, implementation statements, and unresolved work; this draft deliberately makes no claim about PDF parsing, complete offline sync, competitor superiority, processing under 30 seconds, or proven learning gains.

Submission requirements: [Official Shipaton rules](https://revenuecat-shipaton-2026.devpost.com/rules) and [official submission guide](https://www.revenuecat.com/blog/engineering/how-to-submit-your-app-for-shipaton). Recheck requirements before final submission.
