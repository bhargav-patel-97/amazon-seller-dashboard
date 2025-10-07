/**
 * Amazon Ads Data Ingestion Cron Endpoint
 * Fetches advertising campaign data from Amazon Ads API and stores in Supabase
 * 
 * Endpoint: POST /api/cron/ingest-ads
 * Auth: x-cron-secret header
 * Payload: { startDate?, endDate?, campaignType? }
 */

import SupabaseService from '../../../lib/supabaseService.js';

// Rate limiter implementation for Ads API
class RateLimiter {
  constructor(requestsPerSecond = 2, maxBurstSize = 10) {
    this.requestsPerSecond = requestsPerSecond;
    this.maxBurstSize = maxBurstSize;
    this.tokens = maxBurstSize;
    this.lastRefill = Date.now();
  }

  async waitForToken() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxBurstSize, this.tokens + elapsed * this.requestsPerSecond);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitTime = ((1 - this.tokens) / this.requestsPerSecond) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.tokens = 0;
  }
}

// Amazon Ads API Client implementation
class AmazonAdsClient {
  constructor() {
    this.config = {
      profileId: process.env.AMAZON_ADS_PROFILE_ID,
      clientId: process.env.AMAZON_ADS_CLIENT_ID,
      clientSecret: process.env.AMAZON_ADS_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_ADS_REFRESH_TOKEN,
      accessToken: null,
      tokenExpiry: null,
      baseUrl: 'https://advertising-api.amazon.com'
    };
  }

  async getAccessToken() {
    if (this.config.accessToken && this.config.tokenExpiry && Date.now() < this.config.tokenExpiry) {
      return this.config.accessToken;
    }

    // Validate required credentials
    if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
      throw new Error('Missing required Amazon Ads API credentials. Please configure AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET, and AMAZON_ADS_REFRESH_TOKEN environment variables.');
    }

