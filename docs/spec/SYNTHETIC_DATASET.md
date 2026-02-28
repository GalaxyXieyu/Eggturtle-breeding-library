# 合成数据集规格

## 1. 目的

该数据集用于生成确定性、偏 UX 的合成与异常记录，服务本地与 CI 验证。

主要目标：
- 覆盖描述字段边界（超长文本、空字符串）
- 覆盖图片边界（无图、多图）
- 验证租户作用域唯一性
- 生成精选产品与公开分享记录
- 通过回读校验跨租户隔离

## 2. 种子脚本

路径：
- `scripts/seed/synthetic_dataset.ts`

安全默认值：
- 默认 dry-run（不写入）
- 写入必须传 `--confirm`
- 当 `DATABASE_URL` 呈现生产特征时拒绝执行
- 生产覆盖必须显式传 `--i-know-what-im-doing`

确定性与幂等：
- 租户 slug、产品 code 均固定
- 产品 upsert 键：`(tenantId, code)`
- 精选 upsert 键：`(tenantId, productId)`
- 分享 upsert 键：`(tenantId, productId)`
- share token 由 `tenantSlug + code` 确定性生成
- 合成图片 key 确定性：`synthetic/<normalized-code>/<index>`

## 3. 默认租户

主租户：
- slug：`ux-sandbox`
- name：`UX Sandbox`

镜像租户（隔离校验）：
- slug：`ux-sandbox-shadow`
- name：`UX Sandbox Shadow`

所有者账号（两个租户共用/upsert）：
- `synthetic.owner@ux-sandbox.local`

## 4. 数据内容

主租户（`ux-sandbox`）产品：
- `SYN-LONG-DESC-001`
  - 超长描述
  - 1 张图
  - 置为精选
- `SYN-EMPTY-DESC-001`
  - 空描述 `""`
  - 1 张图
  - 含公开分享
- `SYN-NO-IMAGE-001`
  - 无图片记录
- `SYN-MULTI-IMAGE-001`
  - 多图（确定性顺序，首图主图）
  - 置为精选
  - 含公开分享
- `SYN-COMMON-001`
  - 镜像租户也会写入同 code（允许）
  - 1 张图
  - 含公开分享
- `SYN-COLLIDE-001`
  - 近碰撞基准 code

计划中的近碰撞变体（预期跳过）：
- `syn collide 001`
- `SYN_COLLIDE_001`

镜像租户（`ux-sandbox-shadow`）产品：
- `SYN-COMMON-001`（与主租户同 code，按设计允许）

## 5. 近碰撞策略

脚本标准化规则：
- 全部转小写
- 去除非字母数字字符

示例：
- `SYN-COLLIDE-001`
- `syn collide 001`
- `SYN_COLLIDE_001`

以上会标准化为同一键，按近碰撞处理。

行为：
- 计划中的近碰撞变体直接跳过
- 若现有数据已存在冲突标准化键，则候选记录跳过并写日志

## 6. 跨租户隔离回读校验

在 `--confirm` 后，脚本必须校验：
- `SYN-COMMON-001` 在主租户存在且仅 1 条
- `SYN-COMMON-001` 在镜像租户存在且仅 1 条
- `featured_products.tenant_id` 与关联 `products.tenant_id` 一致
- `public_shares.tenant_id` 与关联 `products.tenant_id` 一致

任一校验失败即退出并返回错误码。

## 7. 常用命令

先执行 dry-run：

```bash
ts-node scripts/seed/synthetic_dataset.ts
```

写入合成数据：

```bash
ts-node scripts/seed/synthetic_dataset.ts --confirm
```

写入并清理重复/陈旧合成图片 key：

```bash
ts-node scripts/seed/synthetic_dataset.ts --confirm --dedupe
```

覆盖默认参数：

```bash
ts-node scripts/seed/synthetic_dataset.ts \
  --confirm \
  --tenant-slug ux-sandbox \
  --tenant-name "UX Sandbox" \
  --mirror-tenant-slug ux-sandbox-shadow \
  --mirror-tenant-name "UX Sandbox Shadow" \
  --owner-email synthetic.owner@ux-sandbox.local
```

生产覆盖（高风险，仅显式开启）：

```bash
ts-node scripts/seed/synthetic_dataset.ts --confirm --i-know-what-im-doing
```
