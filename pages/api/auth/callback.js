import { supabase } from '../../../lib/supabaseClient'
import cookie from 'cookie'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, error: authError } = req.query
  const cookies = cookie.parse(req.headers.cookie || '')
  const codeVerifier = cookies['pkce_code_verifier']

  // If Amazon redirected an error
  if (authError) {
    console.error('OAuth callback error:', authError)
    return res.redirect(`/?error=${encodeURIComponent(authError)}`)
  }

  if (!code) {
    return res.redirect('/')
  }

  try {
    let data, error

    if (codeVerifier) {
      // 1. Amazon PKCE flow: exchange code + verifier
      ;({ data, error } = await supabase.auth.exchangeCodeForSession({
        code,
        codeVerifier
      }))
      // Remove verifier cookie
      res.setHeader('Set-Cookie', cookie.serialize('pkce_code_verifier', '', {
        maxAge: 0,
        path: '/'
      }))
    } else {
      // 2. Non-PKCE flow (e.g., Google): standard code exchange
      ;({ data, error } = await supabase.auth.exchangeCodeForSession(code))
    }

    if (error) {
      console.error('OAuth callback error:', error)
      return res.redirect(`/?error=${encodeURIComponent(error.message)}`)
    }

    if (data.session) {
      // If Amazon flow, log the refresh token
      if (data.session.provider_refresh_token) {
        const amazonAdsRefreshToken = data.session.provider_refresh_token
        console.log('AMAZON_ADS_REFRESH_TOKEN:', amazonAdsRefreshToken)
        // (Optional) Persist to Vercel here...
      }

      // Set Supabase auth cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      }
      res.setHeader('Set-Cookie',
        cookie.serialize(
          'supabase-auth-token',
          data.session.access_token,
          cookieOptions
        )
      )

      return res.redirect('/dashboard')
    }
  } catch (err) {
    console.error('Unexpected callback error:', err)
    return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`)
  }

  return res.redirect('/')
}
