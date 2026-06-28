-- Run on VPS relay PostgreSQL as superuser.
--   sudo -u postgres psql -d drydock_sync_relay < bucardo-relay-postgres-grants.sql
--
-- Replace role name per fleet node (ship / superintendent Bucardo user).

GRANT CONNECT ON DATABASE drydock_sync_relay TO bucardo_drydock_fleet;
GRANT CREATE ON DATABASE drydock_sync_relay TO bucardo_drydock_fleet;

GRANT USAGE ON SCHEMA public TO bucardo_drydock_fleet;
GRANT CREATE ON SCHEMA public TO bucardo_drydock_fleet;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER ON ALL TABLES IN SCHEMA public TO bucardo_drydock_fleet;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bucardo_drydock_fleet;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER ON TABLES TO bucardo_drydock_fleet;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO bucardo_drydock_fleet;

GRANT USAGE, CREATE ON SCHEMA bucardo TO bucardo_drydock_fleet;
GRANT ALL ON ALL TABLES IN SCHEMA bucardo TO bucardo_drydock_fleet;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bucardo TO bucardo_drydock_fleet;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bucardo TO bucardo_drydock_fleet;

ALTER ROLE bucardo_drydock_fleet WITH REPLICATION;
GRANT SET ON PARAMETER session_replication_role TO bucardo_drydock_fleet;
