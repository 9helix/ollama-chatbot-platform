FROM node:lts-alpine3.22

WORKDIR /app


COPY package.json package-lock.json ./

RUN npm install

COPY . .

EXPOSE 4000

CMD ["node", "app.js"]

#https://blog.appsignal.com/2021/10/19/how-to-dockerize-an-existing-nodejs-application.html