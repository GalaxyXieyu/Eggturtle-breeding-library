# 交互测试场景数据规格

## 1. 目的

定义稳定、可复现的 UX 测试场景与数据集要求，用于：

- 登录与租户切换流程
- 产品列表与详情行为
- 精选产品行为
- 分享链接行为
- 角色权限行为（owner/editor/viewer）

该数据规格用于本地与 CI 冒烟验证，也用于人工验收。

## 2. 数据范围

### 2.1 来源与目标

- 来源：TurtleAlbum sqlite（`products`、`product_images`、`users`）
- 目标：Eggturtle Postgres（Prisma）
  - `users`、`tenants`、`tenant_members`、`products`、`product_images`
- 迁移租户 slug：`turtle-album`
- 默认 owner 账号：`admin@turtlealbum.local`（`OWNER`）

### 2.2 基线数量（最小值）

- `users`：目标租户上下文至少 3 个
  - owner：`admin@turtlealbum.local`
  - editor：`editor@turtlealbum.local`
  - viewer：`viewer@turtlealbum.local`
- `products`：至少 12 条迁移产品
- `product_images`：至少 12 张（采样产品至少 1 张）
- `featured_products`：至少 2 条（可在 smoke 中创建）
- `public_shares`：至少 1 条（可在 smoke 中创建）

## 3. 标准场景集

### S1：登录与初始租户状态

目标：
- 用户可完成验证码登录
- 新用户初始没有选中租户

数据要求：
- 本地开发开启验证码：`AUTH_DEV_CODE_ENABLED=true`
- 至少存在一个租户 `turtle-album` 与 owner 成员

断言：
- `POST /auth/request-code` 在本地返回 `devCode`
- `POST /auth/verify-code` 返回 `accessToken`
- 未切租户时访问租户接口应命中 `TENANT_NOT_SELECTED`

边界：
- 验证码格式非法（非 6 位）
- 验证码过期或已消费

### S2：租户切换与租户作用域 token

目标：
- 用户切到 `turtle-album`，拿到租户作用域 token

数据要求：
- 用户是目标租户成员
- 租户 slug 稳定且唯一（`turtle-album`）

断言：
- `POST /auth/switch-tenant` 成功
- 后续 `/products`、`/featured-products`、`/shares` 均受租户作用域约束

边界：
- 切换到不存在租户 -> `not found`
- 切换到非成员租户 -> `forbidden`

### S3：产品列表 UX（默认态）

目标：
- 产品列表能展示真实风格迁移数据

数据要求：
- `description` 既有非空也有空值
- `code` 在租户内唯一
- 至少存在一个带连字符+数字后缀的 code（便于排序与可读性检验）

断言：
- `/products` 返回非空
- 分页元数据有效（`page`、`pageSize`、`total`、`totalPages`）
- 每条产品含稳定 `id`、`tenantId`、`code`

边界：
- 导入重复 code 时应 upsert，不得新增重复记录
- 源数据空白 code 行应在导入时跳过

### S4：产品图片顺序与主图

目标：
- UI 主图与图片顺序正确

数据要求：
- 测试产品每个至少 1 张图
- `sort_order` 尽量保持源顺序
- 有主图标记时应映射主图
- 占位图回填后，`ProductImage.key` 应统一为受控 key：`${tenantId}/products/${productId}/...`
- 为保证可重复 smoke，每个产品按 code 轮询映射到 5 个本地占位图文件

断言：
- 第一张展示图应为 `isMain=true`
- 列表顺序按 `sortOrder` 升序
- `GET /products/:pid/images/:iid/content` 对受控 key 返回字节流
- 历史非受控 key 允许回退到 `url` 跳转

边界：
- dry-run 不得修改数据库与对象存储
- `--confirm` 可安全重跑，且每产品仍保持单图片记录约束
- 每行图片 key 必须唯一，避免误删联动

### S5：精选产品 UX

目标：
- 精选列表可新增、查询、重排

数据要求：
- 同租户至少 2 个产品

断言：
- `POST /featured-products` 可新增
- `GET /featured-products` 返回租户内列表
- `PUT /featured-products/reorder` 生效
- `GET /products/featured?tenantSlug=turtle-album` 返回公开精选

边界：
- 同产品重复加精选不应生成重复记录
- 跨租户 product id 必须拒绝

### S6：公开分享 UX

目标：
- 分享创建与公开读取全链路可用

数据要求：
- 目标租户至少 1 个带图片产品
- `PUBLIC_SHARE_SIGNING_SECRET` 已配置

断言：
- `POST /shares` 返回 share id、share token、入口 URL
- `GET /s/:shareToken` 返回带签名参数的 `302`
- `GET /shares/:shareId/public?...` 返回产品公开载荷

边界：
- 签名非法 -> `unauthorized`
- 签名过期 -> `unauthorized`
- share token 不存在 -> `not found`

### S7：角色权限 UX

目标：
- owner/editor/viewer 行为符合预期

数据要求：
- 租户成员包含：
  - `OWNER`：可管理租户与核心数据
  - `EDITOR`：可写产品与精选
  - `VIEWER`：受保护资源只读

断言：
- viewer 不能执行需要 editor+ 的写操作
- editor 可以创建产品与精选
- owner 具备完整租户管理能力

边界：
- 有效 token 但非租户成员，切换或租户操作应返回 `forbidden`

## 4. 迁移与种子规则

### 4.1 导入幂等性

导入脚本必须可重复执行：
- 产品 upsert 主键：`(tenantId, code)`
- 图片 upsert 查找键：`(tenantId, productId, key)`
- 重复运行应更新已有记录，不产生无控制重复

### 4.2 安全默认值

所有写脚本默认 dry-run，必须显式确认：
- 默认：dry-run
- 写入：`--confirm`

生产保护：
- 当 `DATABASE_URL` 呈现生产特征时脚本拒绝执行
- 仅允许通过 `--i-know-what-im-doing` 强制覆盖

## 5. 本阶段非目标

- 不迁移 legacy 用户密码
- 不直接迁移 legacy 鉴权凭据

## 6. 验证清单

1. `scripts/migrate/turtle_album_export.py` 默认 dry-run 可执行
2. `scripts/migrate/turtle_album_export.py --confirm` 输出 JSON 且不泄漏密钥
3. `scripts/seed/import_turtle_album.ts` 默认 dry-run 可执行
4. `scripts/seed/import_turtle_album.ts --confirm` 可创建/更新租户数据
5. `scripts/migrate/seed_placeholder_images_to_storage.ts` 默认 dry-run 可执行
6. `scripts/migrate/seed_placeholder_images_to_storage.ts --confirm` 可上传确定性占位图并改写 `product_images.key/contentType/url`
7. `scripts/seed/bootstrap_admin.ts --confirm` 可创建 editor/viewer 会员关系
8. `pnpm api-tests -- --confirm-writes --only auth,products,featured,shares` 通过
9. `pnpm -r lint && pnpm -r build` 通过
