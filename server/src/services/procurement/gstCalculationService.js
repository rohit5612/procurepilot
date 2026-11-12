import { query } from '../../database/connection.js';

class GstCalculationService {
  /**
   * Calculate GST breakdown (CGST/SGST vs IGST) based on supplier and delivery locations
   * Rules:
   * - Same circle: CGST = gstRate/2, SGST = gstRate/2, IGST = 0
   * - Different circles: CGST = 0, SGST = 0, IGST = gstRate
   */
  async calculateGstBreakdown(supplierId, deliveryCircleId, gstRate) {
    try {
      // Get supplier's circle
      const supplierRes = await query(`
        SELECT sc.circle_id 
        FROM supplier_circles sc
        WHERE sc.supplier_id = $1
        LIMIT 1
      `, [supplierId]);

      const supplierCircleId = supplierRes.rows[0]?.circle_id;

      // Default to IGST if no circle info
      if (!supplierCircleId || !deliveryCircleId) {
        return {
          cgst: 0,
          sgst: 0,
          igst: gstRate,
          is_interstate: true
        };
      }

      // Same circle = intrastate (CGST + SGST)
      // Different circles = interstate (IGST)
      const isIntrastate = supplierCircleId === deliveryCircleId;

      if (isIntrastate) {
        const halfRate = gstRate / 2;
        return {
          cgst: halfRate,
          sgst: halfRate,
          igst: 0,
          is_interstate: false
        };
      } else {
        return {
          cgst: 0,
          sgst: 0,
          igst: gstRate,
          is_interstate: true
        };
      }
    } catch (error) {
      console.error('Failed to calculate GST breakdown:', error);
      // Default to IGST on error
      return {
        cgst: 0,
        sgst: 0,
        igst: gstRate,
        is_interstate: true
      };
    }
  }

  /**
   * Calculate line item totals with GST
   */
  calculateLineTotals(unitPrice, quantity, gstRate, cgst, sgst, igst) {
    const baseAmount = unitPrice * quantity;
    const cgstAmount = (baseAmount * cgst) / 100;
    const sgstAmount = (baseAmount * sgst) / 100;
    const igstAmount = (baseAmount * igst) / 100;
    const totalGst = cgstAmount + sgstAmount + igstAmount;
    const totalAmount = baseAmount + totalGst;

    return {
      base_amount: baseAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_gst: totalGst,
      total_amount: totalAmount
    };
  }
}

export default new GstCalculationService();

