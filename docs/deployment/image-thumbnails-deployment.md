# 图片缩略图功能部署指南

## 功能说明

### 缩略图存储位置
- **存储位置**：MinIO（S3 兼容存储），与原图在同一个 bucket
- **命名规则**：`原图key.mx{尺寸}.webp`
- **生成尺寸**：320px、640px、1200px（WebP 格式）

### 示例
```
原图：
  cmm4qi1r600015icbxj2y7f7u/products/xxx/1234567890-uuid.jpg

缩略图：
  cmm4qi1r600015icbxj2y7f7u/products/xxx/1234567890-uuid.mx320.webp
  cmm4qi1r600015icbxj2y7f7u/products/xxx/1234567890-uuid.mx640.webp
  cmm4qi1r600015icbxj2y7f7u/products/xxx/1234567890-uuid.mx1200.webp
```

## 部署步骤

### 1. 部署新代码

将以下文件部署到生产环境：
- `apps/api/src/images/image-variants.ts`（新增 640、1200 尺寸支持）
- `apps/api/src/products/products-images.service.ts`（新增 generateImageVariants 方法）
- `scripts/migrate/generate_image_variants.ts`（迁移脚本）
- `scripts/migrate/run-generate-variants-prod.sh`（生产环境运行脚本）

### 2. 重启 API 服务

```bash
# 根据你的部署方式重启服务
# 例如：
pm2 restart api
# 或
systemctl restart eggturtle-api
```

**部署后，所有新上传的图片会自动生成 3 个缩略图。**

### 3. 为现有图片生成缩略图

#### 方式 A：在生产服务器上运行（推荐）

```bash
# SSH 到生产服务器
ssh user@your-server

# 进入项目目录
cd /path/to/eggturtle-breeding-library

# 运行脚本（会先 dry-run 预览，然后询问是否执行）
bash scripts/migrate/run-generate-variants-prod.sh
```

#### 方式 B：本地运行（需要配置生产 MinIO 访问）

```bash
# 设置生产环境变量
export DATABASE_URL="postgresql://postgres:zm4gmrgr@test-db-postgresql.ns-lmgpb9nc.svc:5432/eggturtles?sslmode=disable"
export S3_ENDPOINT=http://8.166.129.45:34125
export S3_BUCKET=eggturtles
export S3_ACCESS_KEY_ID=minioadmin
export S3_SECRET_ACCESS_KEY=minioadmin123
export S3_FORCE_PATH_STYLE=true

# Dry-run 预览
npx tsx scripts/migrate/generate_image_variants.ts

# 执行实际操作
npx tsx scripts/migrate/generate_image_variants.ts --confirm
```

## 前端使用方式

### Web 端（已实现）

前端代码已经在使用 `withAuthenticatedImageMaxEdge()` 函数：

```typescript
// apps/web/app/app/[tenantSlug]/products/products-list-card.tsx
const imageUrl = withAuthenticatedImageMaxEdge(
  resolveAuthenticatedAssetUrl(item.coverImageUrl),
  320  // 使用 320px 缩略图
);
```

### API 访问

```
原图：
GET /products/{productId}/images/{imageId}/content

缩略图：
GET /products/{productId}/images/{imageId}/content?maxEdge=320
GET /products/{productId}/images/{imageId}/content?maxEdge=640
GET /products/{productId}/images/{imageId}/content?maxEdge=1200
```

## 验证

### 1. 验证新上传功能

```bash
# 上传一张图片后，检查 MinIO 中是否生成了 3 个缩略图
# 使用 MinIO 客户端或 Web UI 查看
```

### 2. 验证迁移结果

```bash
# 查看迁移报告
cat out/generate_image_variants-*.json | jq '.summary'
```

预期输出：
```json
{
  "totalImages": 301,
  "successCount": 149,
  "errorCount": 152,
  "totalVariantsGenerated": 447,
  "totalVariantsSkipped": 0
}
```

### 3. 验证访问

```bash
# 获取 token
TOKEN=$(curl -s -X POST http://your-api/auth/password-login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"password"}' | jq -r '.accessToken')

# 访问缩略图
curl -H "Authorization: Bearer $TOKEN" \
  "http://your-api/products/{productId}/images/{imageId}/content?maxEdge=320" \
  -o test-320.webp

# 检查文件大小（应该比原图小很多）
ls -lh test-320.webp
```

## 性能优化效果

- **320px 缩略图**：约为原图的 5-10%
- **640px 缩略图**：约为原图的 15-25%
- **1200px 缩略图**：约为原图的 30-50%

瀑布流页面使用 320px 缩略图，可以减少 **70-90%** 的带宽消耗。

## 注意事项

1. **外部 URL 图片**：如果图片 URL 不是托管在 MinIO 中（外部链接），无法生成缩略图
2. **存储空间**：每张原图会额外占用约 50-80% 的存储空间（3 个缩略图）
3. **迁移时间**：根据图片数量和大小，迁移可能需要几分钟到几十分钟
4. **幂等性**：脚本可以重复运行，已存在的缩略图会被跳过

## 回滚方案

如果需要回滚：

1. **删除缩略图**（可选）：
```bash
# 使用 MinIO 客户端删除所有 .mx*.webp 文件
mc rm --recursive --force myminio/eggturtles/**/*.mx*.webp
```

2. **回滚代码**：
```bash
git revert <commit-hash>
```

3. **重启服务**

## 问题排查

### 缩略图未生成

检查 API 日志：
```bash
# 查看是否有错误日志
tail -f /path/to/api/logs/error.log | grep "Failed to generate"
```

### 访问缩略图返回 404

1. 检查 MinIO 中是否存在缩略图文件
2. 检查 API 日志中的错误信息
3. 验证 S3 配置是否正确

### 迁移脚本失败

1. 检查数据库连接
2. 检查 MinIO 连接和权限
3. 查看 `out/` 目录中的报告文件，找到失败的原因
