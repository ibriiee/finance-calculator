import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Free APIs: metals-api fallback to static if unavailable
// Gold/Silver: metals-api.com or openexchangerates.org
// FX: exchangerate.host (free, no key)

const CACHE_TTL_MINUTES = 60

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
    if (data.rates) {
      return {
        pkrToUsd: data.rates.PKR ? 1 / data.rates.PKR : 0.00358,
        usdToAed: data.rates.AED ?? 3.6725,
      }
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

  // Check cache freshness
  const { data: cache } = await supabase
    .from('rates_cache')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (cache && cache.length > 0) {
    const updatedAt = new Date(cache[0].updated_at)
    const ageMinutes = (Date.now() - updatedAt.getTime()) / 60000
    if (ageMinutes < CACHE_TTL_MINUTES) {
      const rateMap: Record<string, number> = {}
      // Build map from all rows
      const { data: allRates } = await supabase.from('rates_cache').select('rate_type,rate_value')
      allRates?.forEach(r => { rateMap[r.rate_type] = r.rate_value })
      return NextResponse.json({ success: true, cached: true, rates: rateMap })
    }
  }

  // Fetch fresh
  const [metalPrices, fxRates] = await Promise.all([fetchGoldSilverPrices(), fetchFxRates()])

  const usdToAed = fxRates?.usdToAed ?? 3.6725
  const pkrToUsd = fxRates?.pkrToUsd ?? 0.00358
  const pkrToAed = pkrToUsd * usdToAed

  // Gold: troy oz → gram = oz / 31.1035
  // Fallbacks are only used when no API key is configured — keep them roughly current
  const goldUsdOz = metalPrices?.goldUsd ?? 4000
  const silverUsdOz = metalPrices?.silverUsd ?? 50
  const goldAedGram = (goldUsdOz / 31.1035) * usdToAed
  const silverAedGram = (silverUsdOz / 31.1035) * usdToAed

  const rates = [
    { rate_type: 'gold_aed_gram', rate_value: goldAedGram },
    { rate_type: 'silver_aed_gram', rate_value: silverAedGram },
    { rate_type: 'pkr_to_aed', rate_value: pkrToAed },
    { rate_type: 'usd_to_aed', rate_value: usdToAed },
    { rate_type: 'gold_usd_oz', rate_value: goldUsdOz },
    { rate_type: 'silver_usd_oz', rate_value: silverUsdOz },
  ]

  // Upsert all rates
  for (const rate of rates) {
    await supabase.from('rates_cache').upsert(
      { ...rate, source: metalPrices ? 'api' : 'fallback', updated_at: new Date().toISOString() },
      { onConflict: 'rate_type' }
    )
  }

  const rateMap: Record<string, number> = {}
  rates.forEach(r => { rateMap[r.rate_type] = r.rate_value })

  return NextResponse.json({ success: true, cached: false, rates: rateMap })
}
