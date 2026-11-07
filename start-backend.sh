#!/bin/bash
set -e
# Start the Docling backend with MPS (Mac GPU) acceleration

cd "$(dirname "$0")/server"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    "${PYTHON:-python3}" -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies (this may take a few minutes on first run)..."
pip install -r requirements.txt

# Start the server
echo ""
echo "Starting Docling backend with MPS GPU acceleration..."
echo "API available at: http://localhost:8000"
echo "API docs at: http://localhost:8000/docs"
echo ""
python main.py
