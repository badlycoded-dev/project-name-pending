FROM node:18 AS build

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

ARG REACT_APP_API_URL=http://localhost:4040/api
ARG REACT_APP_RTC_URL=http://localhost:5050
ARG REACT_APP_WEBRTC_URL=http://localhost:5001
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_RTC_URL=$REACT_APP_RTC_URL
ENV REACT_APP_WEBRTC_URL=$REACT_APP_WEBRTC_URL

RUN npm run build 

FROM nginx:stable-alpine

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]