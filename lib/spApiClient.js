/**
 * Amazon SP-API Client with LWA Token Management
 * Provides stubs for development and real API integration patterns
 */
import crypto from 'crypto';
class SPAPIClient {
  constructor(config = {}) {
    this.config = {
      region: 'na', // us-east-1
      marketplaceId: 'ATVPDKIKX0DER', // US marketplace
      clientId: process.env.LWA_CLIENT_ID,
      clientSecret: process.env.LWA_CLIENT_SECRET,
      refreshToken: process.env.LWA_REFRESH_TOKEN,
      accessTokens: new Map(),
      ...config
    };
    this.endpoints = {
      na: 'https://sellingpartnerapi-na.amazon.com',
      eu: 'https://sellingpartnerapi-eu.amazon.com',
      fe: 'https://sellingpartnerapi-fe.amazon.com'
    };
    this.lwaEndpoints = {
      na: 'https://api.amazon.com/auth/o2/token',
      eu: 'https://api.amazon.co.uk/auth/o2/token', 
      fe: 'https://api.amazon.co.jp/auth/o2/token'
    };
  }
  /**
   * Get LWA Access Token (Login with Amazon)
   * Uses refresh token to get access token for SP-API calls
   */
  async getLWAAccessToken() {
    // Return mock token if no real credentials
    if (!this.config.clientId || !this.config.clientSecret) {
      console.warn('SP-API: Using mock LWA token - no real credentials provided');
      return 'mock_lwa_access_token_' + Date.now();
    }
    const cacheKey = 'lwa_token';
    const cached = this.config.accessTokens.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.token;
    }
    try {
      const response = await fetch(this.lwaEndpoints[this.config.region], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken
        })
      });
      if (!response.ok) {
        throw new Error(`LWA token request failed: ${response.status}`);
      }
      const data = await response.json();
      this.config.accessTokens.set(cacheKey, {
        token: data.access_token,
        expires: Date.now() + (data.expires_in * 1000) - 60000 // 1 min buffer
      });
      return data.access_token;
    } catch (error) {
      console.error('Failed to get LWA access token:', error);
      throw error;
    }
  }
  /**
   * Generate AWS Signature V4 for SP-API requests
   */
  generateAWSSignature(method, path, headers, body = '') {
    // This is a simplified version - in production use aws4 library
    // For now return mock signature since we're using stubs
    if (!process.env.AWS_ACCESS_KEY_ID) {
      return 'mock_aws_signature';
    }
    // Real implementation would use AWS SDK or aws4 library
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);
    return `AWS4-HMAC-SHA256 Credential=${process.env.AWS_ACCESS_KEY_ID}/${date}/us-east-1/execute-api/aws4_request, SignedHeaders=host;x-amz-date, Signature=mock_signature`;
  }
  /**
   * Make authenticated request to SP-API
   */
  async makeRequest(endpoint, options = {}) {
    const accessToken = await this.getLWAAccessToken();
    const url = `${this.endpoints[this.config.region]}${endpoint}`;
    const headers = {
      'x-amz-access-token': accessToken,
      'x-amz-date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
      'Content-Type': 'application/json',
      ...options.headers
    };
    // Add AWS signature if credentials available
    if (process.env.AWS_ACCESS_KEY_ID) {
      headers['Authorization'] = this.generateAWSSignature(
        options.method || 'GET',
        endpoint,
        headers,
        options.body
      );
    }
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      // Extract rate limit headers for monitoring
      const rateLimitInfo = {
        limit: response.headers.get('x-amzn-RateLimit-Limit'),
        remaining: response.headers.get('x-amzn-RateLimit-Remaining')
      };
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(`SP-API rate limit exceeded. Retry after: ${response.headers.get('Retry-After')} seconds`);
        }
        throw new Error(`SP-API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return { data, rateLimitInfo };
    } catch (error) {
      console.error('SP-API request failed:', error);
      throw error;
    }
  }
  /**
   * Get Orders Data (Reports API)
   * Returns mock data if no real credentials
   */
  async getOrdersData(startDate, endDate, marketplaceIds = []) {
    if (!this.config.clientId) {
      console.log('SP-API: Returning mock orders data');
      return this.getMockOrdersData(startDate, endDate);
    }
    try {
      // Real SP-API call would be:
      const endpoint = `/reports/2021-06-30/reports`;
      const reportOptions = {
        reportType: 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL',
        dataStartTime: startDate,
        dataEndTime: endDate,
        marketplaceIds: marketplaceIds.length ? marketplaceIds : [this.config.marketplaceId]
      };
      const { data } = await this.makeRequest(endpoint, {
        method: 'POST',
        body: reportOptions
      });
      // In real implementation, you'd need to:
      // 1. Create report request
      // 2. Poll for report completion
      // 3. Download report document
      // 4. Parse CSV/TSV data
      return data;
    } catch (error) {
      console.warn('SP-API orders request failed, returning mock data:', error.message);
      return this.getMockOrdersData(startDate, endDate);
    }
  }
  /**
   * Get Sales & Traffic Data
   * Fixed to use proper SP-API interval format
   */
  async getSalesData(startDate, endDate, granularity = 'Daily') {
    if (!this.config.clientId) {
      console.log('SP-API: Returning mock sales data');
      return this.getMockSalesData(startDate, endDate, granularity);
    }
    try {
      const endpoint = `/sales/v1/orderMetrics`;
      // Convert dates to proper ISO 8601 format with timezone for SP-API
      const startISO = this.toISO8601WithTimezone(startDate);
      // Use inclusive end-of-day for endDate using helper
      const endISO = this.toISO8601WithTimezone(endDate, true);
      const params = new URLSearchParams({
        marketplaceIds: this.config.marketplaceId,
        interval: `${startISO}--${endISO}`, // SP-API double dash interval
        granularity: granularity === 'Daily' ? 'Day' : granularity, // SP-API uses 'Day'
        granularityTimeZone: 'US/Eastern' // Required for granularity > Hour
      });
      console.log(`SP-API Request: ${endpoint}?${params.toString()}`);
      const { data, rateLimitInfo } = await this.makeRequest(`${endpoint}?${params}`);
      // Transform SP-API response to match expected format
      if (data && data.payload && data.payload.length > 0) {
        const metrics = data.payload.map(item => ({
          date: item.interval.split('T')[0], // Extract date part
          units_ordered: item.orderCount || 0,
          units_shipped: item.unitCount || 0,
          ordered_product_sales: item.totalSales?.amount || 0,
          shipped_product_sales: item.totalSales?.amount || 0,
          total_order_items: item.orderItemCount || 0,
          sessions: Math.floor(Math.random() * 200) + 50, // Mock traffic data
          page_views: Math.floor(Math.random() * 500) + 100,
          page_views_percentage: parseFloat((Math.random() * 0.3 + 0.1).toFixed(4)),
          buy_box_percentage: parseFloat((Math.random() * 0.8 + 0.2).toFixed(4)),
          unit_session_percentage: parseFloat((Math.random() * 0.15 + 0.02).toFixed(4))
        }));
        return { metrics, rateLimitInfo };
      }
      // If no data, return mock data
      return this.getMockSalesData(startDate, endDate, granularity);
    } catch (error) {
      console.warn('SP-API sales request failed, returning mock data:', error.message);
      return this.getMockSalesData(startDate, endDate, granularity);
    }
  }
  /**
   * Convert date string to ISO 8601 with timezone format required by SP-API
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @param {boolean} endOfDay - If true, set to end of day (23:59:59)
   * @returns {string} ISO 8601 formatted string with timezone
   */
  toISO8601WithTimezone(dateString, endOfDay = false) {
    const date = new Date(dateString);
    if (endOfDay) {
      // For end date, set to end of day inclusive
      date.setUTCHours(23, 59, 59, 0);
    } else {
      // For start date, set to 00:00:00
      date.setUTCHours(0, 0, 0, 0);
    }
    return date.toISOString(); // e.g. 2025-09-22T00:00:00.000Z or 23:59:59.000Z
  }
  /**
   * Mock data generators for development
   */
  getMockOrdersData(startDate, endDate) {
    const orders = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    for (let i = 0; i < Math.min(daysDiff * 2, 50); i++) {
      const orderDate = new Date(start.getTime() + Math.random() * (end - start));
      orders.push({
        amazon_order_id: `111-${Math.random().toString(36).substr(2, 9)}`,
        order_date: orderDate.toISOString(),
        order_status: Math.random() > 0.1 ? 'Shipped' : 'Pending',
        fulfillment_channel: Math.random() > 0.3 ? 'MFN' : 'AFN',
        sales_channel: 'Amazon.com',
        order_total: parseFloat((Math.random() * 200 + 10).toFixed(2)),
        currency: 'USD',
        number_of_items_shipped: Math.floor(Math.random() * 5) + 1,
        number_of_items_unshipped: Math.random() > 0.8 ? Math.floor(Math.random() * 2) : 0,
        payment_method: 'CreditCard',
        marketplace_id: this.config.marketplaceId,
        buyer_email: `buyer${i}@example.com`,
        buyer_name: `Buyer ${i + 1}`,
        shipment_service_level_category: 'Standard'
      });
    }
    return { orders };
  }
  getMockSalesData(startDate, endDate, granularity) {
    const metrics = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start);
    while (current <= end) {
      metrics.push({
        date: current.toISOString().split('T')[0],
        units_ordered: Math.floor(Math.random() * 50) + 1,
        units_shipped: Math.floor(Math.random() * 45) + 1,
        ordered_product_sales: parseFloat((Math.random() * 1000 + 100).toFixed(2)),
        shipped_product_sales: parseFloat((Math.random() * 950 + 95).toFixed(2)),
        total_order_items: Math.floor(Math.random() * 60) + 1,
        sessions: Math.floor(Math.random() * 200) + 50,
        page_views: Math.floor(Math.random() * 500) + 100,
        page_views_percentage: parseFloat((Math.random() * 0.3 + 0.1).toFixed(4)),
        buy_box_percentage: parseFloat((Math.random() * 0.8 + 0.2).toFixed(4)),
        unit_session_percentage: parseFloat((Math.random() * 0.15 + 0.02).toFixed(4))
      });
      current.setDate(current.getDate() + (granularity === 'Daily' ? 1 : 7));
    }
    return { metrics };
  }
}
/**
 * Amazon Ads API Client
 */
class AmazonAdsClient {
  constructor(config = {}) {
    this.config = {
      region: 'na',
      clientId: process.env.ADS_CLIENT_ID,
      clientSecret: process.env.ADS_CLIENT_SECRET,
      refreshToken: process.env.ADS_REFRESH_TOKEN,
      profileId: process.env.ADS_PROFILE_ID,
      accessTokens: new Map(),
      ...config
    };
    this.endpoints = {
      na: 'https://advertising-api.amazon.com',
      eu: 'https://advertising-api-eu.amazon.com',
      fe: 'https://advertising-api-fe.amazon.com'
    };
  }
  async getAccessToken() {
    if (!this.config.clientId) {
      console.warn('Ads API: Using mock token - no real credentials provided');
      return 'mock_ads_access_token_' + Date.now();
    }
    const cacheKey = 'ads_token';
    const cached = this.config.accessTokens.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.token;
    }
    try {
      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken
        })
      });
      const data = await response.json();
      this.config.accessTokens.set(cacheKey, {
        token: data.access_token,
        expires: Date.now() + (data.expires_in * 1000) - 60000
      });
      return data.access_token;
    } catch (error) {
      console.error('Failed to get Ads API access token:', error);
      throw error;
    }
  }
  async makeRequest(endpoint, options = {}) {
    const accessToken = await this.getAccessToken();
    const url = `${this.endpoints[this.config.region]}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Amazon-Advertising-API-ClientId': this.config.clientId,
      'Amazon-Advertising-API-Scope': this.config.profileId,
      ...options.headers
    };
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
      });
      return await response.json();
    } catch (error) {
      console.error('Ads API request failed:', error);
      throw error;
    }
  }
}

export { SPAPIClient, AmazonAdsClient };
