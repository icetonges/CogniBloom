import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 0

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
      },
    },
    { status: 200 }
  )
}
