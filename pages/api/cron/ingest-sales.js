/**
 * Sales Data Ingestion Cron Endpoint - Production Version
 * Only processes real SP-API data, no mock data generation
 */
import { SPAPIClient, RateLimiter } from '../../../lib/spApiClient.js';
import SupabaseService from '../../../lib/supabaseService.js';

// Rate limiter for SP-API compliance
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

    // 3. Parse request parameters and process template variables
    let { 
      startDate = getYesterdayISO(), 
      endDate = getYesterdayISO(),
      granularity = 'Daily'
    } = req.method === 'POST' ? req.body : req.query;

    // Process template variables
    startDate = processTemplateVariable(startDate);
    endDate = processTemplateVariable(endDate);

    // Validate processed dates
    if (!isValidDate(startDate)) {
      startDate = getYesterdayISO();
      console.warn(`Invalid startDate received, using fallback: ${startDate}`);
    }
    
    if (!isValidDate(endDate)) {
      endDate = getYesterdayISO();
      console.warn(`Invalid endDate received, using fallback: ${endDate}`);
    }

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

    // 6. Fetch sales data from SP-API (production - no fallback)
    let salesResult;
    try {
      salesResult = await spApiClient.getSalesData(startDate, endDate, granularity);
    } catch (error) {
      console.error('SP-API sales data fetch failed:', error.message);
      
      // Log the failure and return error
      await supabaseService.logIngestion('sales', 'failed', {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
        phase: 'sp_api_fetch'
      });

      return res.status(500).json({
        success: false,
        error: 'SP-API request failed',
        message: error.message,
        logId: logId?.id,
        duration: `${Date.now() - startTime}ms`
      });
    }
    
    // 7. Check if we have any data to process
    if (!salesResult.metrics || salesResult.metrics.length === 0) {
      console.log('No sales data found for the specified date range');
      
      await supabaseService.logIngestion('sales', 'completed', {
        recordsProcessed: 0,
        message: 'No sales data available for date range',
        duration: Date.now() - startTime,
        totalRecordsProcessed: salesResult.totalRecordsProcessed || 0
      });

      return res.status(200).json({
        success: true,
        message: 'No sales data available for the specified date range',
        recordsProcessed: 0,
        totalRecordsScanned: salesResult.totalRecordsProcessed || 0,
        dateRange: { startDate, endDate, granularity },
        duration: `${Date.now() - startTime}ms`,
        logId: logId?.id
      });
    }

    // 8. Store sales data in database
    const salesUpsertResult = await supabaseService.upsertSalesData(
      salesResult.metrics, 
      'sp-api-cron'
    );

    // 9. Try to fetch orders data (optional - don't fail if this errors)
    let ordersUpsertResult = { count: 0 };
    try {
      await rateLimiter.waitForToken();
      const ordersResult = await spApiClient.getOrdersData(startDate, endDate);
      
      if (ordersResult && ordersResult.orders && ordersResult.orders.length > 0) {
        ordersUpsertResult = await supabaseService.upsertOrdersData(
          ordersResult.orders,
          'sp-api-cron'
        );
      }
    } catch (error) {
      console.warn('Failed to fetch/process orders data (non-critical):', error.message);
      // Continue without orders data
    }

    // 10. Log successful completion
    const duration = Date.now() - startTime;
    await supabaseService.logIngestion('sales', 'completed', {
      recordsProcessed: salesUpsertResult.count + ordersUpsertResult.count,
      salesRecords: salesUpsertResult.count,
      orderRecords: ordersUpsertResult.count,
      totalRecordsScanned: salesResult.totalRecordsProcessed || 0,
      nonZeroRecords: salesResult.nonZeroRecords || 0,
      duration,
      rateLimitInfo: salesResult.rateLimitInfo
    });

    // 11. Return success response
    res.status(200).json({
      success: true,
      message: 'Sales data ingestion completed successfully',
      recordsProcessed: {
        sales: salesUpsertResult.count,
        orders: ordersUpsertResult.count,
        total: salesUpsertResult.count + ordersUpsertResult.count
      },
      totalRecordsScanned: salesResult.totalRecordsProcessed || 0,
      nonZeroRecords: salesResult.nonZeroRecords || 0,
      dateRange: { startDate, endDate, granularity },
      duration: `${duration}ms`,
      logId: logId?.id,
      rateLimitInfo: salesResult.rateLimitInfo
    });

  } catch (error) {
    console.error('Sales ingestion failed:', error);
    
    // Log the failure
    try {
      const supabaseService = new SupabaseService();
      await supabaseService.logIngestion('sales', 'failed', {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // Handle specific error types
    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Amazon API rate limit hit, please retry later',
        retryAfter: 60
      });
    }

    if (error.message.includes('credentials') || error.message.includes('Missing')) {
      return res.status(500).json({
        success: false,
        error: 'Configuration error',
        message: 'Missing required API credentials',
        logId: logId?.id,
        duration: `${Date.now() - startTime}ms`
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
 * Process template variables from cron services
 */
function processTemplateVariable(dateString) {
  if (typeof dateString !== 'string') {
    return dateString;
  }

  switch (dateString.trim()) {
    case '{{LAST_WEEK_START}}':
      return getLastWeekStart();
    
    case '{{LAST_WEEK_END}}':
      return getLastWeekEnd();
    
    case '{{YESTERDAY}}':
      return getYesterdayISO();
    
    case '{{TODAY}}':
      return getTodayISO();
    
    case '{{LAST_MONTH_START}}':
      return getLastMonthStart();
    
    case '{{LAST_MONTH_END}}':
      return getLastMonthEnd();
    
    default:
      return dateString;
  }
}

/**
 * Helper functions for date processing
 */
function getYesterdayISO() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

function getTodayISO() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getLastWeekStart() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToLastMonday = dayOfWeek === 0 ? 13 : (dayOfWeek + 6);
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(today.getDate() - daysToLastMonday);
  return lastWeekStart.toISOString().split('T')[0];
}

function getLastWeekEnd() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  const lastWeekEnd = new Date(today);
  lastWeekEnd.setDate(today.getDate() - daysToLastSunday);
  return lastWeekEnd.toISOString().split('T')[0];
}

function getLastMonthStart() {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return lastMonth.toISOString().split('T')[0];
}

function getLastMonthEnd() {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  return lastMonth.toISOString().split('T')[0];
}

function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateString.match(regex)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};