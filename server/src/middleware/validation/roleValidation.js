import { body, param, query } from 'express-validator';

// Create role validation
export const createRoleValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Role name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9_\s]+$/)
    .withMessage('Role name can only contain letters, numbers, underscores, and spaces')
    .custom((value) => {
      // Convert to lowercase for system name
      return value.toLowerCase().replace(/\s+/g, '_');
    }),
  
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s&.-]+$/)
    .withMessage('Display name can only contain letters, numbers, spaces, and common punctuation'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('departmentId')
    .isInt({ min: 1 })
    .withMessage('Department ID must be a positive integer'),
  
  body('roleLevel')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Role level must be between 1 and 5'),
  
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      if (permissions.length > 0) {
        for (const permission of permissions) {
          // Validate permission structure
          if (!permission.featureId || !Number.isInteger(permission.featureId) || permission.featureId < 1) {
            throw new Error('Each permission must have a valid featureId');
          }
          
          if (!Array.isArray(permission.permissions)) {
            throw new Error('Each permission must have a permissions array');
          }
          
          if (permission.dataScope && !['own', 'department', 'all'].includes(permission.dataScope)) {
            throw new Error('Data scope must be one of: own, department, all');
          }
          
          // Validate boolean fields
          if (permission.canApprove !== undefined && typeof permission.canApprove !== 'boolean') {
            throw new Error('canApprove must be a boolean');
          }
          
          if (permission.canExport !== undefined && typeof permission.canExport !== 'boolean') {
            throw new Error('canExport must be a boolean');
          }
          
          if (permission.canBulkAction !== undefined && typeof permission.canBulkAction !== 'boolean') {
            throw new Error('canBulkAction must be a boolean');
          }
        }
      }
      return true;
    })
];

// Update role validation
export const updateRoleValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Role ID must be a positive integer'),
  
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s&.-]+$/)
    .withMessage('Display name can only contain letters, numbers, spaces, and common punctuation'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean value'),
  
  body('roleLevel')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Role level must be between 1 and 5'),
  
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      if (permissions && permissions.length > 0) {
        for (const permission of permissions) {
          // Validate permission structure
          if (!permission.featureId || !Number.isInteger(permission.featureId) || permission.featureId < 1) {
            throw new Error('Each permission must have a valid featureId');
          }
          
          if (!Array.isArray(permission.permissions)) {
            throw new Error('Each permission must have a permissions array');
          }
          
          if (permission.dataScope && !['own', 'department', 'all'].includes(permission.dataScope)) {
            throw new Error('Data scope must be one of: own, department, all');
          }
          
          // Validate boolean fields
          if (permission.canApprove !== undefined && typeof permission.canApprove !== 'boolean') {
            throw new Error('canApprove must be a boolean');
          }
          
          if (permission.canExport !== undefined && typeof permission.canExport !== 'boolean') {
            throw new Error('canExport must be a boolean');
          }
          
          if (permission.canBulkAction !== undefined && typeof permission.canBulkAction !== 'boolean') {
            throw new Error('canBulkAction must be a boolean');
          }
        }
      }
      return true;
    })
];

// Duplicate role validation
export const duplicateRoleValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Role ID must be a positive integer'),
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Role name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9_\s]+$/)
    .withMessage('Role name can only contain letters, numbers, underscores, and spaces'),
  
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s&.-]+$/)
    .withMessage('Display name can only contain letters, numbers, spaces, and common punctuation'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
];

// Role ID parameter validation
export const roleIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Role ID must be a positive integer')
];

// Department ID parameter validation
export const departmentIdValidation = [
  param('departmentId')
    .isInt({ min: 1 })
    .withMessage('Department ID must be a positive integer')
];

// Query parameter validation for role filtering
export const roleQueryValidation = [
  query('departmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Department ID must be a positive integer')
];
