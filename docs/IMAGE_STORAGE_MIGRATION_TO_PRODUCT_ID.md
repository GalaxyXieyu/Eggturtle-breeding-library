# TurtleAlbum 图片存储迁移：从 code 目录改为 product_id 目录（不保留兼容）

> 目标：图片与展示编号(code)彻底解耦。以后修改 `products.code` 不会影响图片。
> 
> 约束：**不保留兼容**。迁移完成后，系统只认 `images/<product_id>/...` 路径与 `/static/images/<product_id>/...` 静态文件。

## 1. 当前现状（问题根因）

- 容器环境：`UPLOAD_DIR=/data/images`，静态目录为 `/data`（FastAPI 挂载 `/static` -> `/data`）。
- 现有落盘目录：`/data/images/<products.code>/...`（含 `thumbnail/small/medium/large` 子目录）。
- DB 中 `product_images.url` 常见为：`images/<products.code>/<filename>.jpg`。

风险：一旦修改 `products.code`（大小写规范化/重命名/规则迭代），目录名与 DB url 前缀容易不一致，导致部分页面加载不到图片。

## 2. 迁移后的目标状态

- 新落盘目录：`/data/images/<products.id>/...`
- DB url：`images/<products.id>/<filename>.jpg`
- 前端展示：仍通过 `createImageUrl()` 将 `images/<id>/...` 映射为 `/static/images/<id>/...`。

## 3. 实施策略（无兼容的最安全顺序）

> 因为“不保留兼容”，迁移会导致旧版本服务在迁移窗口内无法正确加载图片。
> 
> 所以必须按顺序执行，并接受短暂停机（maintenance window）。

### 3.1 代码改造（先准备好，但不立刻切流量）

1) 后端：上传图片改为按 product_id 存储
- 修改 `save_product_images_optimized(files, product_code)` 的调用链：传入 `product.id`（或在函数内使用 id）
- 写入 DB 的 `url` 改为 `images/<product_id>/<filename>.jpg`

2) 后端：图片 URL 规范化只输出 id 路径
- 更新 `backend/app/api/utils.py` 对本地图片路径的规范化逻辑：
  - 只允许 `images/<id>/...` 与 `/static/images/<id>/...`（外链除外）
  - 不再特殊兼容 `images/<code>/...`（迁移完成后应不存在）

3) 增加迁移脚本（必须可在 k8s Job 中执行）
- 新增：`backend/scripts/migrate_images_to_product_id.py`
- 能力：
  - `--dry-run`：只输出将要改动的目录/DB url
  - `--apply`：执行目录迁移 + DB 更新

### 3.2 生产迁移（需要停机）

在 GitHub Actions deploy pipeline 中加入一个“图片迁移 Job”，并且按如下顺序执行：

1) scale down 业务 workload 到 0（确保旧版本不再提供服务）
- `kubectl scale deployment/<name> --replicas=0`
- wait 所有 pod 退出

2) 运行 DB schema 迁移（若本次有新增字段）
- 现有动作：`python scripts/db_migrate.py upgrade`

3) 运行图片迁移 Job（同一镜像、同一 /data PVC）
- 执行：`python scripts/migrate_images_to_product_id.py --apply`

4) 更新 workload 镜像并启动
- `kubectl set image ... :latest`
- `kubectl scale ... --replicas=1`
- `kubectl rollout status ...`

> 注意：如果先 set image 再迁移，或不先 scale down，就会出现新旧版本交替期间图片不可用。

## 4. 迁移脚本逻辑（设计）

对每条 `product_images` 记录：
1) 解析旧路径：
- 支持 `images/<code>/<file>`、`/static/images/<code>/<file>`、`static/images/<code>/<file>`
2) 查出该图片所属 product 的 `id` 与 `code`
3) 迁移目录：
- 若存在 `/data/images/<code>` 且 `/data/images/<id>` 不存在：执行目录重命名 `mv <code> <id>`
- 若两者都存在：报冲突并停止（需要人工处理）
4) 更新 DB：
- 将 `product_images.url` 更新为 `images/<id>/<file>`（保持 filename 不变）

注意：目录迁移应包含所有尺寸子目录（thumbnail/small/medium/large）。

## 5. 验收/检验步骤（必须逐条通过）

### 5.1 数据层
- 脚本 dry-run 输出的“将迁移数量”与实际 images 数量一致
- apply 后：
  - `product_images.url` 不再出现 `images/<code>/...`
  - `/data/images` 下目录名均为 UUID（产品 id）

### 5.2 接口层
- 抽样 20 个 breeder/product：
  - `GET /api/breeders/{id}` 返回的 `images[].url` 应为 `images/<uuid>/...` 或 `/static/images/<uuid>/...`
  - `curl -I https://<host>/static/images/<uuid>/<file>.jpg` 返回 200

### 5.3 页面层
- 移动端列表、详情页图片正常显示
- 管理后台创建/编辑上传新图，落盘目录为 `/data/images/<product_id>/...`

## 6. 回滚策略

不保留兼容的情况下，回滚依赖“迁移前备份”。

建议在 apply 前做：
- 备份 sqlite：复制 `/data/app.db`
- 备份 images 根目录：打 tar 或快照 `/data/images`

若需要回滚：
- 恢复备份 DB 与 images 目录
- 回滚镜像到旧版本

