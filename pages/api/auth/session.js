import { supabaseService } from '../../../lib/supabaseService'
import cookie from 'cookie'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    let token = null

    // Check Authorization header first
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }

    // Check for session cookie if no Bearer token
    if (!token && req.headers.cookie) {
      const cookies = cookie.parse(req.headers.cookie)
      token = cookies['supabase-auth-token']
    }

    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' })
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseService.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Return user information
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      },
      authenticated: true
    })

  } catch (error) {
    console.error('Session verification error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}