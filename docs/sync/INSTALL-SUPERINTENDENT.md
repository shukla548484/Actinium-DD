# Superintendent installation

Same stack as ship — use `FLEET_ORIGIN_NODE=superintendent` in `fleet.local.env`.

```bash
docker compose -f docker-compose.fleet.yml up -d
cp docs/sync/fleet.local.env.example fleet.local.env
# Set FLEET_ORIGIN_NODE=superintendent
bash scripts/bucardo/superintendent-init.sh
npm run fleet:dev
```

Bucardo dbgroup names use `drydock_superintendent_to_relay` / `drydock_superintendent_from_relay`.
