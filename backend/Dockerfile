FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV DATA_DIR=/data
ENV PORT=9000

RUN mkdir -p /data/users

EXPOSE 9000

CMD ["node", "dist/index.js"]
