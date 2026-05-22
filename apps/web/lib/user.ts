// Single-user app — all data belongs to Daniel
export const DANIEL_USER_ID = 'daniel'

export const APP_USER = {
  id: DANIEL_USER_ID,
  name: 'Daniel',
  email: process.env['DANIEL_EMAIL'] ?? '',
}

export const PARENT_EMAILS = [
  process.env['PARENT1_EMAIL'] ?? '',
  process.env['PARENT2_EMAIL'] ?? '',
].filter(Boolean)

export const ALL_SUMMARY_RECIPIENTS = [
  APP_USER.email,
  ...PARENT_EMAILS,
].filter(Boolean)
