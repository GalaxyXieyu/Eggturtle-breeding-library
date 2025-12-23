#!/usr/bin/env python3
"""
Test new fields in the updated schema
"""

import pytest
pytest.skip("manual integration script (requires running server)", allow_module_level=True)

import requests
import json

BASE_URL = "http://localhost:8000"

def get_auth_token():
    """Get authentication token."""
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if response.status_code == 200:
        data = response.json()
        return data["data"]["token"]
    return None

def test_new_fields():
    """Test all new and updated fields."""
    print("🧪 Testing New Fields in Updated Schema")
    print("=" * 50)
    
    token = get_auth_token()
    if not token:
        print("❌ Failed to get auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Product with process_type
    print("\n📦 Test 1: Product with process_type")
    product_data_1 = {
        "name": "Test Process Type Product",
        "code": "PROC001",
        "description": "Testing process_type field",
        "process_type": "注塑",
        "functional_designs": ["磁吸", "多格"],
        "shape": "圆形",
        "material": "AS",
        "dimensions": {
            "weight": 15.5,
            "length": 10.2,
            "width": 2.1,
            "height": 2.1
        },
        "cost_price": 2.50,
        "factory_price": 1.80
    }
    
    response = requests.post(f"{BASE_URL}/api/products", json=product_data_1, headers=headers)
    if response.status_code == 200:
        data = response.json()
        product_id_1 = data["data"]["id"]
        print(f"✅ Product with process_type created: {product_id_1}")
        print(f"   Process Type: {data['data']['processType']}")
    else:
        print(f"❌ Failed to create product with process_type: {response.status_code}")
        print(response.text)
        return
    
    # Test 2: Product with tube_type including new '发际线包材'
    print("\n📦 Test 2: Product with tube_type '发际线包材'")
    product_data_2 = {
        "name": "Test Hairline Product",
        "code": "HAIR001",
        "description": "Testing 发际线包材 tube_type",
        "tube_type": "发际线包材",
        "functional_designs": ["卡扣"],
        "shape": "长方形",
        "material": "PETG",
        "dimensions": {
            "weight": 12.0,
            "length": 8.5,
            "width": 3.0,
            "height": 1.5
        },
        "cost_price": 3.00,
        "factory_price": 2.20
    }
    
    response = requests.post(f"{BASE_URL}/api/products", json=product_data_2, headers=headers)
    if response.status_code == 200:
        data = response.json()
        product_id_2 = data["data"]["id"]
        print(f"✅ Product with 发际线包材 created: {product_id_2}")
        print(f"   Tube Type: {data['data']['tubeType']}")
    else:
        print(f"❌ Failed to create product with 发际线包材: {response.status_code}")
        print(response.text)
        return
    
    # Test 3: Product with all new material types
    print("\n📦 Test 3: Testing all material types")
    materials = ["AS", "PETG", "PS", "PP"]
    for i, material in enumerate(materials):
        product_data = {
            "name": f"Test {material} Product",
            "code": f"MAT{i:03d}",
            "description": f"Testing {material} material",
            "functional_designs": ["双头"],
            "shape": "正方形",
            "material": material,
            "dimensions": {
                "weight": 10.0 + i,
                "length": 5.0 + i,
                "width": 2.0,
                "height": 2.0
            },
            "cost_price": 1.50 + i * 0.5,
            "factory_price": 1.00 + i * 0.3
        }
        
        response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ {material} product created: {data['data']['id']}")
        else:
            print(f"❌ Failed to create {material} product: {response.status_code}")
    
    # Test 4: Product with '多格' functional design
    print("\n📦 Test 4: Product with '多格' functional design")
    product_data_4 = {
        "name": "Test Multi-Compartment Product",
        "code": "MULTI001",
        "description": "Testing 多格 functional design",
        "box_type": "散粉盒",
        "functional_designs": ["多格", "带镜子"],
        "shape": "椭圆形",
        "material": "PP",
        "dimensions": {
            "weight": 25.0,
            "length": 12.0,
            "width": 8.0,
            "height": 3.0,
            "compartments": 4
        },
        "cost_price": 4.50,
        "factory_price": 3.20
    }
    
    response = requests.post(f"{BASE_URL}/api/products", json=product_data_4, headers=headers)
    if response.status_code == 200:
        data = response.json()
        product_id_4 = data["data"]["id"]
        print(f"✅ Multi-compartment product created: {product_id_4}")
        print(f"   Functional Designs: {data['data']['functionalDesigns']}")
    else:
        print(f"❌ Failed to create multi-compartment product: {response.status_code}")
        print(response.text)
        return
    
    # Test 5: Get all products and verify fields
    print("\n📦 Test 5: Verify all products have correct fields")
    response = requests.get(f"{BASE_URL}/api/products")
    if response.status_code == 200:
        data = response.json()
        products = data["data"]["products"]
        print(f"✅ Retrieved {len(products)} products")
        
        for product in products:
            print(f"   Product: {product['name']}")
            if product.get('processType'):
                print(f"     Process Type: {product['processType']}")
            if product.get('tubeType'):
                print(f"     Tube Type: {product['tubeType']}")
            if product.get('boxType'):
                print(f"     Box Type: {product['boxType']}")
            print(f"     Material: {product['material']}")
            print(f"     Functional Designs: {product['functionalDesigns']}")
    else:
        print(f"❌ Failed to get products: {response.status_code}")
    
    # Cleanup: Delete test products
    print("\n🧹 Cleaning up test products...")
    test_product_ids = [product_id_1, product_id_2, product_id_4]
    for product_id in test_product_ids:
        response = requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
        if response.status_code == 200:
            print(f"✅ Deleted product: {product_id}")
        else:
            print(f"❌ Failed to delete product {product_id}: {response.status_code}")
    
    print("\n🎉 New fields testing completed!")

if __name__ == "__main__":
    test_new_fields()
