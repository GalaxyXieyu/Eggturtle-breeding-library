#!/usr/bin/env python3
"""
TurtleAlbum Production Data Query Script

用于查询生产环境的产品数据，分析数据质量，识别缺失字段。

Usage:
    python3 scripts/query_production.py --env prod --action list
    python3 scripts/query_production.py --env prod --action search --code CBF
    python3 scripts/query_production.py --env prod --action quality-report
"""

import requests
import json
import argparse
from typing import Optional, List, Dict, Any
from datetime import datetime


class TurtleAlbumAPI:
    """TurtleAlbum API 客户端"""

    ENVIRONMENTS = {
        "dev": "http://localhost:8000",
        "staging": "https://staging.turtlealbum.com",
        "prod": "https://turtlealbum.com"
    }

    def __init__(self, env: str, username: str, password: str):
        """
        初始化 API 客户端

        Args:
            env: 环境名称 (dev/staging/prod)
            username: 用户名
            password: 密码
        """
        if env not in self.ENVIRONMENTS:
            raise ValueError(f"Invalid environment: {env}. Must be one of {list(self.ENVIRONMENTS.keys())}")

        self.base_url = self.ENVIRONMENTS[env]
        self.env = env
        self.token = None
        self.login(username, password)

    def login(self, username: str, password: str):
        """登录并获取 token"""
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"username": username, "password": password},
                timeout=10
            )
            response.raise_for_status()
            self.token = response.json()["access_token"]
            print(f"✅ 登录成功 ({self.env})")
        except requests.exceptions.RequestException as e:
            print(f"❌ 登录失败: {e}")
            raise

    def get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def get_all_products(self, page: int = 1, page_size: int = 100) -> Dict[str, Any]:
        """获取所有产品"""
        try:
            response = requests.get(
                f"{self.base_url}/api/products",
                params={"page": page, "page_size": page_size},
                headers=self.get_headers(),
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ 获取产品列表失败: {e}")
            raise

    def get_product(self, product_id: str) -> Dict[str, Any]:
        """获取单个产品"""
        try:
            response = requests.get(
                f"{self.base_url}/api/products/{product_id}",
                headers=self.get_headers(),
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ 获取产品失败: {e}")
            raise

    def get_all_series(self) -> Dict[str, Any]:
        """获取所有系列"""
        try:
            response = requests.get(
                f"{self.base_url}/api/series",
                headers=self.get_headers(),
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ 获取系列列表失败: {e}")
            raise

    def get_filter_options(self) -> Dict[str, Any]:
        """获取筛选选项"""
        try:
            response = requests.get(
                f"{self.base_url}/api/products/filter-options",
                headers=self.get_headers(),
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ 获取筛选选项失败: {e}")
            raise

    def search_products(self, code: Optional[str] = None, name: Optional[str] = None) -> List[Dict[str, Any]]:
        """搜索产品"""
        products_data = self.get_all_products()
        results = []

        for product in products_data["products"]:
            if code and code.lower() in product["code"].lower():
                results.append(product)
            elif name and name.lower() in product["name"].lower():
                results.append(product)

        return results


class DataQualityAnalyzer:
    """数据质量分析器"""

    # 重要字段定义
    CRITICAL_FIELDS = ["code", "name", "price"]
    IMPORTANT_FIELDS = ["description", "series_id", "images"]
    OPTIONAL_FIELDS = [
        "cost_price", "has_sample",
        "in_stock", "popularity_score", "is_featured",
        "sire_code", "dam_code"
    ]

    @staticmethod
    def analyze_product(product: Dict[str, Any]) -> Dict[str, Any]:
        """
        分析单个产品的数据质量

        Returns:
            {
                "score": int (0-10),
                "level": str ("excellent" / "good" / "fair" / "poor"),
                "missing_fields": List[str],
                "warnings": List[str]
            }
        """
        score = 5  # 基础分（必填字段完整）
        missing_fields = []
        warnings = []

        # 检查重要字段
        if product.get("description"):
            score += 1
        else:
            missing_fields.append("description")
            warnings.append("缺少产品描述，影响 SEO 和用户理解")

        if product.get("images") and len(product["images"]) > 0:
            score += 1
            if len(product["images"]) >= 3:
                score += 1
        else:
            missing_fields.append("images")
            warnings.append("缺少产品图片，无法展示")

        if product.get("series_id"):
            score += 1
        else:
            missing_fields.append("series_id")
            warnings.append("未分配系列，影响分类和筛选")

        # 检查可选字段
        if product.get("cost_price") and product["cost_price"] > 0:
            score += 0.5

        if product.get("has_sample"):
            score += 0.5

        # 确定质量等级
        if score >= 9:
            level = "excellent"
        elif score >= 7:
            level = "good"
        elif score >= 5:
            level = "fair"
        else:
            level = "poor"

        return {
            "score": round(score, 1),
            "level": level,
            "missing_fields": missing_fields,
            "warnings": warnings
        }

    @staticmethod
    def generate_quality_report(products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        生成数据质量报告

        Returns:
            {
                "total_products": int,
                "average_score": float,
                "distribution": Dict[str, int],
                "top_missing_fields": List[Tuple[str, int]],
                "products_by_quality": Dict[str, List[Dict]]
            }
        """
        total_products = len(products)
        scores = []
        distribution = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
        missing_fields_count = {}
        products_by_quality = {"excellent": [], "good": [], "fair": [], "poor": []}

        for product in products:
            analysis = DataQualityAnalyzer.analyze_product(product)
            scores.append(analysis["score"])
            distribution[analysis["level"]] += 1

            # 统计缺失字段
            for field in analysis["missing_fields"]:
                missing_fields_count[field] = missing_fields_count.get(field, 0) + 1

            # 按质量分组
            products_by_quality[analysis["level"]].append({
                "code": product["code"],
                "name": product["name"],
                "score": analysis["score"],
                "missing_fields": analysis["missing_fields"]
            })

        # 排序缺失字段
        top_missing_fields = sorted(
            missing_fields_count.items(),
            key=lambda x: x[1],
            reverse=True
        )

        return {
            "total_products": total_products,
            "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
            "distribution": distribution,
            "top_missing_fields": top_missing_fields,
            "products_by_quality": products_by_quality
        }


def print_product_list(products: List[Dict[str, Any]]):
    """打印产品列表"""
    print(f"\n📦 产品列表 (共 {len(products)} 个)")
    print("-" * 80)
    for i, product in enumerate(products, 1):
        images_count = len(product.get("images", []))
        in_stock = "✅" if product.get("in_stock") else "❌"
        print(f"{i:3d}. {product['code']:15s} | {product['name']:30s} | "
              f"¥{product['price']:7.2f} | 图片: {images_count} | 库存: {in_stock}")


def print_product_detail(product: Dict[str, Any]):
    """打印产品详情"""
    print(f"\n📦 产品详情: {product['code']}")
    print("=" * 80)

    print("\n基础信息:")
    print(f"  名称: {product['name']}")
    print(f"  描述: {product.get('description', '(无)')[:50]}...")
    print(f"  形状: {product['shape']}")
    print(f"  材质: {product['material']}")
    print(f"  出厂价: ¥{product['price']:.2f}")

    if product.get("dimensions"):
        dims = product["dimensions"]
        print("\n尺寸信息:")
        if dims.get("weight"):
            print(f"  重量: {dims['weight']} kg")
        if dims.get("length") and dims.get("width") and dims.get("height"):
            print(f"  尺寸: {dims['length']}x{dims['width']}x{dims['height']} cm")
        if dims.get("capacity"):
            cap = dims["capacity"]
            print(f"  容量: {cap.get('min', 0)}-{cap.get('max', 0)} ml")

    print("\n库存状态:")
    print(f"  有货: {'✅' if product.get('in_stock') else '❌'}")
    print(f"  有样品: {'✅' if product.get('has_sample') else '❌'}")
    print(f"  精选产品: {'✅' if product.get('is_featured') else '❌'}")

    if product.get("images"):
        print(f"\n图片: (共 {len(product['images'])} 张)")
        for img in product["images"]:
            print(f"  - {img['type']:10s} | {img['url']}")

    # 数据质量分析
    analysis = DataQualityAnalyzer.analyze_product(product)
    print(f"\n质量评分: {analysis['score']}/10 ({analysis['level']})")
    if analysis["missing_fields"]:
        print("\n⚠️ 缺失字段:")
        for field in analysis["missing_fields"]:
            print(f"  - {field}")
    if analysis["warnings"]:
        print("\n⚠️ 建议:")
        for warning in analysis["warnings"]:
            print(f"  - {warning}")


def print_quality_report(report: Dict[str, Any]):
    """打印数据质量报告"""
    print("\n📊 数据质量报告")
    print("=" * 80)

    print(f"\n总产品数: {report['total_products']}")
    print(f"平均评分: {report['average_score']}/10")

    print("\n质量分布:")
    dist = report["distribution"]
    total = report["total_products"]
    print(f"  优秀 (9-10分): {dist['excellent']:3d} ({dist['excellent']/total*100:5.1f}%)")
    print(f"  良好 (7-9分):  {dist['good']:3d} ({dist['good']/total*100:5.1f}%)")
    print(f"  一般 (5-7分):  {dist['fair']:3d} ({dist['fair']/total*100:5.1f}%)")
    print(f"  较差 (0-5分):  {dist['poor']:3d} ({dist['poor']/total*100:5.1f}%)")

    print("\n最常缺失的字段:")
    for field, count in report["top_missing_fields"][:10]:
        print(f"  {field:20s}: {count:3d} 个产品 ({count/total*100:5.1f}%)")

    # 打印需要改进的产品
    poor_products = report["products_by_quality"]["poor"]
    if poor_products:
        print(f"\n⚠️ 需要改进的产品 (共 {len(poor_products)} 个):")
        for product in poor_products[:10]:
            print(f"  - {product['code']:15s} | {product['name']:30s} | "
                  f"评分: {product['score']}/10 | 缺失: {', '.join(product['missing_fields'])}")


def main():
    parser = argparse.ArgumentParser(description="TurtleAlbum 生产数据查询工具")
    parser.add_argument("--env", choices=["dev", "staging", "prod"], default="dev",
                        help="环境 (dev/staging/prod)")
    parser.add_argument("--username", default="admin", help="用户名")
    parser.add_argument("--password", required=True, help="密码")
    parser.add_argument("--action", choices=["list", "search", "detail", "quality-report", "series"],
                        required=True, help="操作类型")
    parser.add_argument("--code", help="产品编号 (用于 search/detail)")
    parser.add_argument("--name", help="产品名称 (用于 search)")
    parser.add_argument("--product-id", help="产品 ID (用于 detail)")

    args = parser.parse_args()

    # 初始化 API 客户端
    api = TurtleAlbumAPI(args.env, args.username, args.password)

    # 执行操作
    if args.action == "list":
        products_data = api.get_all_products()
        print_product_list(products_data["products"])

    elif args.action == "search":
        if not args.code and not args.name:
            print("❌ 请提供 --code 或 --name 参数")
            return

        results = api.search_products(code=args.code, name=args.name)
        if results:
            print_product_list(results)
        else:
            print("❌ 未找到匹配的产品")

    elif args.action == "detail":
        if args.product_id:
            product_data = api.get_product(args.product_id)
            print_product_detail(product_data["data"])
        elif args.code:
            results = api.search_products(code=args.code)
            if results:
                print_product_detail(results[0])
            else:
                print("❌ 未找到匹配的产品")
        else:
            print("❌ 请提供 --product-id 或 --code 参数")

    elif args.action == "quality-report":
        products_data = api.get_all_products()
        report = DataQualityAnalyzer.generate_quality_report(products_data["products"])
        print_quality_report(report)

    elif args.action == "series":
        series_data = api.get_all_series()
        print(f"\n📚 系列列表 (共 {len(series_data['data'])} 个)")
        print("-" * 80)
        for i, series in enumerate(series_data["data"], 1):
            active = "✅" if series.get("is_active") else "❌"
            print(f"{i:3d}. {series['code']:20s} | {series['name']:30s} | 激活: {active}")


if __name__ == "__main__":
    main()
