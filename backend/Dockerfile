FROM node:lts-alpine3.22

WORKDIR /app


COPY package.json package-lock.json ./

RUN npm install

COPY . .

# Make the entrypoint script executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]

#https://blog.appsignal.com/2021/10/19/how-to-dockerize-an-existing-nodejs-application.html