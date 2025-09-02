const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    success: false,
    error: 'Internal Server Error',
    message: 'Something went wrong'
  };

  // MongoDB validation errors
  if (err.name === 'ValidationError') {
    error.error = 'Validation Error';
    error.message = Object.values(err.errors).map(e => e.message).join(', ');
    return res.status(400).json(error);
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    error.error = 'Duplicate Key Error';
    error.message = 'A document with this data already exists';
    return res.status(409).json(error);
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerError') {
    error.error = 'Database Connection Error';
    error.message = 'Unable to connect to database';
    return res.status(503).json(error);
  }

  // Custom application errors
  if (err.message) {
    error.message = err.message;
    
    // Determine status code based on error message
    if (err.message.includes('not found') || err.message.includes('does not exist')) {
      return res.status(404).json(error);
    }
    
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      return res.status(409).json(error);
    }
    
    if (err.message.includes('Invalid') || err.message.includes('required')) {
      return res.status(400).json(error);
    }
    
    if (err.message.includes('Unauthorized') || err.message.includes('permission')) {
      return res.status(401).json(error);
    }
  }

  // Log unexpected errors in production
  if (process.env.NODE_ENV === 'production') {
    console.error('Unexpected error:', err);
    error.message = 'An unexpected error occurred';
  } else {
    // In development, include stack trace
    error.stack = err.stack;
    error.message = err.message || error.message;
  }

  res.status(500).json(error);
};

module.exports = errorHandler;
