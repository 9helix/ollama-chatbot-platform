docker compose down -v #shuts down all containers and deletes all data
docker compose up -d --build #rebuilds backend and starts all containers
docker logs backend1 -f #monitors backend logs
docker logs backend2 -f