import { Navigate, Route, Routes } from 'react-router-dom';
import PermissionGate from '../components/routing/PermissionGate';
import ProcurementLayout from '../components/layout/ProcurementLayout';
import { ProcurementFeatureRedirect, ProcurementModuleRedirect } from '../components/routing/ProcurementRedirects';
import RequisitionManagementPage from '../pages/procurement/RequisitionManagementPage';
import RequisitionCreatePage from '../pages/procurement/RequisitionCreatePage';
import RequisitionDetailsPage from '../pages/procurement/RequisitionDetailsPage';
import RequisitionEditPage from '../pages/procurement/RequisitionEditPage';
import ApprovalTasksPage from '../pages/procurement/ApprovalTasksPage';
import PurchaseOrderManagementPage from '../pages/procurement/PurchaseOrderManagementPage';
import PurchaseOrderCreatePage from '../pages/procurement/PurchaseOrderCreatePage';
import PurchaseOrderSelectPR from '../pages/procurement/PurchaseOrderSelectPR';
import PurchaseOrderGenerateFromPR from '../pages/procurement/PurchaseOrderGenerateFromPR';
import POApprovalTasksPage from '../pages/procurement/POApprovalTasksPage';
import PurchaseOrderDetailsPage from '../pages/procurement/PurchaseOrderDetailsPage';
import PurchaseOrderEditPage from '../pages/procurement/PurchaseOrderEditPage';
import SupplierManagementPage from '../pages/procurement/SupplierManagementPage';
import PriceListManagementPage from '../pages/procurement/PriceListManagementPage';
import GoodsReceiptListPage from '../pages/procurement/GoodsReceiptListPage';
import GoodsReceiptCreatePage from '../pages/procurement/GoodsReceiptCreatePage';
import GoodsReceiptDetailsPage from '../pages/procurement/GoodsReceiptDetailsPage';
import GoodsReceiptEditPage from '../pages/procurement/GoodsReceiptEditPage';
import GRNApprovalTasksPage from '../pages/procurement/GRNApprovalTasksPage';
import RfqManagementPage from '../pages/procurement/RfqManagementPage';
import RfqDetailsPage from '../pages/procurement/RfqDetailsPage';
import SupplierInvoiceListPage from '../pages/procurement/SupplierInvoiceListPage';
import StoreReturnListPage from '../pages/procurement/StoreReturnListPage';

