# Lead Strategy: Use a slim base and install exactly what we need
FROM node:20-slim

# Install FFmpeg and basic tools
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy transcode logic
COPY index.js ./

# Start the Node logic
CMD [ "node", "index.js" ]
