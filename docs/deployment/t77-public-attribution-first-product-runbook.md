# T77 上线 Runbook｜公开页归因 → 注册自动绑定 → 首只上传奖励

更新时间：2026-03-12

## 1. 目标

本次上线收口 3 件事：
- 公开页访问 first-touch 归因
- 注册/登录后的自动绑定
- invitee 首次创建 `product` 后双方各 +7 天会员

## 2. 配置项

API：
- `REFERRAL_REWARD_MODE=FIRST_PRODUCT_CREATE`
- `REFERRAL_FIRST_PRODUCT_REFERRER_DAYS=7`
- `REFERRAL_FIRST_PRODUCT_INVITEE_DAYS=7`
- `REFERRAL_ATTRIBUTION_TTL_DAYS=30`
- `REFERRAL_AUTO_BIND_PUBLIC_ENABLED=true`
- `PUBLIC_VERIFY_BASE_URL=https://<public-web-domain>`
- `WEB_PUBLIC_BASE_URL=https://<public-web-domain>`

Web：
- `NEXT_PUBLIC_PUBLIC_APP_ORIGIN=https://<public-web-domain>`
- `NEXT_PUBLIC_REFERRAL_ATTRIBUTION_TTL_DAYS=30`

## 3. 发布顺序

1. 执行 DB migration
   - `pnpm --filter @eggturtle/api prisma:deploy`
2. 发布 API
   - 自动绑定接口 `POST /referrals/bind-from-attribution`
   - 产品创建返回 `referralReward`
   - 奖励模式切换为 `FIRST_PRODUCT_CREATE`
3. 发布 Web
   - 公开页归因采集
   - 注册/登录消费归因
   - 产品创建成功奖励提示
   - 邀请中心文案/状态更新
4. 做生产域名烟测
5. 灰度或全量

## 4. DB 变更

- `referral_bindings.source_meta`
- `referral_rewards.trigger_key`（唯一）
- `referral_rewards.trigger_meta`
- `ReferralRewardTriggerType.FIRST_PRODUCT_CREATE`

## 5. 验收步骤

### 5.1 公开页归因
- 使用新设备或无痕窗口打开：
  - 海报二维码
  - 详情页二维码
  - 证书二维码
- 确认都能直接进入公开页面，且域名不是 `localhost`、不是相对路径

### 5.2 自动绑定
- 从公开页进入后注册新账号
- 登录后检查：
  - `referral_bindings` 已生成
  - `source = public_page_auto`
  - `source_meta` 含 `fromUrl / pageType / entrySource / tenantSlug|shareToken|verifyId`

### 5.3 首只上传奖励
- 用被邀请账号首次创建 `product`
- 检查：
  - `/products` 返回体含 `referralReward`
  - `referral_rewards.trigger_key = first_product_create:<inviteeUserId>`
  - 双方订阅到期时间均顺延 7 天
  - 邀请中心状态 = `reward_awarded`
- 再创建第二个 `product`，确认不重复发奖

## 6. 回滚方案

- 优先配置回滚：
  - `REFERRAL_REWARD_MODE=PAID_ORDER`
  - `REFERRAL_AUTO_BIND_PUBLIC_ENABLED=false`
- Web 可独立回滚到上一版；不会破坏已写入的历史绑定/奖励记录
- 本次 migration 仅新增字段和枚举，不需要删除历史数据

## 7. 风险点

- `PUBLIC_VERIFY_BASE_URL` 错配会导致证书二维码不可扫或落到内网地址
- invitee 历史脏数据可能影响“首只上传”定义
- 若未来公开路由结构变化，需要同步更新公开页归因解析逻辑

## 8. 建议上线后观察

- API 日志：`/referrals/bind-from-attribution` 的 `reason` 分布
- DB：`referral_bindings.source = public_page_auto` 的增长趋势
- 产品创建成功后 `referralReward` 返回比例
- 二维码扫码来源 `src=poster` 与 `src=certificate` 的归因占比