export default function ProcurementRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProcurementModuleRedirect />} />

      <Route element={<ProcurementLayout />}>
        <Route path="pr" element={<ProcurementFeatureRedirect featureId="pr" />} />
        <Route path="po" element={<ProcurementFeatureRedirect featureId="po" />} />
        <Route path="rfq" element={<ProcurementFeatureRedirect featureId="rfq" />} />
        <Route path="grn" element={<ProcurementFeatureRedirect featureId="grn" />} />
        <Route path="invoice" element={<ProcurementFeatureRedirect featureId="invoice" />} />
        <Route path="returns" element={<ProcurementFeatureRedirect featureId="returns" />} />
        <Route path="supplier" element={<ProcurementFeatureRedirect featureId="supplier" />} />

        <Route
          path="pr/requisition-list"
          element={
            <PermissionGate permission="procurement.purchase_requisition.read" deniedMessage="Cannot view requisitions.">
              <RequisitionManagementPage />
            </PermissionGate>
          }
        />
        <Route
          path="pr/create-requisition"
          element={
            <PermissionGate permission="procurement.purchase_requisition.create" deniedMessage="Cannot create requisitions.">
              <RequisitionCreatePage />
            </PermissionGate>
          }
        />
        <Route
          path="pr/requisition-details/:id"
          element={
            <PermissionGate permission="procurement.purchase_requisition.read">
              <RequisitionDetailsPage />
            </PermissionGate>
          }
        />
        <Route
          path="pr/requisition-edit/:id"
          element={
            <PermissionGate permission="procurement.purchase_requisition.update">
              <RequisitionEditPage />
            </PermissionGate>
          }
        />
        <Route
          path="pr/approval-tasks"
          element={
            <PermissionGate permission="procurement.purchase_requisition.approve">
              <ApprovalTasksPage />
            </PermissionGate>
          }
        />

        <Route
          path="po/po-list"
          element={
            <PermissionGate permission="procurement.purchase_order.read">
              <PurchaseOrderManagementPage />
            </PermissionGate>
          }
        />
        <Route
          path="po/create-po"
          element={
            <PermissionGate permission="procurement.purchase_order.create">
              <PurchaseOrderCreatePage />
            </PermissionGate>
          }
        />
        <Route
          path="po/generate-from-pr"
          element={
            <PermissionGate permission="procurement.purchase_order.create">
              <PurchaseOrderSelectPR />
            </PermissionGate>
          }
        />
        <Route
          path="po/generate-from-pr/:id"
          element={
            <PermissionGate permission="procurement.purchase_order.create">
              <PurchaseOrderGenerateFromPR />
            </PermissionGate>
          }
        />
        <Route
          path="po/approval-tasks"
          element={
            <PermissionGate permission="procurement.purchase_order.approve">
              <POApprovalTasksPage />
            </PermissionGate>
          }
        />
        <Route
          path="po/po-details/:id"
          element={
            <PermissionGate permission="procurement.purchase_order.read">
              <PurchaseOrderDetailsPage />
            </PermissionGate>
          }
        />
        <Route
          path="po/po-edit/:id"
          element={
            <PermissionGate permission="procurement.purchase_order.update">
              <PurchaseOrderEditPage />
            </PermissionGate>
          }
        />

        <Route
          path="rfq/rfq-list"
          element={
            <PermissionGate permission="procurement.request_quotation.read">
              <RfqManagementPage />
            </PermissionGate>
          }
        />
        <Route
          path="rfq/rfq-details/:id"
          element={
            <PermissionGate permission="procurement.request_quotation.read">
              <RfqDetailsPage />
            </PermissionGate>
          }
        />

        <Route
          path="grn/grn-list"
          element={
            <PermissionGate permission="procurement.goods_receipt.read">
              <GoodsReceiptListPage />
            </PermissionGate>
          }
        />
        <Route
          path="grn/create-grn"
          element={
            <PermissionGate permission="procurement.goods_receipt.create">
              <GoodsReceiptCreatePage />
            </PermissionGate>
          }
        />
        <Route
          path="grn/grn-details/:id"
          element={
            <PermissionGate permission="procurement.goods_receipt.read">
              <GoodsReceiptDetailsPage />
            </PermissionGate>
          }
        />
        <Route
          path="grn/grn-edit/:id"
          element={
            <PermissionGate permission="procurement.goods_receipt.update">
              <GoodsReceiptEditPage />
            </PermissionGate>
          }
        />
        <Route
          path="grn/approval-tasks"
          element={
            <PermissionGate permission="procurement.goods_receipt.approve">
              <GRNApprovalTasksPage />
            </PermissionGate>
          }
        />

        <Route
          path="invoice/invoice-list"
          element={
            <PermissionGate permission="procurement.supplier_invoice.read">
              <SupplierInvoiceListPage />
            </PermissionGate>
          }
        />
        <Route
          path="returns/srn-list"
          element={
            <PermissionGate permission="procurement.store_return_note.read">
              <StoreReturnListPage />
            </PermissionGate>
          }
        />

        <Route
          path="supplier/supplier-management"
          element={
            <PermissionGate permission="procurement.supplier_management.read">
              <SupplierManagementPage />
            </PermissionGate>
          }
        />
        <Route path="supplier/supplier-coverage" element={<Navigate to="/procurement/supplier/supplier-management" replace />} />
        <Route
          path="supplier/price-lists"
          element={
            <PermissionGate permission="procurement.price_list.read">
              <PriceListManagementPage />
            </PermissionGate>
          }
        />
      </Route>

      <Route path="*" element={<ProcurementModuleRedirect />} />
    </Routes>
  );
}
