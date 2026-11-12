import domainEventService from './domainEventService.js';
import redisManager from '../../config/redis.js';
import procurementNotificationService from '../procurement/procurementNotificationService.js';

class OutboxWorker {
  constructor() {
    this.isRunning = false;
    this.processingInterval = null;
    this.cleanupInterval = null;
    this.retryInterval = null;
  }

  /**
   * Start the outbox worker
   */
  async start() {
    if (this.isRunning) {
      console.log('Outbox worker is already running');
      return;
    }

    console.log('🚀 Starting outbox worker...');
    this.isRunning = true;

    // Start processing events every 10 seconds
    this.processingInterval = setInterval(async () => {
      await this.processPendingEvents();
    }, 10000);

    // Start cleanup job every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldEvents();
    }, 60 * 60 * 1000);

    // Start retry job every 5 minutes
    this.retryInterval = setInterval(async () => {
      await this.retryFailedEvents();
    }, 5 * 60 * 1000);

    console.log('✅ Outbox worker started successfully');
  }

  /**
   * Stop the outbox worker
   */
  async stop() {
    if (!this.isRunning) {
      console.log('Outbox worker is not running');
      return;
    }

    console.log('🛑 Stopping outbox worker...');
    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }

    console.log('✅ Outbox worker stopped successfully');
  }

  /**
   * Process pending events
   */
  async processPendingEvents() {
    try {
      const pendingEvents = await domainEventService.getPendingEvents(50);
      
      if (pendingEvents.length === 0) {
        return;
      }

      console.log(`📦 Processing ${pendingEvents.length} pending events...`);

      for (const event of pendingEvents) {
        try {
          await this.processEvent(event);
          await domainEventService.markEventProcessed(event.event_id);
          console.log(`✅ Processed event: ${event.event_type} (${event.event_id})`);
        } catch (error) {
          console.error(`❌ Failed to process event ${event.event_id}:`, error.message);
          await domainEventService.markEventFailed(event.event_id, error.message);
        }
      }
    } catch (error) {
      console.error('❌ Error in processPendingEvents:', error.message);
    }
  }

  /**
   * Process a single event
   */
  async processEvent(event) {
    const { event_type, event_data, metadata } = event;

    // Handle different event types
    switch (event_type) {
      case 'PROCUREMENT.REQUISITION.SUBMITTED':
        await this.handleRequisitionSubmitted(event_data, metadata);
        break;
      
      case 'PROCUREMENT.REQUISITION.APPROVED':
        await this.handleRequisitionApproved(event_data, metadata);
        break;
      
      case 'PROCUREMENT.REQUISITION.REJECTED':
        await this.handleRequisitionRejected(event_data, metadata);
        break;
      
      case 'PROCUREMENT.PO_CREATED':
        await this.handlePurchaseOrderCreated(event_data, metadata);
        break;

      case 'PROCUREMENT.PO_SUBMITTED':
        await this.handlePurchaseOrderSubmitted(event_data, metadata);
        break;

      case 'PROCUREMENT.PO_REJECTED':
        await this.handlePurchaseOrderRejected(event_data, metadata);
        break;
      
      case 'PROCUREMENT.PO_APPROVED':
        await this.handlePurchaseOrderApproved(event_data, metadata);
        break;
      
      case 'PROCUREMENT.PO_ISSUED':
        await this.handlePurchaseOrderIssued(event_data, metadata);
        break;
      
      case 'PROCUREMENT.GRN_POSTED':
        await this.handleGoodsReceiptPosted(event_data, metadata);
        break;
      
      case 'INVENTORY.STOCK_MOVED':
        await this.handleStockMoved(event_data, metadata);
        break;
      
      default:
        console.warn(`⚠️ Unknown event type: ${event_type}`);
        // Don't throw error for unknown events - just log and continue
    }
  }

  /**
   * Handle requisition submitted event
   */
  async handleRequisitionSubmitted(eventData, metadata) {
    console.log('📋 Processing requisition submitted:', eventData.requisition_id);
    
    // Publish to Redis for immediate consumption
    await domainEventService.publishToRedis('requisition_submitted', {
      requisition_id: eventData.requisition_id,
      requester_id: eventData.requester_id,
      total_amount: eventData.total_amount,
      department_id: eventData.department_id
    });

    await procurementNotificationService.notifyRequisitionSubmitted(eventData);
  }

  /**
   * Handle requisition approved event
   */
  async handleRequisitionApproved(eventData, metadata) {
    console.log('✅ Processing requisition approved:', eventData.requisition_id);
    
    await procurementNotificationService.notifyRequisitionApproved(eventData);
  }

  /**
   * Handle requisition rejected event
   */
  async handleRequisitionRejected(eventData, metadata) {
    console.log('❌ Processing requisition rejected:', eventData.requisition_id);
    
    await procurementNotificationService.notifyRequisitionRejected(eventData);
  }

  async handlePurchaseOrderSubmitted(eventData, metadata) {
    console.log('📋 Processing PO submitted:', eventData.po_id);
    await procurementNotificationService.notifyPoSubmitted(eventData);
  }

  async handlePurchaseOrderRejected(eventData, metadata) {
    console.log('❌ Processing PO rejected:', eventData.po_id);
    await procurementNotificationService.notifyPoRejected(eventData, metadata);
  }

  /**
   * Handle purchase order created event
   */
  async handlePurchaseOrderCreated(eventData, metadata) {
    console.log('📄 Processing PO created:', eventData.purchase_order_id);
    
    // TODO: Update requisition status
    // TODO: Send notification to supplier (if auto-notification enabled)
  }

  /**
   * Handle purchase order approved event
   */
  async handlePurchaseOrderApproved(eventData, metadata) {
    console.log('✅ Processing PO approved:', eventData.purchase_order_id);
    
    await procurementNotificationService.notifyPoApproved(eventData);
  }

  /**
   * Handle purchase order issued event
   */
  async handlePurchaseOrderIssued(eventData, metadata) {
    console.log('📤 Processing PO issued:', eventData.purchase_order_id);

    // Publish to Redis channel for notifications/async consumers
    await domainEventService.publishToRedis('po_issued', {
      po_id: eventData.po_id || eventData.purchase_order_id,
      issued_by: metadata?.issued_by || null,
    });

    // TODO: Create expected receipts if needed
  }

  /**
   * Handle goods receipt posted event
   */
  async handleGoodsReceiptPosted(eventData, metadata) {
    console.log('📦 Processing GRN posted:', eventData.grn_id);

    // Publish to Redis channel for notifications/async consumers
    await domainEventService.publishToRedis('grn_posted', {
      grn_id: eventData.grn_id,
      posted_by: metadata?.posted_by || null,
    });

    // TODO: Accounting hooks
  }

  /**
   * Handle stock moved event
   */
  async handleStockMoved(eventData, metadata) {
    console.log('🔄 Processing stock moved:', eventData.transaction_id);
    
    // TODO: Update inventory levels
    // TODO: Create inventory transactions
    // TODO: Trigger accounting entries if needed
  }

  /**
   * Clean up old processed events
   */
  async cleanupOldEvents() {
    try {
      const deletedCount = await domainEventService.cleanupOldEvents(30);
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old events`);
      }
    } catch (error) {
      console.error('❌ Error in cleanupOldEvents:', error.message);
    }
  }

  /**
   * Retry failed events
   */
  async retryFailedEvents() {
    try {
      const retryCount = await domainEventService.retryFailedEvents();
      if (retryCount > 0) {
        console.log(`🔄 Retrying ${retryCount} failed events`);
      }
    } catch (error) {
      console.error('❌ Error in retryFailedEvents:', error.message);
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasProcessingInterval: !!this.processingInterval,
      hasCleanupInterval: !!this.cleanupInterval,
      hasRetryInterval: !!this.retryInterval
    };
  }
}

export default new OutboxWorker();
