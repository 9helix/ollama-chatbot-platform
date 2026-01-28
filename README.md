# Ollama Chatbot Platform

### Simple instructions to start the app (preferably on any Linux distribution).

The following commands should be typed in terminal:

1. `mkdir -p .ollama es_data nginx-logs logs`
2. `docker compose up -d --build`

Since Ollama models won't be downloaded automatically, they should be downloaded after running the app and executing. This is simply done by the following command in terminal:

- `docker exec -it ollama ollama pull [FULL MODEL NAME]`

---

To shut down all containers and delete all data:

- `docker compose down -v`

---

To access frontend, copy-paste **http://localhost:8090/** into URL bar.