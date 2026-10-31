FROM node:18.20.8-alpine

WORKDIR /app

# Install build dependencies for sqlite3, the sqlite CLI (used by backup.sh)
# and dcron for automated backups
RUN apk add --no-cache python3 make g++ curl dcron sqlite

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY index.html ./
COPY server.js ./
COPY telegram.js ./
COPY themes.js ./
COPY mcp-server.js ./
COPY highfishapidblogo.png ./
COPY backup.sh ./

# Create data and backup directories
RUN mkdir -p /data /backup

# Make backup script executable
RUN chmod +x /app/backup.sh

# Add crontab for daily backup at 02:00
RUN echo "0 2 * * * /app/backup.sh >> /var/log/cron.log 2>&1" > /etc/crontabs/root

# Ensure non-root user owns project and data directories
RUN chown -R node:node /app /data /backup

# Expose ports
EXPOSE 3000 3001

# Health check using curl (increased start period for Docker rebuild)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start application (disable cron for stability)
CMD node server.js
