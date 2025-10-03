import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard({ session }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [apiTestResult, setApiTestResult] = useState(null)
  const [protectedTestResult, setProtectedTestResult] = useState(null)

  useEffect(() => {
    if (!session) {
      router.push('/')
      return
    }

    // Load user profile
    loadProfile()
  }, [session, router])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setUserProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

 const testSessionAPI = async () => {
  // 1) Always call getSession() right before the API call—
  //    this ensures you get the current, unexpired token.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    setApiTestResult('❌ No session found')
    return
  }

  // 2) Send that access_token in the Authorization header:
  const response = await fetch('/api/auth/session', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  const payload = await response.json()
  if (response.ok) {
    setApiTestResult(`✅ Session API Success: ${payload.user.email}`)
  } else {
    setApiTestResult(`❌ Session API Error: ${payload.error}`)
  }
}

const testProtectedAPI = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    setProtectedTestResult('❌ No session found')
    return
  }

  const response = await fetch('/api/protected/check', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  const payload = await response.json()
  if (response.ok) {
    setProtectedTestResult(`✅ Protected API Success: ${payload.message}`)
  } else {
    setProtectedTestResult(`❌ Protected API Error: ${payload.error}`)
  }
}
  // Fetch seller data using authenticated API call
  const fetchSellerData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      // Example: Call your API routes with Bearer token
      const [salesResponse, inventoryResponse] = await Promise.all([
        fetch('/api/seller/sales', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch('/api/seller/inventory', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ])

      // Handle responses...
      console.log('API calls made with Bearer tokens')
    } catch (error) {
      console.error('Error fetching seller data:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Amazon Seller Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {session?.user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* API Testing Section */}
          <div className="mb-8 bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">API Testing (Bearer Token)</h3>
            <div className="space-y-4">
              <div>
                <button
                  onClick={testSessionAPI}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium mr-4"
                >
                  Test Session API
                </button>
                {apiTestResult && (
                  <div className="mt-2 text-sm">
                    {apiTestResult}
                  </div>
                )}
              </div>
              <div>
                <button
                  onClick={testProtectedAPI}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium mr-4"
                >
                  Test Protected API
                </button>
                {protectedTestResult && (
                  <div className="mt-2 text-sm">
                    {protectedTestResult}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to your dashboard!
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Sales
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          $12,345
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Active Campaigns
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          8
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Product Reviews
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          4.7★ (234)
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Inventory Items
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          156
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}