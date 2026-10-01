# auth-service

Independent **authentication microservice** — Node.js / Express — backed by its
own dedicated **PostgreSQL** database. It is a standalone repository; it only
shares a Docker network with the other services.

## Endpoints

| Method | Path      | Description                                             |
| ------ | --------- | ------------------------------------------------------- |
| GET    | `/`       | Queries the DB and returns a success payload            |
| GET    | `/health` | Liveness check (no DB dependency)                       |

Example success response:

```json
{ "service": "auth", "status": "success", "message": "Auth API is Live", "db": "connected", "users": 3 }
```

## Run locally

This service attaches to a shared external Docker network so the frontend (a
separate repo) can reach it by name.

```bash
# once, if it doesn't already exist:
docker network create microservices-net

docker-compose up -d --build
curl http://localhost:3000/        # direct test
```

The frontend reaches it at `http://auth-service:3000` over `microservices-net`.

## Configuration (env vars)

| Variable      | Default    |
| ------------- | ---------- |
| `PORT`        | `3000`     |
| `DB_HOST`     | `auth-db`  |
| `DB_PORT`     | `5432`     |
| `DB_USER`     | `auth`     |
| `DB_PASSWORD` | `authpass` |
| `DB_NAME`     | `authdb`   |
