# Base image
FROM node:18-alpine

# Install required build dependencies
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build NestJS application
RUN npm run build

# Expose port (adjust if needed)
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]