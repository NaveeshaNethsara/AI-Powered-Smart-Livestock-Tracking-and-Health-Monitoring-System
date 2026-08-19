FROM node:20-slim

# Install Python 3 and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node package files and install production packages
COPY package*.json ./
RUN npm install --omit=dev

# Install Python ML requirements (CPU PyTorch to keep memory and size minimal andm)
RUN pip3 install --no-cache-dir \
    numpy==1.26.4 \
    scikit-learn==1.3.2 \
    joblib \
    Pillow \
    requests \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch \
    torchvision

# Copy backend code, ML models, and utility scripts
COPY backend ./backend
COPY "ML Models" "./ML Models"
COPY src/utils ./src/utils

# Render assigns PORT dynamically via environment variable
EXPOSE 5000

# Start Express Server
CMD ["node", "backend/server.js"]
