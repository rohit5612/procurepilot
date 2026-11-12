import express from 'express';
import { 
  importPriceList, 
  getImportLogs, 
  getImportItemLogs, 
  getSuppliersForImport,
  previewPriceListFile,
  upload 
} from '../../controllers/procurement/priceListImportController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get suppliers for price list import
router.get('/price-list-import/suppliers', getSuppliersForImport);

// Preview price list file before import
router.post('/price-list-import/preview', upload.single('file'), previewPriceListFile);

// Import price list from file
router.post('/price-list-import/import', upload.single('file'), importPriceList);

// Get import logs for a price list
router.get('/price-list-import/logs/:price_list_id', getImportLogs);

// Get detailed import item logs
router.get('/price-list-import/logs/items/:import_log_id', getImportItemLogs);

export default router;
