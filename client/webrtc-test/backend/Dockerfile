FROM node:18-alpine

WORKDIR /app

# Копируем package.json и устанавливаем зависимости (socket.io, express, cors)
COPY package*.json ./
RUN npm install

# Копируем сам код сервера
COPY . .

# Открываем порт 5001
EXPOSE 5001

# Запускаем сервер
CMD ["node", "server.js"]