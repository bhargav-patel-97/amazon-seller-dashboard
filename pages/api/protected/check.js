import { supabaseService } from '../../../lib/supabaseService'
import cookie from 'cookie'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    let token = null

    // Check Authorization header
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }

    // Check for session cookie
    if (!token && req.headers.cookie) {
      const cookies = cookie.parse(req.headers.cookie)
      token = cookies['supabase-auth-token']
    }

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No valid session found'
      })
    }

    // Verify token server-side using service role client
    const { data: { user }, error } = await supabaseService.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Invalid session',
        message: 'Token verification failed'
      })
    }

    // Example: Fetch user's seller data using service role privileges
    const { data: sellerData, error: sellerError } = await supabaseService
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (sellerError && sellerError.code !== 'PGRST116') {
      console.error('Database error:', sellerError)
      return res.status(500).json({ error: 'Database error' })
    }

    // Return protected data
    res.status(200).json({
      message: 'Access granted to protected resource',
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      sellerData: sellerData || null,
      serverTime: new Date().toISOString()
    })

  } catch (error) {
    console.error('Protected route error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Server encountered an unexpected error'
    })
  }
}