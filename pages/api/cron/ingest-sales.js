/**
 * Sales Data Ingestion Cron Endpoint
 * Fetches sales and traffic data from Amazon SP-API and stores in Supabase
 * 
 * Endpoint: POST /api/cron/ingest-sales
 * Auth: x-cron-secret header
 * Payload: { startDate?, endDate?, granularity? }
 */

import { SPAPIClient, RateLimiter } from '../../../lib/spApiClient.js';
import SupabaseService from '../../../lib/supabaseService.js';

// Rate limiter for SP-API compliance (1 req/sec for sales data)
const rateLimiter = new RateLimiter(1, 5);

export default async function handler(req, res) {
  const startTime = Date.now();
  let logId = null;
  
  try {
    // 1. Authenticate the cron request
    const cronSecret = req.headers['x-cron-secret'];
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      console.warn('Unauthorized cron request from:', req.headers['x-forwarded-for'] || req.connection.remoteAddress);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid or missing x-cron-secret header' 
      });
    }

    // Only allow POST for FastCron compatibility, but also support GET for testing
    if (!['POST', 'GET'].includes(req.method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Initialize services
    const supabaseService = new SupabaseService();
    const spApiClient = new SPAPIClient();

    // 3. Parse request parameters
    const { 
      startDate = getYesterdayISO(), 
      endDate = getYesterdayISO(),
      granularity = 'Daily'
    } = req.method === 'POST' ? req.body : req.query;

    console.log(`Starting sales ingestion for ${startDate} to ${endDate}`);

    // 4. Log ingestion start
    logId = await supabaseService.logIngestion('sales', 'started', {
      startDate,
      endDate,
      granularity,
      source: 'cron',
      userAgent: req.headers['user-agent']
    });

    // 5. Apply rate limiting before API calls
    await rateLimiter.waitForToken();

    // 6. Fetch sales data from SP-API (or mock data)
    const salesResult = await spApiClient.getSalesData(startDate, endDate, granularity);
    
    if (!salesResult.metrics || salesResult.metrics.length === 0) {
      await supabaseService.logIngestion('sales', 'completed', {
        recordsProcessed: 0,
        message: 'No data available for date range',
        duration: Date.now() - startTime
      });

      return res.status(200).json({
        success: true,
        message: 'No sales data available for the specified date range',
        recordsProcessed: 0,
        dateRange: { startDate, endDate }
      });
    }

    // 7. Also fetch orders data if available
    let ordersResult = null;
    try {
      await rateLimiter.waitForToken();
      ordersResult = await spApiClient.getOrdersData(startDate, endDate);
    } catch (error) {
      console.warn('Failed to fetch orders data:', error.message);
      // Continue with sales data only
    }

    // 8. Store data in Supabase
    const salesUpsertResult = await supabaseService.upsertSalesData(
      salesResult.metrics, 
      'sp-api-cron'
    );

    let ordersUpsertResult = { count: 0 };
    if (ordersResult && ordersResult.orders) {
      try {
        ordersUpsertResult = await supabaseService.upsertOrdersData(
          ordersResult.orders,
          'sp-api-cron'
        );
      } catch (error) {
        console.error('Failed to upsert orders:', error.message);
      }
    }

    // 9. Log successful completion
    const duration = Date.now() - startTime;
    await supabaseService.logIngestion('sales', 'completed', {
      recordsProcessed: salesUpsertResult.count + ordersUpsertResult.count,
      salesRecords: salesUpsertResult.count,
      orderRecords: ordersUpsertResult.count,
      duration,
      rateLimitInfo: salesResult.rateLimitInfo
    });

    // 10. Return success response
    res.status(200).json({
      success: true,
      message: 'Sales data ingestion completed successfully',
      recordsProcessed: {
        sales: salesUpsertResult.count,
        orders: ordersUpsertResult.count,
        total: salesUpsertResult.count + ordersUpsertResult.count
      },
      dateRange: { startDate, endDate, granularity },
      duration: `${duration}ms`,
      logId: logId?.id,
      rateLimitInfo: salesResult.rateLimitInfo
    });

  } catch (error) {
    console.error('Sales ingestion failed:', error);
    
    // Log the failure
    const supabaseService = new SupabaseService();
    await supabaseService.logIngestion('sales', 'failed', {
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });

    // Handle specific error types
    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Amazon API rate limit hit, please retry later',
        retryAfter: 60
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
 * Helper function to get yesterday's date in ISO format
 */
function getYesterdayISO() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Helper function to validate date format
 */
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateString.match(regex)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// For local testing
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};