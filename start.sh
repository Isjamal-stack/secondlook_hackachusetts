#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "SecondLook: http://localhost:3000/?demo=integrated"
echo "Serving the dashboard and explanation API together. Press Ctrl+C to stop."
exec python3 server/server.py
