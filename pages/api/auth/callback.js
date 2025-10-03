import { supabase } from '../../../lib/supabaseClient'
import cookie from 'cookie'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code } = req.query

  if (code) {
    try {
      // Exchange code for session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('OAuth callback error:', error)
        return res.redirect(`/?error=${encodeURIComponent(error.message)}`)
      }

      if (data.session) {
        // Set secure HTTP-only cookie
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        }

        res.setHeader('Set-Cookie', cookie.serialize(
          'supabase-auth-token', 
          data.session.access_token, 
          cookieOptions
        ))

        // Redirect to dashboard
        return res.redirect('/dashboard')
      }
    } catch (error) {
      console.error('Unexpected callback error:', error)
      return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`)
    }
  }

  res.redirect('/')
}