FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build && mkdir -p /app/uploads

EXPOSE 8082

CMD ["node", "dist/main.js"]
