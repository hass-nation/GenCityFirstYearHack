# PC Pet on Snowpark Container Services

Build the planner with `npm ci` and `npm run build` from the repository root. Build the Linux image with `docker build --platform linux/amd64 -f deploy/snowflake/Dockerfile .`, then tag and push it to the image repository in `service.yaml`. Keep `.env` outside the image. The container uses its Snowflake-provided service token for Cortex.

Deploy `service.yaml` as one instance on the dedicated `PC_PET_WEB_CPU` pool. The service needs its 5 GiB mounted volume for the SQLite demo data and Flask session key. The hosted planner keeps the browser and Flask API on one origin.

The current ingress is [the hosted PC Pet demo](https://iaface-nuzremg-rn09570.snowflakecomputing.app/). If it changes, query it with `SHOW ENDPOINTS IN SERVICE PC_PET_DEMO.PUBLIC.PLANNER`.

Testers need Snowflake users in the same account. An administrator can grant the existing endpoint-only role with `GRANT ROLE PC_PET_TESTER TO USER <tester_user>`. The app and the Flask API share the same origin. Hosted messages arrive in the inbox directly, and the Windows overlay and foreground tracking remain part of the local demo.

After testing, suspend the service with `ALTER SERVICE PC_PET_DEMO.PUBLIC.PLANNER SUSPEND`. Snowflake does not support automatic service suspension for public endpoints on this account.