    try {
      const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token refresh failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      this.config.accessToken = tokenData.access_token;
      this.config.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 min buffer

      return this.config.accessToken;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  async makeApiCall(endpoint, options = {}) {
    const accessToken = await this.getAccessToken();
    
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Amazon-Advertising-API-ClientId': this.config.clientId,
      'Amazon-Advertising-API-Scope': this.config.profileId,
      ...options.headers
    };

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async getCampaignsData(startDate, endDate) {
    try {
      console.log(`Fetching campaigns data from Amazon Ads API for ${startDate} to ${endDate}`);
      
      // Step 1: Get all campaigns
      const campaigns = await this.makeApiCall('/v2/campaigns', {
        method: 'GET'
      });

      if (!campaigns || campaigns.length === 0) {
        console.log('No campaigns found');
        return { campaigns: [] };
      }

      console.log(`Found ${campaigns.length} campaigns`);

      // Step 2: Create report for campaign metrics
      const reportRequest = {
        reportDate: startDate,
        metrics: ['campaignId', 'impressions', 'clicks', 'cost', 'sales'],
        segment: 'query'
      };

      const reportResponse = await this.makeApiCall('/v2/campaigns/report', {
        method: 'POST',
        body: reportRequest
      });

      console.log('Report request submitted:', reportResponse.reportId);

      // Step 3: Poll for report completion (simplified - in production you might want async processing)
      let reportData = {};
      try {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for report
        const report = await this.makeApiCall(`/v2/reports/${reportResponse.reportId}`);
        reportData = report || {};
      } catch (error) {
        console.warn('Could not fetch report data, using campaign data only:', error.message);
      }

      // Step 4: Combine campaign data with metrics
      const campaignsWithMetrics = campaigns.map(campaign => ({
        campaign_id: campaign.campaignId,
        campaign_name: campaign.name,
        campaign_type: campaign.campaignType,
        status: campaign.state,
        daily_budget: parseFloat(campaign.dailyBudget || 0),
        target_acos: campaign.targetingType === 'auto' ? null : parseFloat(campaign.bid || 0),
        impressions: reportData[campaign.campaignId]?.impressions || 0,
        clicks: reportData[campaign.campaignId]?.clicks || 0,
        spend: parseFloat(reportData[campaign.campaignId]?.cost || 0),
        sales: parseFloat(reportData[campaign.campaignId]?.sales || 0),
        orders: reportData[campaign.campaignId]?.orders || 0,
        start_date: campaign.startDate,
        end_date: campaign.endDate,
        sku: campaign.portfolioId || null,
        user_id: process.env.DEFAULT_USER_ID || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      return { campaigns: campaignsWithMetrics };
    } catch (error) {
      console.error('Failed to fetch campaigns data from Amazon Ads API:', error);
      throw error;
    }
  }
}

// Rate limiter for Ads API (more generous than SP-API)
const rateLimiter = new RateLimiter(2, 10);

export default async function handler(req, res) {
  const startTime = Date.now();
  let logId = null;
  let supabaseService;
  let adsClient;

  try {
    // 1. Authenticate the cron request
    const cronSecret = req.headers['x-cron-secret'];
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      console.warn('Unauthorized ads cron request from:', req.headers['x-forwarded-for'] || req.connection.remoteAddress);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid or missing x-cron-secret header' 
      });
    }

    // Support both POST (FastCron) and GET (testing)
    if (!['POST', 'GET'].includes(req.method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Initialize services
    supabaseService = new SupabaseService();
    adsClient = new AmazonAdsClient();

    // 3. Parse request parameters
    const { 
      startDate = getYesterdayISO(), 
      endDate = getTodayISO(),
      campaignType = 'all',
      profileId
    } = req.method === 'POST' ? req.body : req.query;

    // Override profile ID if provided
    if (profileId) {
      adsClient.config.profileId = profileId;
    }

    console.log(`Starting ads ingestion for ${startDate} to ${endDate}, campaign type: ${campaignType}`);

    // 4. Log ingestion start
    logId = await supabaseService.logIngestion('ads', 'started', {
      startDate,
      endDate,
      campaignType,
      profileId: adsClient.config.profileId,
      source: 'cron',
      userAgent: req.headers['user-agent']
    });

    // 5. Apply rate limiting before API calls
    await rateLimiter.waitForToken();

    // 6. Fetch campaigns data from Ads API
    const campaignsResult = await adsClient.getCampaignsData(startDate, endDate);
    
    if (!campaignsResult.campaigns || campaignsResult.campaigns.length === 0) {
      await supabaseService.logIngestion('ads', 'completed', {
        recordsProcessed: 0,
        message: 'No campaigns data available for date range',
        duration: Date.now() - startTime
      });

      return res.status(200).json({
        success: true,
        message: 'No ads data available for the specified date range',
        recordsProcessed: 0,
        dateRange: { startDate, endDate },
        profileId: adsClient.config.profileId
      });
    }

    // 7. Filter campaigns by type if specified
    let filteredCampaigns = campaignsResult.campaigns;
    if (campaignType !== 'all') {
      filteredCampaigns = campaignsResult.campaigns.filter(
        campaign => campaign.campaign_type === campaignType
      );
    }

    console.log(`Processing ${filteredCampaigns.length} campaigns`);

    // 8. Store campaigns data in Supabase
    const adsUpsertResult = await supabaseService.upsertAdsData(
      filteredCampaigns, 
      'ads-api-cron'
    );

    // 9. Log successful completion
    const duration = Date.now() - startTime;
    await supabaseService.logIngestion('ads', 'completed', {
      recordsProcessed: adsUpsertResult.count,
      campaignsProcessed: adsUpsertResult.count,
      campaignTypeFilter: campaignType,
      duration,
      profileId: adsClient.config.profileId
    });

    // 10. Calculate summary statistics
    const totalImpressions = filteredCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = filteredCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalSpend = filteredCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalSales = filteredCampaigns.reduce((sum, c) => sum + (c.sales || 0), 0);

    // 11. Return success response
    res.status(200).json({
      success: true,
      message: 'Ads data ingestion completed successfully',
      recordsProcessed: {
        campaigns: adsUpsertResult.count,
        total: adsUpsertResult.count
      },
      summary: {
        totalImpressions,
        totalClicks,
        totalSpend: parseFloat(totalSpend.toFixed(2)),
        totalSales: parseFloat(totalSales.toFixed(2)),
        averageCTR: totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(3) + '%' : '0%',
        averageROAS: totalSpend > 0 ? (totalSales / totalSpend).toFixed(2) : '0'
      },
      dateRange: { startDate, endDate, campaignType },
      profileId: adsClient.config.profileId,
      duration: `${duration}ms`,
      logId: logId?.id
    });

  } catch (error) {
    console.error('Ads ingestion failed:', error);
    
    // Log the failure
    try {
      if (!supabaseService) {
        supabaseService = new SupabaseService();
      }
      await supabaseService.logIngestion('ads', 'failed', {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
        profileId: adsClient?.config?.profileId
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // Handle specific error types
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Amazon Ads API rate limit hit, please retry later',
        retryAfter: 60
      });
    }

    if (error.message.includes('401') || error.message.includes('403')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid or expired Ads API credentials',
        profileId: adsClient?.config?.profileId
      });
    }

    if (error.message.includes('Missing required Amazon Ads API credentials')) {
      return res.status(500).json({
        success: false,
        error: 'Configuration error',
        message: 'Amazon Ads API credentials not configured',
        requiredEnvVars: ['AMAZON_ADS_CLIENT_ID', 'AMAZON_ADS_CLIENT_SECRET', 'AMAZON_ADS_REFRESH_TOKEN', 'AMAZON_ADS_PROFILE_ID']
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      logId: logId?.id,
      duration: `${Date.now() - startTime}ms`
    });
  }
}

/**
 * Helper functions
 */
function getYesterdayISO() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

// For local testing
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};