import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function Home({ session }) {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  const handleGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`
        }
      })
      
      if (error) {
        console.error('Login error:', error.message)
        alert('Login failed: ' + error.message)
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      alert('An unexpected error occurred')
    }
  }

  const handleAmazonAdsLogin = () => {
    // Redirect to our PKCE start endpoint
    window.location.href = '/api/auth/start'
  }

  if (session) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#374151'
        }}>
          Redirecting to dashboard...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '48px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#111827',
          marginBottom: '8px'
        }}>
          Amazon Seller Dashboard
        </h1>
        
        <p style={{
          color: '#6b7280',
          marginBottom: '32px'
        }}>
          Monitor your seller performance and analytics
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            style={{
              width: '100%',
              padding: '12px 24px',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Amazon Ads Login Button */}
          <button
            onClick={handleAmazonAdsLogin}
            style={{
              width: '100%',
              padding: '12px 24px',
              backgroundColor: '#ff9900',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 8.04 3.157 12.657 3.157 2.646 0 5.098-.299 7.357-.896 2.259-.598 4.326-1.494 6.199-2.688.374-.24.748-.072.748.295v.896c0 .224-.124.374-.372.523-1.494.896-3.135 1.494-4.924 1.793s-3.613.449-5.474.449c-2.182 0-4.326-.224-6.432-.673-2.107-.449-4.064-1.122-5.87-2.018-.36-.179-.538-.434-.538-.748v-.896c0-.095.024-.168.072-.224l.225-.048zm21.469-4.825c-.597-.896-3.91-.449-5.398-.225-.187.03-.225-.15-.047-.27 2.646-1.868 6.972-1.345 7.479-.673.508.672-.134 5.398-2.84 7.645-.15.12-.299.06-.225-.12.27-.672.896-2.182.567-2.84-.329-.658-.566-1.517-.566-1.517zm-3.463-10.126c-1.793-1.868-4.651-2.107-7.645-1.345-1.868.523-3.91 1.72-5.623 3.538-.374.374-.673.075-.225-.374 1.868-1.793 4.102-3.09 6.508-3.613 2.407-.523 5.025-.374 7.057.896.374.225.225.524-.072.898z"/>
            </svg>
            Connect Amazon Ads
          </button>
        </div>

        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#f3f4f6',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <strong>Note:</strong> Use "Connect Amazon Ads" to authorize Amazon Advertising API access and retrieve your refresh token.
        </div>
      </div>
    </div>
  )
}
