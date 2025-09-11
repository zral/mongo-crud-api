#!/bin/sh

# Default API URL if not provided
API_URL=${REACT_APP_API_URL:-"http://localhost:30080"}

echo "Configuring frontend with API URL: $API_URL"

# Create runtime config file
cat > /app/build/config.js << EOF
window.RUNTIME_CONFIG = {
  API_BASE_URL: '$API_URL'
};
EOF

# Start the application
exec "$@"
