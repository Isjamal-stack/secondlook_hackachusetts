#!/bin/bash

# Start script for ELM327 Vehicle Insights Web App

echo "================================================"
echo "🚗 ELM327 Vehicle Insights"
echo "================================================"
echo ""
echo "Starting local web server..."
echo ""
echo "The application will be available at:"
echo "  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "================================================"
echo ""

# Start Python HTTP server
python3 -m http.server 8000
