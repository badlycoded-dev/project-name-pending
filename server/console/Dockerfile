FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Create log/storage directory
RUN mkdir -p storage/logs

EXPOSE 4040

CMD ["node", "index.js"]