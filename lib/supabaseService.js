/**
 * Enhanced Supabase Service - Production Version
 * Simplified schema for real sales data only
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
   * Upsert sales metrics data (production - no mock data)
   * Simplified schema without extra columns
   */
  async upsertSalesData(salesData, source = 'sp-api') {
    try {
      if (!salesData || salesData.length === 0) {
        console.log('No sales data to upsert');
        return { success: true, count: 0, data: [] };
      }

      // Remove duplicates by date before processing
      const uniqueDataMap = new Map();
      
      salesData.forEach(record => {
        const key = record.date;
        if (!uniqueDataMap.has(key)) {
          uniqueDataMap.set(key, record);
        } else {
          // If duplicate, merge/sum the values
          const existing = uniqueDataMap.get(key);
          existing.units_ordered = (existing.units_ordered || 0) + (record.units_ordered || 0);
          existing.total_order_items = (existing.total_order_items || 0) + (record.total_order_items || 0);
          existing.ordered_product_sales = (existing.ordered_product_sales || 0) + (record.ordered_product_sales || 0);
        }
      });

      const uniqueData = Array.from(uniqueDataMap.values());
      
      // Transform data to match simplified sales_metrics schema
      const transformedData = uniqueData.map(record => ({
        date: record.date,
        marketplace_id: 'ATVPDKIKX0DER',
        unit_count: record.units_ordered || 0,
        order_item_count: record.total_order_items || 0,
        order_count: record.units_ordered || 0,
        average_unit_price: record.ordered_product_sales && record.units_ordered ? 
          parseFloat((record.ordered_product_sales / record.units_ordered).toFixed(4)) : 0,
        total_sales: record.ordered_product_sales || 0,
        granularity: 'Day',
        source: source,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      console.log('Upserting sales metrics data:', transformedData.length, 'records');
      
      if (transformedData.length > 0) {
        console.log('Sample record:', JSON.stringify(transformedData[0], null, 2));
      }

      // Use the sales_metrics table with proper unique constraint
      const { data, error } = await this.supabase
        .from('sales_metrics')
        .upsert(transformedData, { 
          onConflict: 'date,marketplace_id,granularity',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error('Supabase upsert error details:', error);
        throw error;
      }

      console.log(`Successfully upserted ${data.length} sales metrics records`);
      return { success: true, count: data.length, data };

    } catch (error) {
      console.error('Error upserting sales metrics data:', error);
      throw error;
    }
  }

  /**
   * Upsert orders data
   */
  async upsertOrdersData(ordersData, source = 'sp-api') {
    try {
      if (!ordersData || ordersData.length === 0) {
        console.log('No orders data to upsert');
        return { success: true, count: 0, data: [] };
      }

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
   * Log ingestion activities for monitoring
   */
  async logIngestion(type, status, details = {}) {
    try {
      const logEntry = {
        ingestion_type: type,
        status: status,
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