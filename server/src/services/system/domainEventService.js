import { query } from '../../database/connection.js';
import redisManager from '../../config/redis.js';

class DomainEventService {
  /**
   * Publish a domain event to the outbox
   */
  async publishEvent(eventType, aggregateId, aggregateType, eventData, metadata = {}) {
    // ProcurePilot: outbox table removed; workflow uses direct service calls.
    try {
      await this.publishToRedis(eventType, {
        aggregateId,
        aggregateType,
        eventData,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (redisError) {
      console.warn('Domain event (Redis optional):', redisError.message);
    }
    return null;
  }

  /**
   * Publish event to Redis for immediate consumption
   */
  async publishToRedis(eventType, eventData) {
    const channel = `domain_events:${eventType}`;
    await redisManager.publish(channel, JSON.stringify(eventData));
  }

  /**
   * Get pending events for processing
   */
  async getPendingEvents(limit = 100) {
    try {
      const result = await query(
        `SELECT * FROM get_pending_events($1)`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      if (error.code === '42P01') {
        return [];
      }
      console.error('Failed to get pending events:', error);
      throw new Error(`Failed to get pending events: ${error.message}`);
    }
  }

  /**
   * Mark event as processed
   */
  async markEventProcessed(eventId) {
    try {
      const result = await query(
        `SELECT mark_event_processed($1) as success`,
        [eventId]
      );
      return result.rows[0].success;
    } catch (error) {
      console.error('Failed to mark event as processed:', error);
      throw new Error(`Failed to mark event as processed: ${error.message}`);
    }
  }

  /**
   * Mark event as failed
   */
  async markEventFailed(eventId, errorMessage) {
    try {
      const result = await query(
        `SELECT mark_event_failed($1, $2) as success`,
        [eventId, errorMessage]
      );
      return result.rows[0].success;
    } catch (error) {
      console.error('Failed to mark event as failed:', error);
      throw new Error(`Failed to mark event as failed: ${error.message}`);
    }
  }

  /**
   * Get event statistics
   */
  async getEventStatistics() {
    try {
      const result = await query(`
        SELECT 
          status,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours') as last_24h,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as last_7d
        FROM domain_outbox 
        GROUP BY status
      `);

      const stats = {
        total: 0,
        pending: 0,
        processed: 0,
        failed: 0,
        last24h: 0,
        last7d: 0
      };

      result.rows.forEach(row => {
        stats[row.status] = parseInt(row.count);
        stats.total += parseInt(row.count);
        stats.last24h += parseInt(row.last_24h);
        stats.last7d += parseInt(row.last_7d);
      });

      return stats;
    } catch (error) {
      console.error('Failed to get event statistics:', error);
      throw new Error(`Failed to get event statistics: ${error.message}`);
    }
  }

  /**
   * Clean up old processed events (older than 30 days)
   */
  async cleanupOldEvents(daysToKeep = 30) {
    try {
      const result = await query(`
        DELETE FROM domain_outbox 
        WHERE status = 'processed' 
        AND processed_at < CURRENT_DATE - INTERVAL '${daysToKeep} days'
      `);
      
      return result.rowCount;
    } catch (error) {
      console.error('Failed to cleanup old events:', error);
      throw new Error(`Failed to cleanup old events: ${error.message}`);
    }
  }

  /**
   * Retry failed events
   */
  async retryFailedEvents() {
    try {
      const result = await query(`
        UPDATE domain_outbox 
        SET status = 'pending', 
            retry_count = 0,
            next_retry_at = NULL,
            error_message = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'failed' 
        AND retry_count < max_retries
      `);
      
      return result.rowCount;
    } catch (error) {
      console.error('Failed to retry failed events:', error);
      throw new Error(`Failed to retry failed events: ${error.message}`);
    }
  }

  /**
   * Subscribe to Redis events
   */
  async subscribeToEvents(eventTypes, callback) {
    try {
      const subscriber = redisManager.createClient();
      
      for (const eventType of eventTypes) {
        const channel = `domain_events:${eventType}`;
        await subscriber.subscribe(channel, (message) => {
          try {
            const eventData = JSON.parse(message);
            callback(eventType, eventData);
          } catch (error) {
            console.error('Failed to process Redis event:', error);
          }
        });
      }

      return subscriber;
    } catch (error) {
      console.error('Failed to subscribe to events:', error);
      throw new Error(`Failed to subscribe to events: ${error.message}`);
    }
  }
}

export default new DomainEventService();
