import { supabase } from '../../../lib/supabaseClient'
import cookie from 'cookie'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code } = req.query
  const cookies = cookie.parse(req.headers.cookie || '')
  const codeVerifier = cookies['pkce_code_verifier']

  if (!codeVerifier) {
    console.error('Missing PKCE code_verifier')
    return res.redirect(`/?error=${encodeURIComponent('Missing code_verifier')}`)
  }

  if (code) {
    try {
      // Exchange code + verifier for session
      const { data, error } = await supabase.auth.exchangeCodeForSession({
        code,
        codeVerifier
      })

      if (error) {
        console.error('OAuth callback error:', error)
        return res.redirect(`/?error=${encodeURIComponent(error.message)}`)
      }

      if (data.session) {
        // 1. Clear PKCE cookie
        res.setHeader('Set-Cookie', cookie.serialize('pkce_code_verifier', '', {
          maxAge: 0,
          path: '/'
        }))

        // 2. Log (and optionally persist) Amazon Ads refresh token
        const amazonAdsRefreshToken = data.session.provider_refresh_token
        console.log('AMAZON_ADS_REFRESH_TOKEN:', amazonAdsRefreshToken)

        /*
        // OPTIONAL: Persist to Vercel env
        await fetch(`https://api.vercel.com/v8/projects/${process.env.VERCEL_PROJECT_ID}/env`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            key: 'ADS_REFRESH_TOKEN',
            value: amazonAdsRefreshToken,
            target: ['production']
          })
        })
        */

        // 3. Set Supabase auth cookie
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        }
        res.setHeader('Set-Cookie',
          cookie.serialize(
            'supabase-auth-token',
            data.session.access_token,
            cookieOptions
          )
        )

        // 4. Redirect into your app
        return res.redirect('/dashboard')
      }
    } catch (err) {
      console.error('Unexpected callback error:', err)
      return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`)
    }
  }

  return res.redirect('/')
}
