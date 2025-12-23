#!/usr/bin/env python3
"""
验证导入数据完整性的脚本
"""

import requests
import json

def test_api_endpoints():
    """测试各个API端点"""
    base_url = "http://localhost:8000"
    
    print("🧪 测试API端点...")
    
    # 测试产品列表
    response = requests.get(f"{base_url}/api/products?limit=5")
    print(f"✅ 产品列表API: {response.status_code} - {len(response.json()['data']['products'])} 个产品")
    
    # 测试搜索Z系列产品
    response = requests.get(f"{base_url}/api/products?search=z")
    z_products = response.json()['data']['products']
    print(f"✅ Z系列产品搜索: {len(z_products)} 个Z系列产品")
    
    # 测试筛选器选项
    response = requests.get(f"{base_url}/api/products/filter-options")
    filter_options = response.json()['data']
    print(f"✅ 筛选器选项API: {len(filter_options['tubeTypes'])} 种管类，{len(filter_options['materials'])} 种材质")
    
    # 测试特色产品
    response = requests.get(f"{base_url}/api/products/featured")
    featured = response.json()['data']
    print(f"✅ 特色产品API: {len(featured)} 个特色产品")
    
    # 检查具体Z产品详情
    if z_products:
        first_z = z_products[0]
        response = requests.get(f"{base_url}/api/products/{first_z['id']}")
        if response.status_code == 200:
            product_detail = response.json()['data']
            print(f"✅ 产品详情API: {product_detail['name']} ({product_detail['code']}) - {len(product_detail['images'])} 张图片")

def check_frontend_proxy():
    """检查前端代理是否正常工作"""
    print("\n🌐 测试前端代理...")
    
    try:
        # 通过前端代理访问API
        response = requests.get("http://localhost:8080/api/products?limit=3")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 前端代理正常: 获取到 {len(data['data']['products'])} 个产品")
        else:
            print(f"❌ 前端代理错误: {response.status_code}")
    except Exception as e:
        print(f"❌ 前端代理连接失败: {e}")

def verify_z_products():
    """验证Z系列产品的完整性"""
    print("\n📦 验证Z系列产品...")
    
    response = requests.get("http://localhost:8000/api/products?search=z&limit=50")
    z_products = response.json()['data']['products']
    
    print(f"总共 {len(z_products)} 个Z系列产品:")
    
    for product in z_products:
        code = product['code']
        name = product['name']
        image_count = len(product['images'])
        has_main_image = any(img['type'] == 'main' for img in product['images'])
        
        status = "✅" if image_count >= 3 and has_main_image else "❌"
        print(f"  {status} {code}: {name} ({image_count} 张图片)")

if __name__ == "__main__":
    print("🚀 开始验证导入数据...")
    test_api_endpoints()
    check_frontend_proxy()
    verify_z_products()
    print("\n🎉 验证完成！") 