# Execution Service

Service responsible for starting and tracking background executions (jobs, tasks, pipelines).

## Quick start

1. Copy env
```bash
cp env.example .env
```
2. Install and run
```bash
npm install
npm run dev
```

Health: `GET /health`
Base: `/api/execution`

## Environment
- `PORT` (default 3006)
- `MONGODB_URI`
- `JWT_SECRET`

## Docker
```bash
docker build -t execution-service .
docker run -p 3006:3006 --env-file .env execution-service
```

