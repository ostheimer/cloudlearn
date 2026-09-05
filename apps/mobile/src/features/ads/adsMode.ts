// Real rewarded ads (Google-served + AdMob Server-Side Verification) are not live
// yet: they need the AdMob console SSV callback URL and the production ad unit IDs
// configured (#149). Until then ad actions are hidden and the hook stays inert:
// no mock playback, ad request, consent prompt, or LP grant.
//
// Flip to true ONLY once SSV is configured end-to-end (AdMob console callback URL +
// the grant_ad_ssv_lp migration applied + the setServerSideVerificationOptions
// wiring verified with a test ad).
// Typed as boolean (not the literal `false`) so flipping it later needs no other
// edits and TypeScript doesn't treat the gated real-ad path as unreachable.
export const REAL_ADS_ENABLED: boolean = false;
