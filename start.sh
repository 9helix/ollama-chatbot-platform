docker compose down -v #shuts down all containers and deletes all data
docker compose up -d --build #rebuilds backend and starts all containers

curl http://localhost # test frontend

#monitors backend logs
docker logs backend1 -f
docker logs backend2 -f
# check frontend logs
docker logs frontend
