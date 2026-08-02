// Single-user app — all data belongs to Daniel
export const DANIEL_USER_ID = 'daniel'

export const APP_USER = {
  id: DANIEL_USER_ID,
  name: 'Daniel',
  email: process.env['DANIEL_EMAIL'] ?? '',
}

// Household sign-in addresses that should all resolve to the single shared
// `DANIEL_USER_ID` account rather than getting their own empty account —
// both the parent and Daniel need to see the same notes/planner/etc. See the
// `signIn`/`jwt` callbacks in auth.ts for where this is enforced, and the
// signup route for why credentials sign-up rejects these addresses instead
// of trying to replicate the same linking (no ownership proof over a typed
// email, unlike a completed Google OAuth flow).
export const SHARED_ACCOUNT_EMAILS = [
  'icetonges@gmail.com',
  'daniel.d.shang@gmail.com',
]

export const PARENT_EMAILS = [
  process.env['PARENT1_EMAIL'] ?? '',
  process.env['PARENT2_EMAIL'] ?? '',
].filter(Boolean)

export const ALL_SUMMARY_RECIPIENTS = [
  APP_USER.email,
  ...PARENT_EMAILS,
].filter(Boolean)
