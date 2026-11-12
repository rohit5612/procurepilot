import { body, param } from 'express-validator';

// Create department validation
export const createDepartmentValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Department name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9_\s]+$/)
    .withMessage('Department name can only contain letters, numbers, underscores, and spaces')
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
  
  body('departmentCode')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Department code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Department code can only contain uppercase letters, numbers, and underscores'),
  
  body('parentDepartmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Parent department ID must be a positive integer'),
  
  body('moduleIds')
    .optional()
    .isArray()
    .withMessage('Module IDs must be an array')
    .custom((moduleIds) => {
      if (moduleIds.length > 0) {
        const areValidIds = moduleIds.every(id => Number.isInteger(id) && id > 0);
        if (!areValidIds) {
          throw new Error('All module IDs must be positive integers');
        }
      }
      return true;
    })
];

// Update department validation
export const updateDepartmentValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Department ID must be a positive integer'),
  
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
  
  body('departmentCode')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Department code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Department code can only contain uppercase letters, numbers, and underscores'),
  
  body('parentDepartmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Parent department ID must be a positive integer'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean value')
];

// Assign modules validation
export const assignModulesValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Department ID must be a positive integer'),
  
  body('moduleIds')
    .isArray({ min: 0 })
    .withMessage('Module IDs must be an array')
    .custom((moduleIds) => {
      const areValidIds = moduleIds.every(id => Number.isInteger(id) && id > 0);
      if (!areValidIds) {
        throw new Error('All module IDs must be positive integers');
      }
      
      // Check for duplicates
      const uniqueIds = [...new Set(moduleIds)];
      if (uniqueIds.length !== moduleIds.length) {
        throw new Error('Duplicate module IDs are not allowed');
      }
      
      return true;
    })
];

// Department ID parameter validation
export const departmentIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Department ID must be a positive integer')
];
