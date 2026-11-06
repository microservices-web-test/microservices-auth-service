FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js app.js ./

ENV PORT=3000 NODE_ENV=production
EXPOSE 3000

# Run as the built-in non-root user.
USER node

CMD ["node", "server.js"]
