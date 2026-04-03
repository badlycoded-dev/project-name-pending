FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Remove dev-only files
RUN rm -f .env

EXPOSE 5050

ENV NODE_ENV=production

CMD ["node", "index.js"]