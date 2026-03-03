# Use Node.js LTS Alpine image for smaller size
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
# These layers are cached until package*.json changes
COPY package*.json ./
RUN npm ci

# Copy source code (unused when volume-mounted in docker-compose)
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server with host 0.0.0.0 for Docker networking
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
