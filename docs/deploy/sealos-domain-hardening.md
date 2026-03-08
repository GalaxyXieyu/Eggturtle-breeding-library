# Sealos Domain Hardening (xuanyuku.cn)

适用目标：把公网访问统一到 `https://xuanyuku.cn`，并确保：

1. `https://xuanyuku.cn` 稳定可用  
2. `https://www.xuanyuku.cn` 永久重定向到主域  
3. `http://xuanyuku.cn` 永久重定向到 HTTPS  

## 1) 目标策略（建议）

- Canonical 域名：`xuanyuku.cn`（不带 `www`）
- `www` 仅保留为跳转入口，不承载业务
- 所有 HTTP 请求返回 `301` 到 HTTPS
- 证书 SAN 至少覆盖：`xuanyuku.cn`、`www.xuanyuku.cn`

## 2) Sealos / Kubernetes 配置要点

### 2.1 Ingress 与 TLS

- 为主域名配置 Ingress 规则（`host: xuanyuku.cn`）。
- 为 `www` 配置重定向规则（`host: www.xuanyuku.cn` -> `https://xuanyuku.cn$request_uri`）。
- TLS Secret 必须能同时覆盖两个 host（同一证书或两张证书均可）。

> 如果你使用 NGINX Ingress，常见注解如下（示例）：
>
> - `nginx.ingress.kubernetes.io/force-ssl-redirect: "true"`
> - `nginx.ingress.kubernetes.io/permanent-redirect: https://xuanyuku.cn$request_uri`
> - `nginx.ingress.kubernetes.io/permanent-redirect-code: "301"`

### 2.2 DNS

- `xuanyuku.cn` 与 `www.xuanyuku.cn` 应解析到正式公网入口（同一入口或同一 CDN）。
- 若解析在保留网段（例如 `198.18.0.0/15`），请向云厂商确认是否为其正式公网接入方案；否则应改回标准公网解析。

### 2.3 先查再改（kubectl）

```bash
# 查看 Ingress 和 host/tls
kubectl -n <namespace> get ingress
kubectl -n <namespace> get ingress <ingress-name> -o yaml

# 查看证书 Secret 是否存在
kubectl -n <namespace> get secret <tls-secret-name>
```

典型补丁（按你的资源名替换）：

```bash
# 1) 主入口强制 https（nginx ingress）
kubectl -n <namespace> annotate ingress <ingress-name> \
  nginx.ingress.kubernetes.io/force-ssl-redirect="true" \
  --overwrite

# 2) TLS 同时覆盖 apex + www
kubectl -n <namespace> patch ingress <ingress-name> --type=merge -p '{
  "spec": {
    "tls": [
      {
        "hosts": ["xuanyuku.cn", "www.xuanyuku.cn"],
        "secretName": "<tls-secret-name>"
      }
    ]
  }
}'
```

如果你采用“`www` 独立 Ingress 做 301 跳转”，可额外创建一个 `www` redirect ingress（`permanent-redirect` 指向 `https://xuanyuku.cn$request_uri`）。

## 3) 仓库内已加的自动闸门

`deploy.yml` 已加入发布后域名闸门脚本：

- 脚本：`scripts/deploy/domain_hardening_check.sh`
- 位置：`.github/workflows/deploy.yml` 的 `Domain hardening gate` 步骤

它会检查：

1. HTTPS 连通稳定率（默认 20 次，成功率阈值 95%）
2. `http://<主域>` 是否 `301` 到 `https://<主域>`
3. `https://<www>` 是否 `301` 到 `https://<主域>`
4. TLS SAN 是否覆盖主域和 `www`
5. DNS 是否落在保留网段（默认告警，可配置为失败）

可用 GitHub Variables 调整：

- `DOMAIN_CHECK_ENABLED`（默认 `true`）
- `PUBLIC_CANONICAL_HOST`（默认 `xuanyuku.cn`）
- `PUBLIC_ALT_HOST`（默认 `www.xuanyuku.cn`）
- `DOMAIN_CHECK_RETRIES`（默认 `20`）
- `DOMAIN_MIN_SUCCESS_RATE`（默认 `0.95`）
- `EXPECTED_REDIRECT_CODE`（默认 `301`）
- `FAIL_ON_RESERVED_DNS`（默认 `false`）

## 4) 本地手工验收命令

```bash
# 1) HTTPS 主域
curl -I -m 12 https://xuanyuku.cn

# 2) HTTP -> HTTPS
curl -I -m 12 http://xuanyuku.cn

# 3) www -> 主域
curl -I -m 12 https://www.xuanyuku.cn

# 4) DNS 观测
dig +short A xuanyuku.cn
dig +short A www.xuanyuku.cn
```

## 5) 微信风险页恢复建议

技术面修复完成后再提交恢复更高效：

1. 微信内风险页点“申请恢复访问”
2. 到腾讯网址安全中心补一次申诉，并附备案号/企业资质材料

- https://urlsec.qq.com/check.html
- https://urlsec.qq.com/complain.html
- https://urlsec.qq.com/eviltype.html
