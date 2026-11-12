import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import priceListImportService from '../../services/procurement/priceListImportService.js';
import priceListService from '../../services/procurement/priceListService.js';
import { query } from '../../database/connection.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/price_lists';
    // Create directory if it doesn't exist
    fs.mkdir(uploadDir, { recursive: true }).then(() => {
      cb(null, uploadDir);
    }).catch(err => {
      cb(err, null);
    });
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `price_list_${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * Upload and import price list from file
 */
export const importPriceList = async (req, res) => {
  try {
    const { supplier_id, price_list_name, description, currency } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!supplier_id || !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Supplier ID and file are required'
      });
    }

    // Validate supplier exists
    const supplierResult = await query(`
      SELECT id, name FROM suppliers WHERE id = $1 AND status = 'ACTIVE'
    `, [supplier_id]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found or inactive'
      });
    }

    const supplier = supplierResult.rows[0];

    // Import the price list
    const result = await priceListImportService.importPriceListFromFile(
      req.file.path,
      supplier_id,
      userId,
      {
        priceListName: price_list_name || `${supplier.name} Price List - ${new Date().toISOString().split('T')[0]}`,
        description: description || `Imported from ${req.file.originalname}`,
        currency: currency || 'INR'
      }
    );

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to clean up uploaded file:', cleanupError);
    }

    res.json({
      success: true,
      message: 'Price list imported successfully',
      data: {
        priceListId: result.priceListId,
        importLogId: result.importLogId,
        statistics: result.statistics
      }
    });

  } catch (error) {
    console.error('Price list import error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file after error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Price list import failed',
      details: error.message
    });
  }
};

/**
 * Get price list import logs
 */
export const getImportLogs = async (req, res) => {
  try {
    const { price_list_id } = req.params;
    const userId = req.user.id;

    // Check if user has permission to view this price list
    const priceListResult = await query(`
      SELECT id FROM price_lists WHERE id = $1
    `, [price_list_id]);

    if (priceListResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Price list not found'
      });
    }

    const importLogs = await priceListImportService.getImportLogs(price_list_id);

    res.json({
      success: true,
      data: importLogs
    });

  } catch (error) {
    console.error('Get import logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get import logs',
      details: error.message
    });
  }
};

/**
 * Get detailed import item logs
 */
export const getImportItemLogs = async (req, res) => {
  try {
    const { import_log_id } = req.params;
    const userId = req.user.id;

    // Check if user has permission to view this import log
    const importLogResult = await query(`
      SELECT pil.id FROM price_list_import_logs pil
      JOIN price_lists pl ON pil.price_list_id = pl.id
      WHERE pil.id = $1
    `, [import_log_id]);

    if (importLogResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Import log not found'
      });
    }

    const itemLogs = await priceListImportService.getImportItemLogs(import_log_id);

    res.json({
      success: true,
      data: itemLogs
    });

  } catch (error) {
    console.error('Get import item logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get import item logs',
      details: error.message
    });
  }
};

/**
 * Get suppliers for price list import
 */
export const getSuppliersForImport = async (req, res) => {
  try {
    const result = await query(`
      SELECT s.id, s.name, s.supplier_code, s.email, s.phone,
             COUNT(pl.id) as existing_price_lists
      FROM suppliers s
      LEFT JOIN price_lists pl ON s.id = pl.supplier_id
      WHERE s.status = 'ACTIVE'
      GROUP BY s.id, s.name, s.supplier_code, s.email, s.phone
      ORDER BY s.name
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suppliers',
      details: error.message
    });
  }
};

/**
 * Preview price list file before import
 */
export const previewPriceListFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'File is required for preview'
      });
    }

    // Parse CSV file for preview
    const csvData = await priceListImportService.parseCsvFile(req.file.path);
    
    // Get first 10 rows for preview
    const previewData = csvData.slice(0, 10);
    
    // Get column headers
    const headers = csvData.length > 0 ? Object.keys(csvData[0]) : [];

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to clean up uploaded file:', cleanupError);
    }

    res.json({
      success: true,
      data: {
        headers,
        previewRows: previewData,
        totalRows: csvData.length,
        supportedFormat: headers.some(h => 
          ['Part Number', 'Part Description', 'Basic Rate', 'GST Rate'].includes(h)
        )
      }
    });

  } catch (error) {
    console.error('Preview price list file error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file after error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to preview file',
      details: error.message
    });
  }
};

// Export multer middleware
export { upload };
