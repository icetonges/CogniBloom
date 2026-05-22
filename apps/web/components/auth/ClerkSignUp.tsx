'use client'

import { SignUp } from '@clerk/nextjs'
import { useTheme } from 'next-themes'

const darkVars = {
  colorBackground: '#111827',
  colorText: '#e2e8f4',
  colorTextSecondary: '#8294b4',
  colorInputBackground: '#1a2438',
  colorInputText: '#e2e8f4',
  colorPrimary: '#5090f8',
  colorDanger: '#e05555',
  borderRadius: '0.5rem',
}

const lightVars = {
  colorBackground: '#ffffff',
  colorText: '#1a2035',
  colorTextSecondary: '#5a6580',
  colorInputBackground: '#f5f7fa',
  colorInputText: '#1a2035',
  colorPrimary: '#2563eb',
  colorDanger: '#dc2626',
  borderRadius: '0.5rem',
}

export function ClerkSignUp() {
  const { resolvedTheme } = useTheme()
  return <SignUp appearance={{ variables: resolvedTheme === 'light' ? lightVars : darkVars }} />
}
