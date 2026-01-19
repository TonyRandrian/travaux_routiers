# Development stage avec hot-reload
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# React dev server avec hot-reload
CMD ["npm", "start"]