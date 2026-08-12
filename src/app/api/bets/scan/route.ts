import { NextResponse } from 'next/server'
import {
  ALLOWED_BET_SCAN_MIME_TYPES,
  MAX_BET_SCAN_FILE_BYTES,
  scanBetSlipWithGemini,
} from '@/lib/bet-slip-scan'
import { createAuthedSupabase } from '@/lib/commissioner-auth'

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!accessToken) {
    return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 })
  }

  const supabase = createAuthedSupabase(accessToken)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Bet slip scanning is not configured. Add GEMINI_API_KEY to the server environment.' },
      { status: 503 }
    )
  }

  const formData = await request.formData()
  const image = formData.get('image')
  const modeValue = formData.get('mode')
  const mode = modeValue === 'futures' ? 'futures' : 'weekly'

  if (!(image instanceof File)) {
    return NextResponse.json({ error: 'Upload an image of your bet slip.' }, { status: 400 })
  }

  if (!ALLOWED_BET_SCAN_MIME_TYPES.has(image.type)) {
    return NextResponse.json(
      { error: 'Unsupported image type. Use JPEG, PNG, or WebP.' },
      { status: 400 }
    )
  }

  if (image.size > MAX_BET_SCAN_FILE_BYTES) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await image.arrayBuffer())
    const base64 = buffer.toString('base64')
    const scan = await scanBetSlipWithGemini(apiKey, base64, image.type, mode)

    return NextResponse.json({ scan })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan bet slip.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
