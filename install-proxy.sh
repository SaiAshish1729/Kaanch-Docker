#!/bin/bash

# === 1. Install Docker if not installed ===
if ! command -v docker &> /dev/null; then
  echo "🚀 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
else
  echo "✅ Docker already installed."
fi

# === 2. Install Docker Compose if not installed ===
if ! command -v docker-compose &> /dev/null; then
  echo "🚀 Installing Docker Compose..."
  sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" \
       -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
else
  echo "✅ Docker Compose already installed."
fi

# === 3. Clone your GitHub repo ===
echo "📦 Cloning Kaanch Proxy project..."
git clone https://github.com/SaiAshish1729/Kaanch-Docker.git
cd Kaanch-Docker

# === 4. Build and run the app ===
echo "🔧 Building and starting the Docker containers..."
docker-compose up --build -d

# === 5. Done ===
echo "✅ Setup complete. App should be running at: http://localhost:9000"
