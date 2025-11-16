docker compose down -v
docker compose up -d --build
docker logs backend1 -f
docker logs backend2 -f