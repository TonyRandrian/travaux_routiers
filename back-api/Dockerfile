FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Force installation of devDependencies for development
RUN npm install --include=dev

# Install nodemon globally as fallback
RUN npm install -g nodemon

COPY . .

EXPOSE 3000

# En dev, nodemon sera utilisé via docker-compose
CMD ["npm", "run", "dev"]