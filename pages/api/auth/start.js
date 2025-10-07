import { randomBytes, createHash } from 'crypto'
import cookie from 'cookie'

export default async function handler(req, res) {
  // 1. Generate a PKCE code_verifier
  const codeVerifier = randomBytes(64).toString('hex')

  // 2. Create the code_challenge (SHA256 + base64url)
  const hash = createHash('sha256').update(codeVerifier).digest()
  const codeChallenge = hash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // 3. Store the verifier in a secure cookie
  res.setHeader('Set-Cookie', cookie.serialize('pkce_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // valid for 5 minutes
    path: '/'
  }))

  // 4. Redirect user to Amazon's OAuth with code_challenge
  const params = new URLSearchParams({
    client_id: process.env.SUPABASE_OAUTH_AMAZON_CLIENT_ID,
    scope: 'advertising::campaign_management',
    response_type: 'code',
    redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })

  res.redirect(`https://www.amazon.com/ap/oa?${params.toString()}`)
}
