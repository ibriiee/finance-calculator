import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Free APIs: metals-api fallback to static if unavailable
// Gold/Silver: metals-api.com or openexchangerates.org
// FX: exchangerate.host (free, no key)

const CACHE_TTL_MINUTES = 60

// Sanity clamps — a hijacked/broken free API must never poison the DB. This app
// runs unattended for years, so a garbage read here can silently flip a Zakat
// verdict or wreck the dashboard cash model. Anything outside range is rejected
// (old cached value kept, rejection flagged in the response).
const CLAMPS: Record<string, [number, number]> = {
  pkr_to_aed: [0.001, 0.1],
  usd_to_aed: [3.5, 3.8], // AED is USD-pegged
  gold_aed_gram: [100, 2000],
  silver_aed_gram: [1, 50],
  gold_usd_oz: [800, 20000],
  silver_usd_oz: [5, 500],
}
function inRange(type: string, value: number) {
  const range = CLAMPS[type]
  return !range || (value >= range[0] && value <= range[1])
}

// Only ever used to seed a row that doesn't exist yet (fresh install) — never to
// overwrite real cached data. Roughly current as of 2026-07; update occasionally.
const FALLBACK_USD_TO_AED = 3.6725
const FALLBACK_PKR_TO_USD = 0.00358
const FALLBACK_GOLD_USD_OZ = 4000
const FALLBACK_SILVER_USD_OZ = 50
const FALLBACKS: Record<string, number> = {
  usd_to_aed: FALLBACK_USD_TO_AED,
  pkr_to_aed: FALLBACK_PKR_TO_USD * FALLBACK_USD_TO_AED,
  gold_usd_oz: FALLBACK_GOLD_USD_OZ,
  silver_usd_oz: FALLBACK_SILVER_USD_OZ,
  gold_aed_gram: (FALLBACK_GOLD_USD_OZ / 31.1035) * FALLBACK_USD_TO_AED,
  silver_aed_gram: (FALLBACK_SILVER_USD_OZ / 31.1035) * FALLBACK_USD_TO_AED,
}

