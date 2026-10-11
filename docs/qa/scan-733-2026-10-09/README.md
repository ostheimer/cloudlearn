# Mobile scan acceptance — #733

Initial native acceptance source (2026-10-09): `c410730`, integrating main `4d6711d` and copy PR #760.
All four requested changes are implemented in the mobile scan flow:

- Camera/gallery/PDF refresh `/usage` and confirm the returned LP price and balance before sending. Cancellation, unavailable costs and insufficient fresh balance prevent the request. The separate per-send Gemini consent remains required. A ref locks repeated callbacks through both dialogs and the request.
- The preview deck title is editable, survives draft/tab restoration and is trimmed when creating a new deck. Empty titles retain the existing date fallback. Once a deck has been created, including a partial save, its title field locks. Selecting an existing deck never renames it.
- Deleting an ordinary card leaves the other cards intact. Deleting the last card offers **keep** or explicit **discard entire preview**, including a notice that spent LP are not refunded. Repeated taps cannot bypass this guard.
- PDFs above 3,000,000 metadata bytes are rejected before reading/uploading. The 4,000,000-character base64 guard also covers missing or incorrect picker size metadata. Exact boundaries are allowed. These limits mirror the web gateway preflight.

## Red → green

The new mounted-screen regression tests were written before the fix. Replacing only `scan.tsx` with current main `4d6711d` and running the ten core #733 cases still produces **10 failures, 18 skipped**. Restoring the fixed file produces:

```text
pnpm --filter @clearn/mobile exec vitest run \
  src/features/capture/scanScreenLifecycle.test.tsx \
  src/lib/scanAiConsent.test.ts src/lib/scanPreviewSaveOnce.test.ts
Test Files 3 passed (3)
Tests      61 passed (61)
```

The mounted-screen file has 28 passing cases: existing lifecycle cases, actual DE/EN resource checks from #760, the new core regressions, boundary/rapid-tap cases and both languages' new dialogs/title field. Camera, gallery and PDF use deliberately different live prices (17/29 LP) from the initial 10 LP render default. The no-response-usage fallback deducts the just-approved live price.

`pnpm run ci` passed on the restored, clean implementation: ESLint, every workspace typecheck and **2,359 tests passed; 49 API database-dependent tests skipped**. Mobile: **931 passed**. The existing react-test-renderer deprecation warning remains. Complete logs are retained locally in `/Users/andreas/.codex/evidence/cloudlearn/issue-733/` as `cloudlearn-733-red-integrated-baseline.log`, `cloudlearn-733-green-reviewed.log` and `cloudlearn-733-ci-reviewed.log`.

## Native iOS acceptance

An isolated iPhone 15 simulator, iOS 26.5, ran the real React Native screen through a compatible Expo 54 native shell with freshly exported DE and EN Hermes bundles. It used only a synthetic local user, generated local PDF fixtures and the app icon as the picked photo. API/auth were redirected to `127.0.0.1:3733`, and a temporary QA fetch guard rejected every other destination. These QA overrides/bootstrap are absent from the committed app. No EAS build or Gemini request was made.

Setup correction: an earlier bundle did not inline the intended local auth environment and a synthetic sign-in received a 400 from the public auth endpoint. No scan or production data write occurred. The native acceptance below was rerun after explicit local API/auth injection and the external-fetch guard, then rerun after integrating #760.

DE bundle SHA-256: `104f456fb9a7893d650677def5d060c5ee67d2a658ece448b492b6a9ef89910c`.
EN bundle SHA-256: `a9d7500e597d1599adcbaf33460442c7aa37c3bc5ddb74d5d45221a014a4af85`.

