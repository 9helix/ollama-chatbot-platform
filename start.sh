docker compose down -v
docker compose up -d --build
docker logs ocp-backend -f