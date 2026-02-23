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
import os
import argparse
from typing import Optional, List, Dict, Any
from datetime import datetime


class TurtleAlbumAPI:
    """TurtleAlbum API 客户端"""

    ENVIRONMENTS = {
        "dev": "http://localhost:8000",
        "staging": "https://staging.turtlealbum.com",
        "prod": "https://qmngzrlhklmt.sealoshzh.site",
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
            body = response.json() if response.content else {}
            token = ((body or {}).get("data") or {}).get("token")
            if not token:
                raise ValueError("Login succeeded but token missing in response")
            self.token = token
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

    def get_all_products(self, page: int = 1, limit: int = 100, search: Optional[str] = None) -> Dict[str, Any]:
        """获取产品列表（支持 search）"""
        try:
            params: Dict[str, Any] = {"page": page, "limit": limit}
            if search:
                params["search"] = search
            response = requests.get(
                f"{self.base_url}/api/products",
                params=params,
                headers=self.get_headers(),
                timeout=10,
            )
            response.raise_for_status()
            body = response.json() if response.content else {}
            return (body or {}).get("data") or {}
        except requests.exceptions.RequestException as e:
            print(f"❌ 获取产品列表失败: {e}")
            raise

    def get_product(self, product_id: str) -> Dict[str, Any]:
        """获取单个产品"""
        try:
            response = requests.get(
                f"{self.base_url}/api/products/{product_id}",
                headers=self.get_headers(),
                timeout=10,
            )
            response.raise_for_status()
            body = response.json() if response.content else {}
            return (body or {}).get("data") or {}
        except requests.exceptions.RequestException as e:
            print(f"❌ 获取产品失败: {e}")
            raise

    def get_all_series(self) -> Dict[str, Any]:
        """获取所有系列"""
        try:
            response = requests.get(
                f"{self.base_url}/api/series",
                headers=self.get_headers(),
                timeout=10,
            )
            response.raise_for_status()
            body = response.json() if response.content else {}
            return (body or {}).get("data") or {}
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
        """搜索产品（走后端 search 参数）"""
        q = (code or name or "").strip()
        if not q:
            return []

        data = self.get_all_products(page=1, limit=1000, search=q)
        products = data.get("products") or []

        # Keep behavior: allow substring match on code/name.
        results: List[Dict[str, Any]] = []
        for product in products:
            p_code = str(product.get("code") or "")
            p_name = str(product.get("name") or "")
            if code and code.lower() in p_code.lower():
                results.append(product)
            elif name and name.lower() in p_name.lower():
                results.append(product)

        return results


class DataQualityAnalyzer:
    """数据质量分析器"""

    # 重要字段定义（按当前 API 返回字段，主要用于报告展示）
    CRITICAL_FIELDS = ["code"]
    IMPORTANT_FIELDS = ["description", "seriesId", "images"]
    OPTIONAL_FIELDS = ["pricing.price", "pricing.costPrice", "pricing.hasSample", "inStock", "isFeatured"]

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

        if product.get("seriesId"):
            score += 1
        else:
            missing_fields.append("seriesId")
            warnings.append("未分配系列，影响分类和筛选")

        # 检查可选字段
        pricing = product.get("pricing") or {}
        if pricing.get("costPrice") and float(pricing.get("costPrice") or 0) > 0:
            score += 0.5

        if pricing.get("hasSample"):
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
    """打印产品列表（当前 TurtleAlbum 产品结构）"""
    print(f"\n📦 产品列表 (共 {len(products)} 个)")
    print("-" * 100)
    for i, product in enumerate(products, 1):
        code = str(product.get("code") or "")
        name = str(product.get("name") or "") or code
        sex = str(product.get("sex") or "-")
        series_id = str(product.get("seriesId") or "-")
        pricing = product.get("pricing") or {}
        price = pricing.get("price")
        price_str = f"¥{float(price):.2f}" if price is not None else "-"
        images_count = len(product.get("images") or [])
        in_stock = "✅" if product.get("inStock") else "❌"

        print(
            f"{i:3d}. {code:12s} | {name:12.12s} | sex={sex:6s} | series={series_id:6s} | "
            f"{price_str:10s} | imgs={images_count:2d} | stock={in_stock}"
        )


def print_product_detail(product: Dict[str, Any]):
    """打印产品详情（当前 TurtleAlbum 产品结构）"""
    code = str(product.get("code") or "")
    name = str(product.get("name") or "") or code
    print(f"\n📦 产品详情: {code}")
    print("=" * 80)

    print("\n基础信息:")
    print(f"  名称: {name}")
    print(f"  系列: {product.get('seriesId') or '-'}")
    print(f"  性别: {product.get('sex') or '-'}")
    print(f"  配偶编号: {product.get('mateCode') or '-'}")
    print(f"  子代单价: {product.get('offspringUnitPrice') or '-'}")
    print(f"  父本编号: {product.get('sireCode') or '-'}")
    print(f"  母本编号: {product.get('damCode') or '-'}")

    pricing = product.get("pricing") or {}
    print("\n价格/库存:")
    print(f"  本体价格: {pricing.get('price')}")
    print(f"  成本价: {pricing.get('costPrice')}")
    print(f"  有货: {'✅' if product.get('inStock') else '❌'}")
    print(f"  有样品: {'✅' if pricing.get('hasSample') else '❌'}")
    print(f"  精选: {'✅' if product.get('isFeatured') else '❌'}")
    print(f"  人气: {product.get('popularityScore') or 0}")

    desc = str(product.get("description") or "").strip()
    print("\n备注/描述:")
    print("  " + (desc if desc else "(无)"))

    images = product.get("images") or []
    if images:
        print(f"\n图片: (共 {len(images)} 张)")
        for img in images:
            print(f"  - {img.get('type') or '-':6s} | {img.get('url')}")

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
    parser.add_argument(
        "--username",
        default=os.getenv("TURTLEALBUM_ADMIN_USERNAME") or "admin",
        help="用户名 (默认: env TURTLEALBUM_ADMIN_USERNAME 或 admin)",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("TURTLEALBUM_ADMIN_PASSWORD"),
        help="密码 (或设置 TURTLEALBUM_ADMIN_PASSWORD)",
    )
    parser.add_argument("--action", choices=["list", "search", "detail", "quality-report", "series"],
                        required=True, help="操作类型")
    parser.add_argument("--code", help="产品编号 (用于 search/detail)")
    parser.add_argument("--name", help="产品名称 (用于 search)")
    parser.add_argument("--product-id", help="产品 ID (用于 detail)")

    args = parser.parse_args()

    if not (args.password or "").strip():
        args.password = (os.getenv("TURTLEALBUM_ADMIN_PASSWORD") or "").strip() or None
    if not args.password:
        parser.error("密码必填: 传 --password 或设置 env TURTLEALBUM_ADMIN_PASSWORD")

    # 初始化 API 客户端
    api = TurtleAlbumAPI(args.env, args.username, args.password)

    # 执行操作
    if args.action == "list":
        products_data = api.get_all_products()
        print_product_list(products_data.get("products") or [])

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
            print_product_detail(product_data)
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
        report = DataQualityAnalyzer.generate_quality_report(products_data.get("products") or [])
        print_quality_report(report)

    elif args.action == "series":
        series_list = api.get_all_series() or []
        print(f"\n📚 系列列表 (共 {len(series_list)} 个)")
        print("-" * 80)
        for i, series in enumerate(series_list, 1):
            # Current API uses camelCase.
            active = "✅" if series.get("isActive") else "❌"
            series_id = str(series.get("id") or "")
            name = str(series.get("name") or "")
            print(f"{i:3d}. {series_id:36s} | {name:20s} | 激活: {active}")


if __name__ == "__main__":
    main()
