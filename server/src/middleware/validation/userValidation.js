import { body, param, query, validationResult } from 'express-validator';

class UserValidation {
  /**
   * Validation rules for user assignment
   */
  validateUserAssignment() {
    return [
      body('userId')
        .isInt({ min: 1 })
        .withMessage('Valid user ID is required'),
      
      body('departmentId')
        .isInt({ min: 1 })
        .withMessage('Valid department ID is required'),
      
      body('roleId')
        .isInt({ min: 1 })
        .withMessage('Valid role ID is required'),
      
      body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes must not exceed 500 characters'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for user transfer
   */
  validateUserTransfer() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('Valid user ID is required'),
      
      body('departmentId')
        .isInt({ min: 1 })
        .withMessage('Valid department ID is required'),
      
      body('roleId')
        .isInt({ min: 1 })
        .withMessage('Valid role ID is required'),
      
      body('transferReason')
        .notEmpty()
        .withMessage('Transfer reason is required')
        .isLength({ min: 3, max: 200 })
        .withMessage('Transfer reason must be between 3 and 200 characters'),
      
      body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes must not exceed 500 characters'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for user unassignment
   */
  validateUserUnassignment() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('Valid user ID is required'),
      
      body('reason')
        .notEmpty()
        .withMessage('Unassignment reason is required')
        .isLength({ min: 3, max: 200 })
        .withMessage('Unassignment reason must be between 3 and 200 characters'),
      
      body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes must not exceed 500 characters'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for user approval
   */
  validateUserApproval() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('Valid user ID is required'),
      
      body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Approval notes must not exceed 500 characters'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for user rejection
   */
  validateUserRejection() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('Valid user ID is required'),
      
      body('reason')
        .notEmpty()
        .withMessage('Rejection reason is required')
        .isLength({ min: 5, max: 300 })
        .withMessage('Rejection reason must be between 5 and 300 characters'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for bulk user approval
   */
  validateBulkUserApproval() {
    return [
      body('userIds')
        .isArray({ max: 50 })
        .withMessage('User IDs must be an array (max 50 users)')
        .custom((userIds) => {
          if (userIds.length > 0) {
            const invalidIds = userIds.filter(id => !Number.isInteger(id) || id < 1);
            if (invalidIds.length > 0) {
              throw new Error('All user IDs must be positive integers');
            }
          }
          return true;
        }),
      
      body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Approval notes must not exceed 500 characters'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for bulk user assignment
   */
  validateBulkUserAssignment() {
    return [
      body('assignments')
        .isArray({ max: 25 })
        .withMessage('Assignments must be an array (max 25 assignments)')
        .custom((assignments) => {
          if (assignments.length > 0) {
            for (const assignment of assignments) {
              if (!Number.isInteger(assignment.userId) || assignment.userId < 1) {
                throw new Error('All user IDs must be positive integers');
              }
              if (!Number.isInteger(assignment.departmentId) || assignment.departmentId < 1) {
                throw new Error('All department IDs must be valid positive integers');
              }
              if (!Number.isInteger(assignment.roleId) || assignment.roleId < 1) {
                throw new Error('All role IDs must be valid positive integers');
              }
              if (assignment.notes && assignment.notes.length > 500) {
                throw new Error('Assignment notes must not exceed 500 characters');
              }
            }
          }
          return true;
        }),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for user search/filtering
   */
  validateUserSearch() {
    return [
      query('search')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Search term must not exceed 100 characters'),
      
      query('status')
        .optional()
        .isIn(['active', 'inactive', 'pending_approval', 'approved', 'rejected'])
        .withMessage('Invalid status value'),
      
      query('departmentId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Department ID must be a positive integer'),
      
      query('roleId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Role ID must be a positive integer'),
      
      query('isActive')
        .optional()
        .isIn(['true', 'false'])
        .withMessage('isActive must be true or false'),
      
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
      
      query('sortBy')
        .optional()
        .isIn(['created_at', 'first_name', 'last_name', 'email', 'status', 'last_login', 'department_name', 'role_name'])
        .withMessage('Invalid sort field'),
      
      query('sortOrder')
        .optional()
        .isIn(['ASC', 'DESC'])
        .withMessage('Sort order must be ASC or DESC'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for user profile update
   */
  validateUserProfileUpdate() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('Valid user ID is required'),
      
      body('first_name')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('First name must be between 1 and 50 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('First name contains invalid characters'),
      
      body('last_name')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('Last name must be between 1 and 50 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Last name contains invalid characters'),
      
      body('phone')
        .optional()
        .matches(/^[\+]?[1-9][\d]{0,15}$|^[\+]?[\d\s\-\(\)\.]{7,20}$/)
        .withMessage('Invalid phone number format - must be 7-20 characters with numbers, spaces, dashes, parentheses allowed'),
      
      body('employee_id')
        .optional()
        .isLength({ min: 1, max: 20 })
        .withMessage('Employee ID must be between 1 and 20 characters')
        .matches(/^[a-zA-Z0-9-_]+$/)
        .withMessage('Employee ID contains invalid characters'),
      
      body('profile_metadata')
        .optional()
        .isJSON()
        .withMessage('Profile metadata must be valid JSON'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for user deactivation
   */
  validateUserDeactivation() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('Valid user ID is required'),
      
      body('reason')
        .optional()
        .isLength({ max: 300 })
        .withMessage('Deactivation reason must not exceed 300 characters'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for getting user by ID
   */
  validateGetUserById() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('Valid user ID is required'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for assignment ID parameter
   */
  validateAssignmentId() {
    return [
      param('assignmentId')
        .isInt({ min: 1 })
        .withMessage('Valid assignment ID is required'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validation rules for department ID parameter
   */
  validateDepartmentId() {
    return [
      param('departmentId')
        .isInt({ min: 1 })
        .withMessage('Valid department ID is required'),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Helper method to validate UUID format
   */
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Handle validation errors middleware
   */
  handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors
      });
    }
    
    next();
  };
}

export default new UserValidation();
