# T80 今晚会员链路 QA 交接

## 结论

- 已补 super-admin 后台入口：`/dashboard/tenants/[tenantId]` 新增“生成升级激活码”表单，可直接给当前租户生成兑换码。
- 已补本地便捷脚本：新增 `pnpm api-tests:subscription`，用于单独跑会员/激活码/套餐限制链路。
- 已补测试提示：后台把 `maxShares` 明确标成“产品上限（maxShares）”，避免今晚把它误测成分享次数限制。

## 今晚建议测试顺序

1. 用 super-admin 登录后台，打开目标租户详情页：`/dashboard/tenants/<tenantId>`。
2. 在“生成升级激活码”区域选择目标套餐（今晚建议 `PRO`）、有效天数（建议 `30`）、可兑换次数（建议 `1`），点击“生成激活码”。
3. 复制激活码，切到该租户 owner 账号，在租户前台订阅页 `/app/<tenantSlug>/subscription` 兑换。
4. 兑换后继续用 owner/tenant 账号验证套餐生效、升级后额度变化、图片/存储/产品数量限制。

## 本地接口回归命令

```bash
# 会员链路最小冒烟（需本地 API 已启动，且开启 dev code 登录）
pnpm api-tests:subscription -- --confirm-writes \
  --super-admin-email <super-admin-email> \
  --email <tenant-owner-email> \
  --tenant-id <tenant-id> \
  --tenant-slug <tenant-slug>
```

## 备注

- 若今晚环境还是旧版后台，UI 不会出现新入口；此时可直接使用上面的 `api-tests:subscription` 或现有 `/admin/subscription-activation-codes` API 先测。
- 本次未做发布动作；要从后台 UI 点测，需要带上本提交重新构建/发版对应 admin 前端。
