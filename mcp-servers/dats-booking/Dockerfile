# DATS Booking MCP Server - Container Image
#
# Multi-stage build for minimal image size (~50MB)
# Designed for Azure Container Apps deployment
#
# Build: docker build -t dats-mcp .
# Run:   docker run -p 3000:3000 -e MCP_TRANSPORT=http dats-mcp

# ============= BUILD STAGE =============
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Prune devDependencies
RUN npm prune --production

# ============= PRODUCTION STAGE =============
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies and built code
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/build ./build
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Switch to non-root user
USER nodejs

# Environment configuration
ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose HTTP port
EXPOSE 3000

# Health check for Azure Container Apps
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "build/index.js"]
