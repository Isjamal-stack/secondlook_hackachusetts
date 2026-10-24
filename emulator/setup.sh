#!/bin/bash

# ELM327 Emulator Setup Script
# This script installs and configures the ELM327 emulator for development/testing

echo "🚗 ELM327 Emulator Setup"
echo "========================"
echo ""

# Check Python version
echo "Checking Python version..."
python3 --version

if [ $? -ne 0 ]; then
    echo "❌ Error: Python 3 is not installed"
    echo "Please install Python 3.6 or higher"
    exit 1
fi

echo ""
echo "Installing ELM327-emulator package..."
python3 -m pip install --upgrade pip
python3 -m pip install ELM327-emulator

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to install ELM327-emulator"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the emulator, run:"
echo "  python3 start-emulator.py"
echo ""
echo "The emulator will listen on TCP port 35000"
echo "and simulate a Toyota Auris Hybrid vehicle."
