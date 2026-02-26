# Sealos Mode B (DevBox / App Launchpad) Checklist

## Goal

Use Sealos platform-native release and deploy flow with minimum manual YAML work.

## One-time setup

1. Open Sealos workspace for `ns-lmgpb9nc`.
2. Create app `turtle_album` (or reuse existing app).
3. Set image source to Docker Hub repo `galaxyxieyu/turtle_album`.
4. Set image tag policy to `latest` for simple continuous deployment.
5. Configure container port `80` and service port `80`.

## Domain setup

1. In app network settings, enable public access.
2. Bind custom domain.
3. Add DNS record to Sealos ingress target.
4. Verify HTTPS certificate is issued.

## Release flow

1. Keep GitHub Actions build enabled (produces Docker image).
2. In Sealos app, choose auto-update or manual rollout when `latest` changes.
3. Verify health endpoint `/health` after each release.

## Validation

1. Open app URL and backend docs `/docs`.
2. Check pod status and recent logs.
3. Confirm billing view shows resource usage for this app.

## Pitfalls

1. Ensure `KUBE_CONFIG` points to the target workspace namespace, otherwise deployment lands in a wrong account scope.
2. Keep Docker Hub image repo in Sealos workload aligned with GitHub Actions `IMAGE_NAME` to avoid stale image confusion.
3. If workload is not created yet, rollout-only pipelines fail; bootstrap Deployment first.
4. Rotate tokens immediately if exposed in chat logs or terminals.
5. For private test dependencies, set `GH_TOKEN`, or checkout steps may fail in CI.
6. If PodSecurity warnings appear, add explicit `securityContext` before platform policies become stricter.
