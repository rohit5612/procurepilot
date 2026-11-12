/**
 * Global error handler middleware
 */
import errorLogService from '../../services/system/errorLogService.js';

export const errorHandler = async (err, req, res, next) => {
  console.error('Error:', err);

  // Default error response
  let error = {
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error.message = 'Validation failed';
    error.details = err.details;
    return res.status(400).json(error);
  }

  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    return res.status(401).json(error);
  }

  if (err.code === '23505') { // PostgreSQL unique constraint violation
    error.message = 'Duplicate entry found';
    return res.status(409).json(error);
  }

  if (err.code === '23503') { // PostgreSQL foreign key constraint violation
    error.message = 'Referenced record not found';
    return res.status(400).json(error);
  }

  if (err.code === '23502') { // PostgreSQL not-null constraint violation
    error.message = 'Required field missing';
    return res.status(400).json(error);
  }

  // Rate limiting error
  if (err.statusCode === 429) {
    error.message = err.message || 'Too many requests';
    return res.status(429).json(error);
  }

  // CORS error
  if (err.message === 'Not allowed by CORS') {
    error.message = 'CORS policy violation';
    return res.status(403).json(error);
  }

  // Attempt to persist error log (non-blocking)
  try {
    await errorLogService.logError({
      error_level: (err.statusCode && err.statusCode < 500) ? 'warning' : 'error',
      error_type: err.name || 'application',
      error_message: err.message || 'Internal server error',
      error_stack: err.stack,
      module: (req.baseUrl || '').split('/')[2] || 'api',
      feature: (req.baseUrl || '').split('/')[3] || undefined,
      user_id: req.user?.id || null,
      username: req.user?.full_name || null,
      ip_address: req.ip,
      metadata: {
        method: req.method,
        path: req.originalUrl,
        query: req.query,
        body: req.body ? '[redacted]' : undefined
      }
    });
  } catch (_) {
    // ignore logging failures
  }

  // Default to 500 server error
  res.status(err.statusCode || 500).json(error);
};
