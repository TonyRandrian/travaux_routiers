FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# En dev, nodemon sera utilisé via docker-compose
CMD ["npm", "run", "dev"]