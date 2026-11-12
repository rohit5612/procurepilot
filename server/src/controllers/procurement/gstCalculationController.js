import gstCalculationService from '../../services/procurement/gstCalculationService.js';

class GstCalculationController {
  /**
   * Calculate GST breakdown for PO line items
   * POST /api/procurement/calculate-gst
   * Body: { supplier_id, delivery_circle_id, lines: [{ unit_price, quantity, gst_rate }] }
   */
  async calculateGstForLines(req, res) {
    try {
      const { supplier_id, delivery_circle_id, lines } = req.body;

      if (!supplier_id || !lines || !Array.isArray(lines)) {
        return res.status(400).json({
          success: false,
          error: 'supplier_id and lines array are required'
        });
      }

      // Calculate GST breakdown once for all lines (same supplier/delivery)
      const gstBreakdown = await gstCalculationService.calculateGstBreakdown(
        supplier_id,
        delivery_circle_id,
        0 // We'll use individual line gst_rate
      );

      // Process each line
      const processedLines = lines.map((line, index) => {
        const gstRate = parseFloat(line.gst_rate) || 0;
        const unitPrice = parseFloat(line.unit_price) || 0;
        const quantity = parseFloat(line.quantity) || 0;

        // Get breakdown for this line's GST rate
        const lineGstBreakdown = gstBreakdown.is_interstate
          ? { cgst: 0, sgst: 0, igst: gstRate }
          : { cgst: gstRate / 2, sgst: gstRate / 2, igst: 0 };

        // Calculate totals
        const totals = gstCalculationService.calculateLineTotals(
          unitPrice,
          quantity,
          gstRate,
          lineGstBreakdown.cgst,
          lineGstBreakdown.sgst,
          lineGstBreakdown.igst
        );

        return {
          index,
          unit_price: unitPrice,
          quantity,
          gst_rate: gstRate,
          cgst: lineGstBreakdown.cgst,
          sgst: lineGstBreakdown.sgst,
          igst: lineGstBreakdown.igst,
          is_interstate: gstBreakdown.is_interstate,
          ...totals
        };
      });

      return res.json({
        success: true,
        data: {
          is_interstate: gstBreakdown.is_interstate,
          lines: processedLines
        }
      });
    } catch (error) {
      console.error('Error calculating GST:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new GstCalculationController();

