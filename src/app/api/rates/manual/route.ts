import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Owner's no-API escape hatch: manually set PKR→AED when the free FX APIs die
// or change shape. Auth-gated, clamped the same as the automatic pipeline.
const PKR_TO_AED_RANGE: [number, number] = [0.001, 0.1]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const value = Number(body?.pkr_to_aed)
  if (!Number.isFinite(value) || value < PKR_TO_AED_RANGE[0] || value > PKR_TO_AED_RANGE[1]) {
    return NextResponse.json({ success: false, error: `pkr_to_aed must be between ${PKR_TO_AED_RANGE[0]} and ${PKR_TO_AED_RANGE[1]}` }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ success: false, error: 'rates writer not configured' }, { status: 500 })

  const { error } = await admin.from('rates_cache').upsert(
    { rate_type: 'pkr_to_aed', rate_value: value, source: 'manual', updated_at: new Date().toISOString() },
    { onConflict: 'rate_type' }
  )
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
