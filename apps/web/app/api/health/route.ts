import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/lib/types'

export const revalidate = 0

export async function GET() {
  try {
    const uptime = process.uptime()
    const timestamp = new Date().toISOString()

    const response: ApiResponse<{
      status: string
      uptime: number
      timestamp: string
      version: string
    }> = {
      success: true,
      data: {
        status: 'healthy',
        uptime,
        timestamp,
        version: '0.1.0',
      },
      meta: {
        timestamp,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
      },
      { status: 500 }
    )
  }
}
