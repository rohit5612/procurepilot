import { query } from '../../database/connection.js';

/**
 * Lightweight reporting service
 * - Uses pre-defined report types with curated columns and filters
 * - Avoids arbitrary SQL while giving admins flexibility
 */
class ReportService {
  constructor() {
    /**
     * Registry of available report types.
     * Each entry defines:
     * - baseQuery: FROM/JOIN and mandatory predicates
     * - allowedColumns: safe column expressions keyed by logical name
     * - defaultColumns: sensible defaults if client doesn't request explicitly
     * - filterDefs: allowed filters and how they map into WHERE clauses
     * - defaultSort: { column, direction }
     */
    this.reportTypes = {
      'procurement.pr_summary': {
        baseQuery: `
          FROM requisitions r
          LEFT JOIN users u ON r.requester_id = u.id
          LEFT JOIN departments d ON r.department_id = d.id
          LEFT JOIN sites s ON r.site_id = s.id
        `,
        allowedColumns: {
          requisition_number: 'r.requisition_number',
          title: 'r.title',
          status: 'r.status',
          department_name: 'd.name AS department_name',
          site_name: 's.name AS site_name',
          requester_name: "u.first_name || ' ' || u.last_name AS requester_name",
          needed_by_date: 'r.needed_by_date',
          total_quantity: 'r.total_quantity',
          total_amount: 'r.total_amount',
          created_at: 'r.created_at',
          approved_at: 'r.approved_at'
        },
        defaultColumns: ['requisition_number', 'title', 'status', 'department_name', 'site_name', 'requester_name', 'total_amount', 'created_at'],
        filterDefs: {
          status: { column: 'r.status', type: 'enum' },
          department_id: { column: 'r.department_id', type: 'number' },
          requester_id: { column: 'r.requester_id', type: 'number' },
          circle_id: { column: 'r.circle_id', type: 'number' },
          cluster_id: { column: 'r.cluster_id', type: 'number' },
          created_from: { column: 'r.created_at', type: 'date_from' },
          created_to: { column: 'r.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'procurement.pr_lines': {
        baseQuery: `
          FROM requisitions r
          LEFT JOIN requisition_lines rl ON rl.requisition_id = r.id
          LEFT JOIN users u ON r.requester_id = u.id
          LEFT JOIN departments d ON r.department_id = d.id
          LEFT JOIN sites s ON r.site_id = s.id
        `,
        allowedColumns: {
          requisition_number: 'r.requisition_number',
          title: 'r.title',
          status: 'r.status',
          department_name: 'd.name AS department_name',
          site_name: 's.name AS site_name',
          requester_name: "u.first_name || ' ' || u.last_name AS requester_name",
          created_at: 'r.created_at',
          needed_by_date: 'r.needed_by_date',
          line_number: 'rl.line_number',
          item_code: 'rl.item_code',
          item_name: 'rl.item_name',
          item_description: 'rl.item_description',
          quantity: 'rl.quantity',
          unit_of_measure: 'rl.unit_of_measure',
          unit_price: 'rl.unit_price',
          total_price: 'rl.total_price',
          specifications: 'rl.specifications',
          brand: 'rl.brand',
          model: 'rl.model',
          line_needed_by_date: 'rl.needed_by_date',
          manufacturer: 'rl.manufacturer',
          spare_type: 'rl.spare_type'
        },
        defaultColumns: [
          'requisition_number',
          'status',
          'department_name',
          'site_name',
          'requester_name',
          'line_number',
          'item_code',
          'item_name',
          'quantity',
          'unit_of_measure',
          'unit_price',
          'total_price',
          'created_at'
        ],
        filterDefs: {
          status: { column: 'r.status', type: 'enum' },
          department_id: { column: 'r.department_id', type: 'number' },
          requester_id: { column: 'r.requester_id', type: 'number' },
          circle_id: { column: 'r.circle_id', type: 'number' },
          cluster_id: { column: 'r.cluster_id', type: 'number' },
          created_from: { column: 'r.created_at', type: 'date_from' },
          created_to: { column: 'r.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'procurement.po_summary': {
        baseQuery: `
          FROM purchase_orders po
          LEFT JOIN suppliers s ON s.id = po.supplier_id
        `,
        allowedColumns: {
          po_number: 'po.po_number',
          title: 'po.title',
          status: 'po.status',
          supplier_name: 's.name AS supplier_name',
          supplier_id: 'po.supplier_id',
          total_amount: 'po.total_amount',
          total_quantity: 'po.total_quantity',
          currency: 'po.currency',
          created_at: 'po.created_at',
          issued_at: 'po.issued_at',
          approved_at: 'po.approved_at'
        },
        defaultColumns: ['po_number', 'title', 'status', 'supplier_name', 'total_amount', 'created_at'],
        filterDefs: {
          status: { column: 'po.status', type: 'enum' },
          supplier_id: { column: 'po.supplier_id', type: 'number' },
          created_from: { column: 'po.created_at', type: 'date_from' },
          created_to: { column: 'po.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'procurement.po_lines': {
        baseQuery: `
          FROM purchase_orders po
          LEFT JOIN po_lines pl ON pl.purchase_order_id = po.id
          LEFT JOIN suppliers s ON s.id = po.supplier_id
        `,
        allowedColumns: {
          po_number: 'po.po_number',
          title: 'po.title',
          status: 'po.status',
          supplier_name: 's.name AS supplier_name',
          supplier_id: 'po.supplier_id',
          currency: 'po.currency',
          created_at: 'po.created_at',
          issued_at: 'po.issued_at',
          approved_at: 'po.approved_at',
          line_number: 'pl.line_number',
          item_id: 'pl.item_id',
          item_code: 'pl.item_code',
          item_name: 'pl.item_name',
          item_description: 'pl.item_description',
          quantity: 'pl.quantity',
          unit_of_measure: 'pl.unit_of_measure',
          unit_price: 'pl.unit_price',
          base_amount: 'pl.base_amount',
          cgst_rate: 'pl.cgst_rate',
          sgst_rate: 'pl.sgst_rate',
          igst_rate: 'pl.igst_rate',
          gst_rate: 'pl.gst_rate',
          cgst_amount: 'pl.cgst_amount',
          sgst_amount: 'pl.sgst_amount',
          igst_amount: 'pl.igst_amount',
          total_price: 'pl.total_price',
          manufacturer: 'pl.manufacturer',
          spare_type: 'pl.spare_type',
          brand: 'pl.brand',
          model: 'pl.model',
          promised_date: 'pl.promised_date'
        },
        defaultColumns: [
          'po_number',
          'status',
          'supplier_name',
          'line_number',
          'item_code',
          'item_name',
          'quantity',
          'unit_of_measure',
          'unit_price',
          'gst_rate',
          'total_price',
          'created_at'
        ],
        filterDefs: {
          status: { column: 'po.status', type: 'enum' },
          supplier_id: { column: 'po.supplier_id', type: 'number' },
          circle_id: { column: 'po.circle_id', type: 'number' },
          cluster_id: { column: 'po.cluster_id', type: 'number' },
          created_from: { column: 'po.created_at', type: 'date_from' },
          created_to: { column: 'po.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'inventory.issue_summary': {
        baseQuery: `
          FROM inventory_issues i
          LEFT JOIN inventory_issue_lines il ON il.issue_id = i.id
          LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
          LEFT JOIN clusters cl ON cl.id = i.cluster_id
        `,
        allowedColumns: {
          issue_number: 'i.issue_number',
          challan_number: 'i.challan_number',
          status: 'i.status',
          site_name: 'i.site_name',
          destination_type: 'i.destination_type',
          circle_name: 'tc.name AS circle_name',
          cluster_name: 'cl.name AS cluster_name',
          total_issued_qty: 'COALESCE(SUM(COALESCE(il.issued_qty, il.quantity)), 0)::int AS total_issued_qty',
          total_returned_qty: 'COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0)::int AS total_returned_qty',
          created_at: 'i.created_at'
        },
        defaultColumns: ['challan_number', 'status', 'site_name', 'circle_name', 'cluster_name', 'total_issued_qty', 'total_returned_qty', 'created_at'],
        // Note: filters mirror the existing IssueListPage
        filterDefs: {
          status: { column: 'i.status', type: 'enum' },
          circle_id: { column: 'i.circle_id', type: 'number' },
          cluster_id: { column: 'i.cluster_id', type: 'number' },
          created_from: { column: 'i.created_at', type: 'date_from' },
          created_to: { column: 'i.created_at', type: 'date_to' },
          search: { column: 'search', type: 'search' } // special-cased search across issue_number/challan_number/site_name
        },
        defaultSort: { column: 'created_at', direction: 'DESC' },
        groupBy: 'i.id, tc.name, cl.name'
      },
      'inventory.issue_lines': {
        baseQuery: `
          FROM inventory_issues i
          LEFT JOIN inventory_issue_lines il ON il.issue_id = i.id
          LEFT JOIN items itm ON itm.id = il.item_id
          LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
          LEFT JOIN clusters cl ON cl.id = i.cluster_id
        `,
        allowedColumns: {
          issue_number: 'i.issue_number',
          challan_number: 'i.challan_number',
          status: 'i.status',
          site_name: 'i.site_name',
          destination_type: 'i.destination_type',
          circle_name: 'tc.name AS circle_name',
          cluster_name: 'cl.name AS cluster_name',
          created_at: 'i.created_at',
          line_number: 'il.line_number',
          item_id: 'il.item_id',
          item_code: 'COALESCE(il.item_code, itm.item_code) AS item_code',
          item_name: 'COALESCE(il.item_description, itm.name) AS item_name',
          unit_of_measure: 'il.unit_of_measure',
          requested_qty: 'il.requested_qty',
          approved_qty: 'il.approved_qty',
          issued_qty: 'il.issued_qty',
          quantity: 'il.quantity',
          is_returnable: 'il.is_returnable',
          quantity_returned: 'il.quantity_returned'
        },
        defaultColumns: [
          'issue_number',
          'challan_number',
          'status',
          'site_name',
          'circle_name',
          'cluster_name',
          'line_number',
          'item_code',
          'item_name',
          'requested_qty',
          'approved_qty',
          'issued_qty',
          'is_returnable',
          'quantity_returned',
          'created_at'
        ],
        filterDefs: {
          status: { column: 'i.status', type: 'enum' },
          circle_id: { column: 'i.circle_id', type: 'number' },
          cluster_id: { column: 'i.cluster_id', type: 'number' },
          created_from: { column: 'i.created_at', type: 'date_from' },
          created_to: { column: 'i.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'procurement.grn_summary': {
        baseQuery: `
          FROM goods_receipts grn
          LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
          LEFT JOIN warehouses w ON w.id = grn.warehouse_id
          LEFT JOIN suppliers s ON s.id = grn.supplier_id
        `,
        allowedColumns: {
          grn_number: 'grn.grn_number',
          status: 'grn.status',
          po_number: 'po.po_number',
          po_title: 'po.title AS po_title',
          warehouse_name: 'w.name AS warehouse_name',
          supplier_name: 's.name AS supplier_name',
          created_at: 'grn.created_at',
          posted_at: 'grn.posted_at'
        },
        defaultColumns: ['grn_number', 'status', 'po_number', 'po_title', 'warehouse_name', 'supplier_name', 'created_at', 'posted_at'],
        filterDefs: {
          status: { column: 'grn.status', type: 'enum' },
          purchase_order_id: { column: 'grn.purchase_order_id', type: 'number' },
          warehouse_id: { column: 'grn.warehouse_id', type: 'number' },
          supplier_id: { column: 'grn.supplier_id', type: 'number' },
          circle_id: { column: 'grn.circle_id', type: 'number' },
          cluster_id: { column: 'grn.cluster_id', type: 'number' },
          created_from: { column: 'grn.created_at', type: 'date_from' },
          created_to: { column: 'grn.created_at', type: 'date_to' },
          search: { column: 'search', type: 'search_grn' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'procurement.grn_lines': {
        baseQuery: `
          FROM goods_receipts grn
          LEFT JOIN grn_lines gl ON gl.goods_receipt_id = grn.id
          LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
          LEFT JOIN warehouses w ON w.id = grn.warehouse_id
          LEFT JOIN suppliers s ON s.id = grn.supplier_id
        `,
        allowedColumns: {
          grn_number: 'grn.grn_number',
          status: 'grn.status',
          po_number: 'po.po_number',
          po_title: 'po.title AS po_title',
          warehouse_name: 'w.name AS warehouse_name',
          supplier_name: 's.name AS supplier_name',
          created_at: 'grn.created_at',
          posted_at: 'grn.posted_at',
          line_number: 'gl.line_number',
          item_id: 'gl.item_id',
          item_code: 'gl.item_code',
          item_name: 'gl.item_name',
          unit_of_measure: 'gl.unit_of_measure',
          unit_price: 'gl.unit_price',
          qty_as_per_po_snapshot: 'gl.qty_as_per_po_snapshot',
          already_received_snapshot: 'gl.already_received_snapshot',
          expected_qty_snapshot: 'gl.expected_qty_snapshot',
          received_qty: 'gl.received_qty',
          accepted_qty: 'gl.accepted_qty',
          rejected_qty: 'gl.rejected_qty',
          manufacturer: 'gl.manufacturer',
          spare_type: 'gl.spare_type'
        },
        defaultColumns: [
          'grn_number',
          'status',
          'po_number',
          'warehouse_name',
          'supplier_name',
          'line_number',
          'item_code',
          'item_name',
          'unit_of_measure',
          'qty_as_per_po_snapshot',
          'already_received_snapshot',
          'expected_qty_snapshot',
          'received_qty',
          'accepted_qty',
          'rejected_qty',
          'created_at'
        ],
        filterDefs: {
          status: { column: 'grn.status', type: 'enum' },
          purchase_order_id: { column: 'grn.purchase_order_id', type: 'number' },
          warehouse_id: { column: 'grn.warehouse_id', type: 'number' },
          supplier_id: { column: 'grn.supplier_id', type: 'number' },
          circle_id: { column: 'grn.circle_id', type: 'number' },
          cluster_id: { column: 'grn.cluster_id', type: 'number' },
          created_from: { column: 'grn.created_at', type: 'date_from' },
          created_to: { column: 'grn.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'inventory.transfer_summary': {
        baseQuery: `
          FROM inventory_transfers tr
          LEFT JOIN inventory_transfer_lines tl ON tl.transfer_id = tr.id
          LEFT JOIN warehouses fw ON fw.id = tr.from_warehouse_id
          LEFT JOIN warehouses tw ON tw.id = tr.to_warehouse_id
        `,
        allowedColumns: {
          transfer_number: 'tr.transfer_number',
          challan_number: 'tr.challan_number',
          status: 'tr.status',
          from_warehouse_name: 'fw.name AS from_warehouse_name',
          to_warehouse_name: 'tw.name AS to_warehouse_name',
          created_at: 'tr.created_at',
          challan_date: 'tr.challan_date',
          eway_bill_number: 'tr.eway_bill_number',
          vehicle_number: 'tr.vehicle_number',
          driver_name: 'tr.driver_name',
          line_count: 'COUNT(tl.id)::int AS line_count'
        },
        defaultColumns: ['transfer_number', 'challan_number', 'status', 'from_warehouse_name', 'to_warehouse_name', 'line_count', 'created_at'],
        filterDefs: {
          status: { column: 'tr.status', type: 'enum' },
          from_warehouse_id: { column: 'tr.from_warehouse_id', type: 'number' },
          to_warehouse_id: { column: 'tr.to_warehouse_id', type: 'number' },
          created_from: { column: 'tr.created_at', type: 'date_from' },
          created_to: { column: 'tr.created_at', type: 'date_to' },
          search: { column: 'search', type: 'search_transfer' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' },
        groupBy: 'tr.id, fw.name, tw.name'
      },
      'inventory.transfer_lines': {
        baseQuery: `
          FROM inventory_transfers tr
          LEFT JOIN inventory_transfer_lines tl ON tl.transfer_id = tr.id
          LEFT JOIN warehouses fw ON fw.id = tr.from_warehouse_id
          LEFT JOIN warehouses tw ON tw.id = tr.to_warehouse_id
          LEFT JOIN items it ON it.id = tl.item_id
        `,
        allowedColumns: {
          transfer_number: 'tr.transfer_number',
          challan_number: 'tr.challan_number',
          status: 'tr.status',
          from_warehouse_name: 'fw.name AS from_warehouse_name',
          to_warehouse_name: 'tw.name AS to_warehouse_name',
          created_at: 'tr.created_at',
          challan_date: 'tr.challan_date',
          eway_bill_number: 'tr.eway_bill_number',
          vehicle_number: 'tr.vehicle_number',
          driver_name: 'tr.driver_name',
          line_number: 'tl.line_number',
          item_id: 'tl.item_id',
          item_code: 'it.item_code',
          item_name: 'it.name AS item_name',
          quantity: 'tl.quantity',
          unit_of_measure: 'tl.unit_of_measure'
        },
        defaultColumns: [
          'transfer_number',
          'challan_number',
          'status',
          'from_warehouse_name',
          'to_warehouse_name',
          'line_number',
          'item_code',
          'item_name',
          'quantity',
          'unit_of_measure',
          'created_at'
        ],
        filterDefs: {
          status: { column: 'tr.status', type: 'enum' },
          from_warehouse_id: { column: 'tr.from_warehouse_id', type: 'number' },
          to_warehouse_id: { column: 'tr.to_warehouse_id', type: 'number' },
          created_from: { column: 'tr.created_at', type: 'date_from' },
          created_to: { column: 'tr.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'inventory.adjustment_summary': {
        baseQuery: `
          FROM inventory_adjustments a
          LEFT JOIN (
            SELECT adjustment_id, COALESCE(SUM(quantity_delta),0)::numeric AS sum_delta
            FROM inventory_adjustment_lines
            GROUP BY adjustment_id
          ) agg ON agg.adjustment_id = a.id
          LEFT JOIN warehouses w ON w.id = a.warehouse_id
        `,
        allowedColumns: {
          adjustment_number: 'a.adjustment_number',
          status: 'a.status',
          warehouse_name: 'w.name AS warehouse_name',
          sum_delta: 'COALESCE(agg.sum_delta,0)::numeric AS sum_delta',
          reason_code: 'a.reason_code',
          created_at: 'a.created_at',
          posted_at: 'a.posted_at'
        },
        defaultColumns: ['adjustment_number', 'status', 'warehouse_name', 'sum_delta', 'reason_code', 'created_at'],
        filterDefs: {
          warehouse_id: { column: 'a.warehouse_id', type: 'number' },
          status: { column: 'a.status', type: 'enum' },
          created_from: { column: 'a.created_at', type: 'date_from' },
          created_to: { column: 'a.created_at', type: 'date_to' },
          search: { column: 'search', type: 'search_adjustment' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'inventory.adjustment_lines': {
        baseQuery: `
          FROM inventory_adjustments a
          LEFT JOIN inventory_adjustment_lines al ON al.adjustment_id = a.id
          LEFT JOIN warehouses w ON w.id = a.warehouse_id
          LEFT JOIN items it ON it.id = al.item_id
        `,
        allowedColumns: {
          adjustment_number: 'a.adjustment_number',
          status: 'a.status',
          warehouse_name: 'w.name AS warehouse_name',
          reason_code: 'a.reason_code',
          created_at: 'a.created_at',
          posted_at: 'a.posted_at',
          line_number: 'al.line_number',
          item_id: 'al.item_id',
          item_code: 'it.item_code',
          item_name: 'it.name AS item_name',
          quantity_delta: 'al.quantity_delta',
          unit_of_measure: 'al.unit_of_measure'
        },
        defaultColumns: [
          'adjustment_number',
          'status',
          'warehouse_name',
          'reason_code',
          'line_number',
          'item_code',
          'item_name',
          'quantity_delta',
          'unit_of_measure',
          'created_at'
        ],
        filterDefs: {
          warehouse_id: { column: 'a.warehouse_id', type: 'number' },
          status: { column: 'a.status', type: 'enum' },
          created_from: { column: 'a.created_at', type: 'date_from' },
          created_to: { column: 'a.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'inventory.srn_summary': {
        baseQuery: `
          FROM store_return_notes srn
          LEFT JOIN store_return_items sri ON sri.srn_id = srn.id
          LEFT JOIN inventory_issues i ON i.id = srn.reference_challan_id
          LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
          LEFT JOIN clusters cl ON cl.id = i.cluster_id
        `,
        allowedColumns: {
          srn_number: 'srn.srn_number',
          status: 'srn.status',
          reference_challan_number: 'i.challan_number AS reference_challan_number',
          reference_circle_code: 'COALESCE(tc.code, tc.name) AS reference_circle_code',
          reference_cluster_code: 'COALESCE(cl.code, cl.name) AS reference_cluster_code',
          item_count: 'COUNT(sri.id)::int AS item_count',
          created_at: 'srn.created_at',
          received_at: 'srn.received_at'
        },
        defaultColumns: ['srn_number', 'status', 'reference_challan_number', 'reference_circle_code', 'reference_cluster_code', 'item_count', 'created_at'],
        filterDefs: {
          status: { column: 'srn.status', type: 'enum' },
          circle_id: { column: 'i.circle_id', type: 'number' },
          cluster_id: { column: 'i.cluster_id', type: 'number' },
          created_from: { column: 'srn.created_at', type: 'date_from' },
          created_to: { column: 'srn.created_at', type: 'date_to' },
          search: { column: 'search', type: 'search_srn' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' },
        groupBy: 'srn.id, i.challan_number, tc.name, cl.name, tc.code, cl.code'
      },
      'inventory.srn_lines': {
        baseQuery: `
          FROM store_return_notes srn
          LEFT JOIN store_return_items sri ON sri.srn_id = srn.id
          LEFT JOIN inventory_issues i ON i.id = srn.reference_challan_id
          LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
          LEFT JOIN clusters cl ON cl.id = i.cluster_id
          LEFT JOIN items it ON it.id = sri.item_id
        `,
        allowedColumns: {
          srn_number: 'srn.srn_number',
          status: 'srn.status',
          reference_challan_number: 'i.challan_number AS reference_challan_number',
          reference_circle_code: 'COALESCE(tc.code, tc.name) AS reference_circle_code',
          reference_cluster_code: 'COALESCE(cl.code, cl.name) AS reference_cluster_code',
          created_at: 'srn.created_at',
          received_at: 'srn.received_at',
          challan_line_id: 'sri.challan_line_id',
          item_id: 'sri.item_id',
          item_code: 'it.item_code',
          item_name: 'it.name AS item_name',
          item_description: 'it.description',
          manufacturer: 'it.manufacturer',
          unit_of_measure: 'it.unit_of_measure',
          quantity_returned: 'sri.quantity_returned',
          quantity_accepted: 'sri.quantity_accepted',
          quantity_rejected: 'sri.quantity_rejected',
          condition: 'sri.condition',
          remarks: 'sri.remarks'
        },
        defaultColumns: [
          'srn_number',
          'status',
          'reference_challan_number',
          'reference_circle_code',
          'reference_cluster_code',
          'challan_line_id',
          'item_code',
          'item_name',
          'quantity_returned',
          'quantity_accepted',
          'quantity_rejected',
          'condition',
          'created_at'
        ],
        filterDefs: {
          status: { column: 'srn.status', type: 'enum' },
          circle_id: { column: 'i.circle_id', type: 'number' },
          cluster_id: { column: 'i.cluster_id', type: 'number' },
          created_from: { column: 'srn.created_at', type: 'date_from' },
          created_to: { column: 'srn.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      },
      'inventory.stock_movements': {
        baseQuery: `
          FROM inventory_transactions t
          LEFT JOIN items it ON it.id = t.item_id
          LEFT JOIN warehouses w ON w.id = t.warehouse_id
          LEFT JOIN bins b ON b.id = t.bin_id
          LEFT JOIN goods_receipts gr ON t.reference_type = 'GRN' AND t.reference_id = gr.id
          LEFT JOIN store_return_items sri ON t.reference_type = 'SRN' AND t.reference_id = sri.id
          LEFT JOIN store_return_notes srn ON sri.srn_id = srn.id
          LEFT JOIN inventory_issue_lines ill ON t.reference_type IN ('ISSUE', 'DC', 'DELIVERY_CHALLAN') AND t.reference_id = ill.id
          LEFT JOIN inventory_issues iss ON t.reference_type IN ('ISSUE', 'DC', 'DELIVERY_CHALLAN') AND (t.reference_id = iss.id OR iss.id = ill.issue_id)
          LEFT JOIN inventory_adjustment_lines al ON t.reference_type = 'ADJUSTMENT' AND t.reference_id = al.id
          LEFT JOIN inventory_adjustments adj ON t.reference_type = 'ADJUSTMENT' AND (t.reference_id = adj.id OR adj.id = al.adjustment_id)
          LEFT JOIN inventory_transfers tr ON t.reference_type = 'TRANSFER' AND t.reference_id = tr.id
          LEFT JOIN stock_counts sc ON t.reference_type = 'STOCK_COUNT' AND t.reference_id = sc.id
        `,
        allowedColumns: {
          transaction_id: 't.id AS transaction_id',
          created_at: 't.created_at',
          item_id: 't.item_id',
          item_code: 'it.item_code',
          item_name: 'it.name AS item_name',
          warehouse_id: 't.warehouse_id',
          warehouse_name: 'w.name AS warehouse_name',
          bin_id: 't.bin_id',
          bin_code: 'b.bin_code',
          bin_type: 'b.bin_type',
          transaction_type: 't.transaction_type',
          quantity: 't.quantity',
          unit_cost: 't.unit_cost',
          total_cost: 't.total_cost',
          reference_type: 't.reference_type',
          reference_id: 't.reference_id',
          reference_number: `
            CASE 
              WHEN t.reference_type = 'GRN' THEN gr.grn_number
              WHEN t.reference_type = 'SRN' THEN srn.srn_number
              WHEN t.reference_type IN ('ISSUE', 'DC', 'DELIVERY_CHALLAN') THEN iss.challan_number
              WHEN t.reference_type = 'TRANSFER' THEN tr.challan_number
              WHEN t.reference_type = 'ADJUSTMENT' THEN adj.adjustment_number
              WHEN t.reference_type = 'STOCK_COUNT' THEN sc.count_number
              ELSE NULL
            END AS reference_number
          `,
          reference_entity_id: `
            CASE 
              WHEN t.reference_type = 'GRN' THEN gr.id
              WHEN t.reference_type = 'SRN' THEN srn.id
              WHEN t.reference_type IN ('ISSUE', 'DC', 'DELIVERY_CHALLAN') THEN iss.id
              WHEN t.reference_type = 'TRANSFER' THEN tr.id
              WHEN t.reference_type = 'ADJUSTMENT' THEN adj.id
              WHEN t.reference_type = 'STOCK_COUNT' THEN sc.id
              ELSE t.reference_id
            END AS reference_entity_id
          `
        },
        defaultColumns: [
          'created_at',
          'item_code',
          'item_name',
          'warehouse_name',
          'bin_code',
          'transaction_type',
          'quantity',
          'unit_cost',
          'total_cost',
          'reference_type',
          'reference_number'
        ],
        filterDefs: {
          item_id: { column: 't.item_id', type: 'number' },
          warehouse_id: { column: 't.warehouse_id', type: 'number' },
          bin_id: { column: 't.bin_id', type: 'number' },
          transaction_type: { column: 't.transaction_type', type: 'enum' },
          created_from: { column: 't.created_at', type: 'date_from' },
          created_to: { column: 't.created_at', type: 'date_to' }
        },
        defaultSort: { column: 'created_at', direction: 'DESC' }
      }
    };
  }

  getReportDefinition(type) {
    const def = this.reportTypes[type];
    if (!def) {
      throw new Error(`Unknown report type: ${type}`);
    }
    return def;
  }

  /**
   * Run a report and return rows for JSON preview.
   * options: { report_type, columns?, filters?, sort?, page?, limit? }
   */
  async runReport(options = {}, user) {
    const { report_type } = options;
    if (!report_type) throw new Error('report_type is required');

    const def = this.getReportDefinition(report_type);
    const selectedCols = this.#resolveColumns(def, options.columns);
    const { whereSql, params } = this.#buildWhere(def, options.filters || {});

    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.max(1, Math.min(200, Number(options.limit || 50)));
    const offset = (page - 1) * limit;

    const orderBy = this.#buildOrderBy(def, options.sort, selectedCols);

    const selectSql = `SELECT ${selectedCols.join(', ')} ${def.baseQuery} ${whereSql} ${def.groupBy ? `GROUP BY ${def.groupBy}` : ''} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const countSql = `SELECT COUNT(*)::int AS total FROM (${`SELECT ${selectedCols.join(', ')} ${def.baseQuery} ${whereSql} ${def.groupBy ? `GROUP BY ${def.groupBy}` : ''}`} ) sub`;

    const rowsPromise = query(selectSql, [...params, limit, offset]);
    const countPromise = query(countSql, params);

    const [rowsRes, countRes] = await Promise.all([rowsPromise, countPromise]);
    const total = countRes.rows[0]?.total || 0;

    return {
      rows: rowsRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Run a report in CSV mode (non-paginated, with a hard row cap).
   */
  async exportCsv(options = {}, user) {
    const { report_type } = options;
    if (!report_type) throw new Error('report_type is required');

    const def = this.getReportDefinition(report_type);
    const selectedCols = this.#resolveColumns(def, options.columns);
    const { whereSql, params } = this.#buildWhere(def, options.filters || {});
    const orderBy = this.#buildOrderBy(def, options.sort, selectedCols);

    const limit = Math.max(1, Math.min(10000, Number(options.limit || 5000)));

    const sql = `SELECT ${selectedCols.join(', ')} ${def.baseQuery} ${whereSql} ${def.groupBy ? `GROUP BY ${def.groupBy}` : ''} ${orderBy} LIMIT $${params.length + 1}`;
    const res = await query(sql, [...params, limit]);
    return res.rows;
  }

  #resolveColumns(def, requested) {
    const base = Array.isArray(requested) && requested.length > 0 ? requested : def.defaultColumns;
    const cols = [];
    for (const key of base) {
      const expr = def.allowedColumns[key];
      if (expr) cols.push(expr);
    }
    if (cols.length === 0) {
      throw new Error('No valid columns selected for this report');
    }
    return cols;
  }

  #buildWhere(def, filters) {
    const clauses = [];
    const params = [];
    let idx = 1;

    for (const [key, value] of Object.entries(filters || {})) {
      if (value === null || value === undefined || value === '') continue;
      const fdef = def.filterDefs?.[key];
      if (!fdef) continue;
      switch (fdef.type) {
        case 'enum':
        case 'number':
          clauses.push(`${fdef.column} = $${idx}`);
          params.push(fdef.type === 'number' ? Number(value) : String(value));
          idx += 1;
          break;
        case 'date_from':
          clauses.push(`${fdef.column} >= $${idx}`);
          params.push(new Date(value));
          idx += 1;
          break;
        case 'date_to':
          clauses.push(`${fdef.column} <= $${idx}`);
          params.push(new Date(value));
          idx += 1;
          break;
        case 'search':
          // special search patterns per report
          if (def === this.reportTypes['inventory.issue_summary']) {
            const like = `%${value}%`;
            clauses.push(`(i.issue_number ILIKE $${idx} OR i.challan_number ILIKE $${idx + 1} OR i.site_name ILIKE $${idx + 2})`);
            params.push(like, like, like);
            idx += 3;
          } else if (def === this.reportTypes['procurement.grn_summary']) {
            const like = `%${value}%`;
            clauses.push(`(
              grn.grn_number ILIKE $${idx}
              OR po.po_number ILIKE $${idx + 1}
              OR po.title ILIKE $${idx + 2}
              OR s.name ILIKE $${idx + 3}
            )`);
            params.push(like, like, like, like);
            idx += 4;
          } else if (def === this.reportTypes['inventory.transfer_summary']) {
            const like = `%${value}%`;
            clauses.push(`(
              tr.transfer_number ILIKE $${idx}
              OR tr.challan_number ILIKE $${idx + 1}
              OR fw.name ILIKE $${idx + 2}
              OR tw.name ILIKE $${idx + 3}
            )`);
            params.push(like, like, like, like);
            idx += 4;
          } else if (def === this.reportTypes['inventory.adjustment_summary']) {
            const like = `%${value}%`;
            clauses.push(`(a.adjustment_number ILIKE $${idx})`);
            params.push(like);
            idx += 1;
          } else if (def === this.reportTypes['inventory.srn_summary']) {
            const like = `%${value}%`;
            clauses.push(`(srn.srn_number ILIKE $${idx} OR i.challan_number ILIKE $${idx + 1})`);
            params.push(like, like);
            idx += 2;
          }
          break;
        default:
          break;
      }
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return { whereSql, params };
  }

  #buildOrderBy(def, sort, selectedCols) {
    const allowedKeys = Object.keys(def.allowedColumns);
    const sortKey = sort?.column && allowedKeys.includes(sort.column) ? sort.column : def.defaultSort?.column;
    if (!sortKey) return '';
    const dir = (sort?.direction || def.defaultSort?.direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const expr = def.allowedColumns[sortKey] || sortKey;
    // expr may be "alias AS name" – we need to order by alias if present
    const aliasMatch = expr.match(/\s+AS\s+([a-zA-Z0-9_]+)$/i);
    const orderExpr = aliasMatch ? aliasMatch[1] : expr;
    return `ORDER BY ${orderExpr} ${dir}`;
  }
}

export default new ReportService();


