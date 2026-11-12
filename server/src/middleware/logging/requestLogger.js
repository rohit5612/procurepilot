/**
 * Request logging middleware
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  if (process.env.NODE_ENV === 'development') {
    console.log(`${req.method} ${req.path} - ${req.ip}`);
  }

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    }
    
    originalEnd.apply(this, args);
  };

  next();
};
