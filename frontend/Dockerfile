# Use Node image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (optimizes cache)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the Vite port
EXPOSE 5173

# Start the app with --host to expose it to the Docker network
CMD ["npm", "run", "dev", "--", "--host"]