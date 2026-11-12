export function respondProcurementError(res, error, fallbackMessage = 'Request failed') {
  if (error?.code === 'POLICY_VIOLATION' || error?.name === 'PolicyViolationError') {
    return res.status(403).json({
      success: false,
      code: 'POLICY_VIOLATION',
      message: error.message || 'Procurement policy violation',
      violations: error.violations || []
    });
  }
  if (error?.code === 'SUPPLIER_NOT_QUALIFIED' || error?.name === 'SupplierNotQualifiedError') {
    return res.status(403).json({
      success: false,
      code: 'SUPPLIER_NOT_QUALIFIED',
      message: error.message || 'Supplier is not qualified'
    });
  }
  const status = /not found/i.test(error?.message || '') ? 404 : 400;
  return res.status(status).json({
    success: false,
    message: error?.message || fallbackMessage
  });
}
