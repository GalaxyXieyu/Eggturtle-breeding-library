#!/bin/bash
# 生产环境图片缩略图生成脚本
# 使用方法：
#   1. 上传此脚本和 generate_image_variants.ts 到生产服务器
#   2. 在项目根目录运行：bash scripts/migrate/run-generate-variants-prod.sh

set -e

echo "=========================================="
echo "生产环境图片缩略图生成脚本"
echo "=========================================="
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "错误：请在项目根目录运行此脚本"
    exit 1
fi

# 检查环境变量文件
if [ ! -f "apps/api/.env" ]; then
    echo "错误：找不到 apps/api/.env 文件"
    exit 1
fi

# 加载环境变量
echo "加载环境变量..."
source apps/api/.env

# 检查必要的环境变量
if [ -z "$S3_ENDPOINT" ] || [ -z "$S3_BUCKET" ]; then
    echo "错误：缺少 S3 配置环境变量"
    echo "需要：S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY"
    exit 1
fi

echo "MinIO 配置："
echo "  Endpoint: $S3_ENDPOINT"
echo "  Bucket: $S3_BUCKET"
echo ""

# 询问是否继续
read -p "是否继续执行？这将为所有现有图片生成缩略图。(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 先执行 dry-run
echo ""
echo "=========================================="
echo "步骤 1: Dry-run 模式（预览）"
echo "=========================================="
npx tsx scripts/migrate/generate_image_variants.ts

echo ""
echo "=========================================="
echo "Dry-run 完成，查看上面的报告"
echo "=========================================="
echo ""

# 询问是否执行实际操作
read -p "是否执行实际的缩略图生成？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 执行实际操作
echo ""
echo "=========================================="
echo "步骤 2: 执行实际操作（--confirm）"
echo "=========================================="
npx tsx scripts/migrate/generate_image_variants.ts --confirm

echo ""
echo "=========================================="
echo "完成！"
echo "=========================================="
echo "请查看 out/ 目录中的报告文件"
