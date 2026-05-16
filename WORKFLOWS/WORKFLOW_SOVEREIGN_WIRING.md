# WORKFLOW_SOVEREIGN_WIRING
**Role:** Infrastructure health and Docker connectivity.
**Time:** 10:00 Asia/Kuala_Lumpur
**Status:** ACTIVE

## Objectives
1. **Heartbeat:** Check status of all 19 Docker containers.
2. **Network Check:** Verify Traefik routing and SSL cert status.
3. **Database Health:** Test connectivity to `postgres`, `redis`, and `qdrant`.
4. **Log Analysis:** Check for critical errors in `syslog` and `arifos-cron.log`.

## Constraints
- **F12 Resilience:** Graceful failure is configured and documented.
- **Physics Reality:** Ground all actions in current infrastructure constraints.
- **Sovereign Environment:** Ensure VPN/Wireguard state is secure.
