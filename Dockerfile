FROM node:18-alpine

WORKDIR /app

# Install build dependencies for sqlite3
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY index.html ./
COPY server.js ./
COPY highfishapidblogo.png ./

# Create data directory for SQLite database
RUN mkdir -p /data

# Ensure non-root user owns project and data directories
# (node user is provided by the node:18-alpine base image)
RUN chown -R node:node /app /data

# Expose port
EXPOSE 3000

# Health check using curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Switch to non-root user
USER node

# Start application
CMD ["npm", "start"]
