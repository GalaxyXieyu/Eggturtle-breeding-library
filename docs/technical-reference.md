# technical-reference

## 版本口径

本仓库长期并存两套系统：

- Legacy：`frontend/ + backend/`（FastAPI + SQLAlchemy）
- SaaS：`apps/web + apps/admin + apps/api`（Next + Nest + Prisma）

证据：`README.md:3`, `apps/api/src/app.module.ts:17`, `backend/app/main.py:30`。

补充：Legacy 当前定位为“参考代码”，已新增参考入口 `legacy/README.md`，后续再做目录收纳迁移。

## 术语统一建议

- `product`：统一业务实体名（包含当前蛋龟场景与未来扩展场景）
- `breeders`：历史路由命名（兼容保留），语义统一映射到 product
- `series`：系列标签
- `tenant`：租户隔离边界

Legacy 兼容口径：允许 `Product` 承载历史 breeders 语义，文档统一写 `product`，仅在接口名处保留 `breeders`。

证据：`backend/app/models/models.py:37`, `backend/app/api/routers/breeders.py:24`。

## 兼容策略（MUST/SHOULD/MAY）

- MUST：涉及多租户 API 的页面先做 tenant 切换（`/auth/switch-tenant`）
- MUST：后台管理页通过 BFF 代理处理会话（`/api/auth/*` + `/api/proxy/*`）
- MUST：Legacy 的 refresh 能力作为鉴权必需项保留（后端已补齐 `POST /api/auth/refresh`）
- SHOULD：新文档优先引用 `apps/*` 实现，Legacy 仅作参考
- MAY：短期保留 Legacy 路由说明用于迁移对照

证据：`apps/web/lib/tenant-session.ts:11`, `apps/admin/lib/api-client.ts:9`, `frontend/src/services/authService.ts:8`, `backend/app/api/routers/auth.py:24`。