async function fetchGoldSilverPrices(): Promise<{ goldUsd: number; silverUsd: number } | null> {
  try {
    // metals-api free tier
    const apiKey = process.env.METALS_API_KEY
    if (apiKey) {
      const res = await fetch(
        `https://metals-api.com/api/latest?access_key=${apiKey}&base=USD&symbols=XAU,XAG`,
        { next: { revalidate: 3600 } }
      )
      const data = await res.json()
      if (data.success) {
        return {
          goldUsd: 1 / data.rates.XAU,       // USD per troy oz
          silverUsd: 1 / data.rates.XAG,      // USD per troy oz
        }
      }
    }
    // goldapi.io — key is named GOLD_API_KEY in .env.local / Vercel
    const apiKey2 = process.env.GOLD_API_KEY ?? process.env.GOLDAPI_KEY
    if (apiKey2 && !apiKey2.startsWith('your-') && !apiKey2.startsWith('get-')) {
      const [goldRes, silverRes] = await Promise.all([
        fetch('https://www.goldapi.io/api/XAU/USD', { headers: { 'x-access-token': apiKey2 } }),
        fetch('https://www.goldapi.io/api/XAG/USD', { headers: { 'x-access-token': apiKey2 } }),
      ])
      const [goldData, silverData] = await Promise.all([goldRes.json(), silverRes.json()])
      if (goldData.price && silverData.price) {
        return { goldUsd: goldData.price, silverUsd: silverData.price }
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchFxRates(): Promise<{ pkrToUsd: number; usdToAed: number } | null> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { next: { revalidate: 3600 } })
    const data = await res.json()
    // Both keys must be real numbers from the API — substituting a hardcoded
    // fallback here would get written with source:'api' and a fresh
    // updated_at, the exact overwrite class FIX-01 step 4b bans (P2-19).
    if (typeof data?.rates?.PKR === 'number' && data.rates.PKR > 0
      && typeof data?.rates?.AED === 'number' && data.rates.AED > 0) {
      return { pkrToUsd: 1 / data.rates.PKR, usdToAed: data.rates.AED }
    }
    return null
  } catch {
    return null
  }
}

export async function GET() {
  const supabase = await createClient()

  // Require a logged-in session — this endpoint hits paid-tier external APIs
  // (metals-api/goldapi) on cache miss, so it can't be left open to the public internet.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { data: allRates } = await supabase.from('rates_cache').select('rate_type,rate_value,updated_at,source')
  const cacheMap = new Map((allRates ?? []).map(r => [r.rate_type, r]))
  const newestMs = (allRates ?? []).reduce((max, r) => Math.max(max, new Date(r.updated_at).getTime()), 0)
  const newestIso = newestMs ? new Date(newestMs).toISOString() : null

  const currentRateMap = () => {
    const m: Record<string, number> = {}
    cacheMap.forEach((r, k) => { m[k] = Number(r.rate_value) })
    return m
  }

  if (newestMs && (Date.now() - newestMs) / 60000 < CACHE_TTL_MINUTES) {
    return NextResponse.json({ success: true, cached: true, rates: currentRateMap() })
  }

  const admin = createAdminClient()
  if (!admin) {
    // Degrade visibly, not silently: the writer is unconfigured (missing env var).
    // Serve whatever is cached (however stale) rather than crash the app.
    return NextResponse.json({
      success: false, error: 'rates writer not configured', cached: true, stale: true,
      rates: currentRateMap(), updatedAt: newestIso,
    }, { status: 500 })
  }

  const [metalPrices, fxRates] = await Promise.all([fetchGoldSilverPrices(), fetchFxRates()])

  // Both dead → write nothing. Never let a fallback overwrite real data or bump
  // updated_at (that would reset the staleness clock while numbers are years old).
  if (!metalPrices && !fxRates) {
    return NextResponse.json({
      success: true, cached: true, stale: true, rates: currentRateMap(), updatedAt: newestIso,
    })
  }

  const usdToAed = fxRates?.usdToAed ?? null
  const pkrToUsd = fxRates?.pkrToUsd ?? null
  const pkrToAed = (usdToAed != null && pkrToUsd != null) ? pkrToUsd * usdToAed : null
  const goldUsdOz = metalPrices?.goldUsd ?? null
  const silverUsdOz = metalPrices?.silverUsd ?? null
  const goldAedGram = (goldUsdOz != null && usdToAed != null) ? (goldUsdOz / 31.1035) * usdToAed : null
  const silverAedGram = (silverUsdOz != null && usdToAed != null) ? (silverUsdOz / 31.1035) * usdToAed : null

  const candidates: { rate_type: string; value: number | null }[] = [
    { rate_type: 'usd_to_aed', value: usdToAed },
    { rate_type: 'pkr_to_aed', value: pkrToAed },
    { rate_type: 'gold_usd_oz', value: goldUsdOz },
    { rate_type: 'silver_usd_oz', value: silverUsdOz },
    { rate_type: 'gold_aed_gram', value: goldAedGram },
    { rate_type: 'silver_aed_gram', value: silverAedGram },
  ]

  const writeErrors: string[] = []
  const rateMap: Record<string, number> = {}

  for (const c of candidates) {
    const existing = cacheMap.get(c.rate_type)

    if (c.value === null) {
      // This value's fetcher failed. Seed a fallback ONLY when the row doesn't
      // exist at all (fresh install) — never overwrite real cached data with a
      // hardcoded constant.
      if (!existing) {
        const fallback = FALLBACKS[c.rate_type]
        const { error } = await admin.from('rates_cache').upsert(
          { rate_type: c.rate_type, rate_value: fallback, source: 'fallback', updated_at: new Date().toISOString() },
          { onConflict: 'rate_type' }
        )
        if (error) writeErrors.push(`${c.rate_type}: ${error.message}`)
        rateMap[c.rate_type] = fallback
      } else {
        rateMap[c.rate_type] = Number(existing.rate_value)
      }
      continue
    }

    if (!inRange(c.rate_type, c.value)) {
      writeErrors.push(`${c.rate_type}: rejected out-of-range value ${c.value}`)
      rateMap[c.rate_type] = existing ? Number(existing.rate_value) : FALLBACKS[c.rate_type]
      continue
    }

    const { error } = await admin.from('rates_cache').upsert(
      { rate_type: c.rate_type, rate_value: c.value, source: 'api', updated_at: new Date().toISOString() },
      { onConflict: 'rate_type' }
    )
    if (error) writeErrors.push(`${c.rate_type}: ${error.message}`)
    rateMap[c.rate_type] = c.value
  }

  if (writeErrors.length) console.error('rates_cache write errors:', writeErrors)

  return NextResponse.json({
    success: true, cached: false, rates: rateMap,
    ...(writeErrors.length ? { writeErrors } : {}),
  })
}
