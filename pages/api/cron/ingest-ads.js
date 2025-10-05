/**
 * Amazon Ads Data Ingestion Cron Endpoint
 * Fetches advertising campaign data from Amazon Ads API and stores in Supabase
 * 
 * Endpoint: POST /api/cron/ingest-ads
 * Auth: x-cron-secret header
 * Payload: { startDate?, endDate?, campaignType? }
 */

import { AmazonAdsClient, RateLimiter } from '../../lib/spApiClient.js';
import SupabaseService from '../../lib/supabaseService.js';

// Rate limiter for Ads API (more generous than SP-API)
const rateLimiter = new RateLimiter(2, 10);

export default async function handler(req, res) {
  const startTime = Date.now();
  let logId = null;

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
    const supabaseService = new SupabaseService();
    const adsClient = new AmazonAdsClient();

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

    // 6. Fetch campaigns data from Ads API (or mock data)
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

    // 8. Store campaigns data in Supabase
    const adsUpsertResult = await supabaseService.upsertAdsData(
      filteredCampaigns, 
      'ads-api-cron'
    );

    // 9. Fetch additional metrics if we have real API access
    let additionalMetrics = [];
    if (adsClient.config.clientId && filteredCampaigns.length > 0) {
      try {
        await rateLimiter.waitForToken();
        
        // Example: Fetch keyword-level data for campaigns
        // const keywordData = await adsClient.getKeywordMetrics(
        //   filteredCampaigns.map(c => c.campaign_id),
        //   startDate,
        //   endDate
        // );
        // additionalMetrics = keywordData;
      } catch (error) {
        console.warn('Failed to fetch additional metrics:', error.message);
      }
    }

    // 10. Log successful completion
    const duration = Date.now() - startTime;
    await supabaseService.logIngestion('ads', 'completed', {
      recordsProcessed: adsUpsertResult.count,
      campaignsProcessed: adsUpsertResult.count,
      additionalMetrics: additionalMetrics.length,
      campaignTypeFilter: campaignType,
      duration,
      profileId: adsClient.config.profileId
    });

    // 11. Calculate summary statistics
    const totalImpressions = filteredCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = filteredCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalCost = filteredCampaigns.reduce((sum, c) => sum + (c.cost || 0), 0);
    const totalSales = filteredCampaigns.reduce((sum, c) => sum + (c.sales_7d || 0), 0);

    // 12. Return success response
    res.status(200).json({
      success: true,
      message: 'Ads data ingestion completed successfully',
      recordsProcessed: {
        campaigns: adsUpsertResult.count,
        additionalMetrics: additionalMetrics.length,
        total: adsUpsertResult.count + additionalMetrics.length
      },
      summary: {
        totalImpressions,
        totalClicks,
        totalCost: parseFloat(totalCost.toFixed(2)),
        totalSales: parseFloat(totalSales.toFixed(2)),
        averageCTR: totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(3) + '%' : '0%',
        averageROAS: totalCost > 0 ? (totalSales / totalCost).toFixed(2) : '0'
      },
      dateRange: { startDate, endDate, campaignType },
      profileId: adsClient.config.profileId,
      duration: `${duration}ms`,
      logId: logId?.id
    });

  } catch (error) {
    console.error('Ads ingestion failed:', error);
    
    // Log the failure
    const supabaseService = new SupabaseService();
    await supabaseService.logIngestion('ads', 'failed', {
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
      profileId: adsClient?.config?.profileId
    });

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