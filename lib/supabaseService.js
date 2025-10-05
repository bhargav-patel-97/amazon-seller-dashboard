/**
 * Enhanced Supabase Service for Amazon Seller Dashboard
 * Handles all database operations with proper error handling and logging
 */

import { createClient } from '@supabase/supabase-js';

class SupabaseService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Upsert sales data with proper error handling
   */
  async upsertSalesData(salesData, source = 'sp-api') {
    try {
      // Transform data to match database schema
      const transformedData = salesData.map(record => ({
        date: record.date,
        units_ordered: record.units_ordered || 0,
        units_shipped: record.units_shipped || 0,
        ordered_product_sales: record.ordered_product_sales || 0,
        shipped_product_sales: record.shipped_product_sales || 0,
        total_order_items: record.total_order_items || 0,
        sessions: record.sessions || 0,
        page_views: record.page_views || 0,
        page_views_percentage: record.page_views_percentage || 0,
        buy_box_percentage: record.buy_box_percentage || 0,
        unit_session_percentage: record.unit_session_percentage || 0,
        source: source,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await this.supabase
        .from('sales')
        .upsert(transformedData, { 
          onConflict: 'date',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        throw error;
      }

      console.log(`Successfully upserted ${data.length} sales records`);
      return { success: true, count: data.length, data };
    } catch (error) {
      console.error('Error upserting sales data:', error);
      throw error;
    }
  }

  /**
   * Upsert orders data
   */
  async upsertOrdersData(ordersData, source = 'sp-api') {
    try {
      const transformedData = ordersData.map(order => ({
        amazon_order_id: order.amazon_order_id,
        order_date: order.order_date,
        order_status: order.order_status,
        fulfillment_channel: order.fulfillment_channel,
        sales_channel: order.sales_channel,
        order_total: order.order_total || 0,
        currency: order.currency || 'USD',
        number_of_items_shipped: order.number_of_items_shipped || 0,
        number_of_items_unshipped: order.number_of_items_unshipped || 0,
        payment_method: order.payment_method,
        marketplace_id: order.marketplace_id,
        buyer_email: order.buyer_email,
        buyer_name: order.buyer_name,
        shipment_service_level_category: order.shipment_service_level_category,
        source: source,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await this.supabase
        .from('orders')
        .upsert(transformedData, { 
          onConflict: 'amazon_order_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        throw error;
      }

      console.log(`Successfully upserted ${data.length} order records`);
      return { success: true, count: data.length, data };
    } catch (error) {
      console.error('Error upserting orders data:', error);
      throw error;
    }
  }

  /**
   * Upsert ads campaigns data
   */
  async upsertAdsData(campaignsData, source = 'ads-api') {
    try {
      const transformedData = campaignsData.map(campaign => ({
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        campaign_status: campaign.campaign_status,
        campaign_type: campaign.campaign_type,
        targeting_type: campaign.targeting_type,
        daily_budget: campaign.daily_budget || 0,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        cost: campaign.cost || 0,
        sales_7d: campaign.sales_7d || 0,
        orders_7d: campaign.orders_7d || 0,
        units_7d: campaign.units_7d || 0,
        conversions_7d: campaign.conversions_7d || 0,
        acos: campaign.acos || 0,
        roas: campaign.roas || 0,
        date_range_start: campaign.date_range_start,
        date_range_end: campaign.date_range_end,
        source: source,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await this.supabase
        .from('ads_campaigns')
        .upsert(transformedData, { 
          onConflict: 'campaign_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        throw error;
      }

      console.log(`Successfully upserted ${data.length} campaign records`);
      return { success: true, count: data.length, data };
    } catch (error) {
      console.error('Error upserting ads data:', error);
      throw error;
    }
  }

  /**
   * Log ingestion activities for monitoring
   */
  async logIngestion(type, status, details = {}) {
    try {
      const logEntry = {
        ingestion_type: type, // 'sales', 'orders', 'ads'
        status: status, // 'started', 'completed', 'failed'
        details: details,
        timestamp: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('ingestion_logs')
        .insert([logEntry])
        .select();

      if (error) {
        console.error('Failed to log ingestion:', error);
        return null;
      }

      return data[0];
    } catch (error) {
      console.error('Error logging ingestion:', error);
      return null;
    }
  }

  /**
   * Get recent ingestion logs for monitoring
   */
  async getRecentLogs(limit = 100) {
    try {
      const { data, error } = await this.supabase
        .from('ingestion_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching logs:', error);
      throw error;
    }
  }

  /**
   * Batch upsert with transaction support
   */
  async batchUpsert(tableName, data, conflictColumns, batchSize = 100) {
    const results = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        const { data: batchResult, error } = await this.supabase
          .from(tableName)
          .upsert(batch, { 
            onConflict: conflictColumns,
            ignoreDuplicates: false 
          })
          .select();

        if (error) {
          throw error;
        }

        results.push(...batchResult);
        console.log(`Processed batch ${Math.ceil((i + 1) / batchSize)} of ${Math.ceil(data.length / batchSize)}`);
      } catch (error) {
        console.error(`Error in batch ${Math.ceil((i + 1) / batchSize)}:`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    try {
      const { data, error } = await this.supabase
        .from('ingestion_logs')
        .select('count(*)')
        .limit(1);

      if (error) {
        throw error;
      }

      return { healthy: true, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { healthy: false, error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

export default SupabaseService;