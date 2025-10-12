## Summary Service

A microservice that exposes data summaries aggregated from other microservices. Models mirroring upstream services will be defined here as needed.

### Getting Started

1. Copy env file:
   - Create a `.env` based on the keys below: `NODE_ENV`, `PORT`, `MONGODB_URI`, `LOG_LEVEL`.
2. Install deps:
   ```bash
   npm install
   ```
3. Run in dev:
   ```bash
   npm run dev
   ```
4. Health checks:
   - `GET /health/live`
   - `GET /health/ready`
5. Summary API:
   - `GET /api/v1/summary/:entityType/:entityId`

### Project Structure

```
src/
  app.js                 # Express app
  server.js              # HTTP server and bootstrap
  config/
    env.js               # Env loader and config
    database.js          # Mongo connection
  controllers/
    summary.controller.js
  routes/
    health.routes.js
    summary.routes.js
  services/
    summary.service.js
  middlewares/
    index.js             # requestId, notFound, error
  models/
    index.js             # placeholder for Mongoose models
  utils/
    logger.js            # minimal structured logger
```

### Notes

- Keep in mind schemas from other services will be recreated here to support summary generation.
- Replace the sample summary logic with real aggregation from MongoDB or downstream APIs as they become available.


