import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    tier: 'free',
    limits: {
      requests_per_minute: 30,
      tokens_per_minute: 14400,
      tokens_per_day: 100000,
      requests_per_day: 14400,
    },
    throttle_config: {
      min_delay_ms: 2500,
      effective_rpm: 24,
      backoff_strategy: 'key rotation → 60s wait if all exhausted',
      max_retries: 4,
    },
  })
}