| Native case | Observed result | Screenshot |
| --- | --- | --- |
| DE gallery cost/cancel | Fresh 17 LP / 383 LP; cancel preserves backend state | [DE cost](../../screens/screenshots/scan-733/de-cost-photo.png) |
| DE separate consent | Gemini dialog follows cost approval; request terminates at local mock | [DE consent](../../screens/screenshots/scan-733/de-consent.png) |
| DE title/card edit + last-card keep | One remaining edited card and title preserved | [DE preview](../../screens/screenshots/scan-733/de-edited-preview.png), [DE last card](../../screens/screenshots/scan-733/de-last-card.png) |
| Native restart/draft recovery | Integrated #760 bundle restored earlier edited title/question without a new import | [DE resumed draft](../../screens/screenshots/scan-733/de-resumed-edits.png) |
| DE PDF oversized/small | 3,000,001-byte PDF rejected with unchanged state; 595-byte PDF confirms 29 LP / 366 LP | [DE rejection](../../screens/screenshots/scan-733/de-pdf-too-large.png), [DE PDF cost](../../screens/screenshots/scan-733/de-cost-pdf.png) |
| EN gallery cost/cancel | Fresh 17 LP / 337 LP; cancel preserves backend state | [EN cost](../../screens/screenshots/scan-733/en-cost-photo.png) |
| EN title/card edit + last-card keep | English field/dialog; edits persist across Home → Scan | [EN preview](../../screens/screenshots/scan-733/en-edited-preview.png), [EN last card](../../screens/screenshots/scan-733/en-last-card.png) |
| EN PDF oversized/small | Same preflight and English warning; small PDF confirms 29 LP / 320 LP | [EN rejection](../../screens/screenshots/scan-733/en-pdf-too-large.png), [EN PDF cost](../../screens/screenshots/scan-733/en-cost-pdf.png) |

Both languages completed gallery → edit title/question → delete ordinary card → keep last card → save new deck, followed by PDF → save to existing deck. Saving and revisiting Scan offered fresh source choices. [Synthetic backend readbacks](native-readbacks.json) confirm the two edited titles/questions, exactly one saved card per new deck and four PDF cards in the existing deck, with its original title unchanged. Final balance: 291 LP; three decks, six cards. The initial 383 LP starting balance includes one earlier 17 LP synthetic scan used for draft recovery.

The screenshots are native 1179×2556 captures. New #733 controls and central #760 import wording were checked with actual DE/EN resources; older German preview/save copy outside this issue remains visible in English mode. Mock scan content intentionally remains German. Native keep/cancel paths passed; explicit final discard, affordability failure, unavailable `/usage`, encoding boundaries and stale repeated callbacks are proven by mounted tests.

## Remaining device gate

Physical iPhone acceptance requires one future bundled iOS build: real camera permission/shutter, photo-library providers, PDF Files/iCloud providers and background/foreground draft recovery, then the same cost → consent → edit → save/new-or-existing sequence in DE/EN. The simulator cannot prove physical camera capture. Real Gemini extraction quality and production LP ledger behavior were not exercised. Mobile has no OTA; merging this PR alone will not change installed phones. Batch these changes into the next user-requested build after the running-build/quota check.

This evidence supports review of the PR. The issue remains open and no merge, deployment or paid build is part of this handoff.

## Current-main refresh — 2026-10-11

PR #766 now includes main `dcd9adef171a67b2efb4ec54a60afac704ced14d`, including #744 and the official ECR Public Postgres mirror from #764. Integration was conflict-free in a new isolated worktree using the existing PR branch. The scan runtime, LP/PDF helpers and localized resources are byte-for-byte unchanged from the original PR head `abaa369`; the source edits in this refresh only strengthen the mounted test harness and acceptance cases.

The real `TargetDeckPickerModal` now renders in the Scan tests instead of being replaced by `null`. The new DE/EN acceptance cases also run the actual `createAiImportConsentGate`, with native primitives, API calls and storage substituted by local mocks. In each language they prove:

- Camera, gallery and PDF show fresh 17/29 LP confirmation before either consent or API call; cost cancel and actual consent cancel send nothing, while both approvals send exactly once and deduct the approved cost.
- Title/question edits survive focus changes; keeping the last card preserves them; a new deck receives the trimmed title and edited card. The title locks after save and the completed result resets on tab return.
- An oversized PDF sends nothing; exactly 3,000,000 bytes / 4,000,000 base64 characters reaches both dialogs and saves through the real existing-deck picker, using its original title and ID without creating a deck.
- A stored partial-save draft resumes without importing again, keeps its title locked and inserts only the remaining card into the remembered deck.

Current results: **40 mounted tests**, **91 targeted tests across five files**, and complete `pnpm run ci` passed: **2,371 tests, including 943 mobile**, with **56 API database-dependent tests skipped locally** because `DATABASE_URL` is unset. The ten core regression tests still fail against unmodified current-main `scan.tsx` (10 failed / 30 skipped), then pass with the PR implementation. Full refresh logs are retained under `/Users/andreas/.codex/evidence/cloudlearn/issue-733/2026-10-11/`.

The screenshots/readbacks above retain their 2026-10-09 provenance; no new native simulator or physical-device run is claimed for this refresh. The scan runtime was compared to that tested source and is unchanged. Physical camera, real providers, background recovery and production AI/LP behavior remain the separate device gates described above. No paid build, real AI request, production mutation, merge or issue closure was performed.
