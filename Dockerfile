FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir dist/storage
RUN apk add ghostscript
RUN apk add graphicsmagick
CMD ["node", "dist/index.js"]
