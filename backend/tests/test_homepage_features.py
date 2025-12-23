#!/usr/bin/env python3
"""
Test homepage features: carousels and featured products
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

def test_carousel_features():
    """Test carousel CRUD operations."""
    print("🎠 Testing Carousel Features")
    print("=" * 40)
    
    token = get_auth_token()
    if not token:
        print("❌ Failed to get auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Create carousel
    print("\n📦 Test 1: Create carousel")
    carousel_data = {
        "title": "Summer Collection 2024",
        "description": "Discover our latest summer cosmetics collection",
        "image_url": "/static/carousel/summer-2024.jpg",
        "link_url": "/products?collection=summer",
        "is_active": True,
        "sort_order": 1
    }
    
    response = requests.post(f"{BASE_URL}/api/carousels", json=carousel_data, headers=headers)
    if response.status_code == 200:
        data = response.json()
        carousel_id = data["data"]["id"]
        print(f"✅ Carousel created: {carousel_id}")
        print(f"   Title: {data['data']['title']}")
    else:
        print(f"❌ Failed to create carousel: {response.status_code}")
        print(response.text)
        return None
    
    # Test 2: Get all carousels
    print("\n📦 Test 2: Get all carousels")
    response = requests.get(f"{BASE_URL}/api/carousels")
    if response.status_code == 200:
        data = response.json()
        carousels = data["data"]
        print(f"✅ Retrieved {len(carousels)} carousels")
        for carousel in carousels:
            print(f"   - {carousel['title']} (Order: {carousel['sortOrder']})")
    else:
        print(f"❌ Failed to get carousels: {response.status_code}")
    
    # Test 3: Update carousel
    print("\n📦 Test 3: Update carousel")
    update_data = {
        "title": "Updated Summer Collection 2024",
        "sort_order": 2
    }
    response = requests.put(f"{BASE_URL}/api/carousels/{carousel_id}", json=update_data, headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Carousel updated")
        print(f"   New Title: {data['data']['title']}")
        print(f"   New Sort Order: {data['data']['sortOrder']}")
    else:
        print(f"❌ Failed to update carousel: {response.status_code}")
    
    return carousel_id

def test_featured_products():
    """Test featured products CRUD operations."""
    print("\n⭐ Testing Featured Products Features")
    print("=" * 40)
    
    token = get_auth_token()
    if not token:
        print("❌ Failed to get auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # First, create a test product
    print("\n📦 Test 1: Create test product for featuring")
    product_data = {
        "name": "Featured Test Product",
        "code": "FEAT001",
        "description": "A product to test featuring functionality",
        "shape": "圆形",
        "material": "PETG",
        "dimensions": {
            "weight": 15.0,
            "length": 10.0,
            "width": 3.0,
            "height": 3.0
        },
        "cost_price": 2.00,
        "factory_price": 1.50,
        "functional_designs": ["磁吸"]
    }
    
    response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
    if response.status_code == 200:
        data = response.json()
        product_id = data["data"]["id"]
        print(f"✅ Test product created: {product_id}")
    else:
        print(f"❌ Failed to create test product: {response.status_code}")
        print(response.text)
        return None
    
    # Test 2: Add product to featured
    print("\n📦 Test 2: Add product to featured")
    featured_data = {
        "product_id": product_id,
        "is_active": True,
        "sort_order": 1
    }
    
    response = requests.post(f"{BASE_URL}/api/featured-products", json=featured_data, headers=headers)
    if response.status_code == 200:
        data = response.json()
        featured_id = data["data"]["id"]
        print(f"✅ Product added to featured: {featured_id}")
        print(f"   Product: {data['data']['product']['name']}")
    else:
        print(f"❌ Failed to add product to featured: {response.status_code}")
        print(response.text)
        return None
    
    # Test 3: Get featured products (admin)
    print("\n📦 Test 3: Get featured products (admin)")
    response = requests.get(f"{BASE_URL}/api/featured-products", headers=headers)
    if response.status_code == 200:
        data = response.json()
        featured_products = data["data"]
        print(f"✅ Retrieved {len(featured_products)} featured products")
        for fp in featured_products:
            print(f"   - {fp['product']['name']} (Order: {fp['sortOrder']})")
    else:
        print(f"❌ Failed to get featured products: {response.status_code}")
    
    # Test 4: Get featured products (public)
    print("\n📦 Test 4: Get featured products (public)")
    response = requests.get(f"{BASE_URL}/api/products/featured")
    if response.status_code == 200:
        data = response.json()
        featured_products = data["data"]
        print(f"✅ Retrieved {len(featured_products)} featured products (public)")
        for product in featured_products:
            print(f"   - {product['name']}")
    else:
        print(f"❌ Failed to get featured products (public): {response.status_code}")
    
    # Test 5: Update featured product
    print("\n📦 Test 5: Update featured product")
    update_data = {
        "sort_order": 5
    }
    response = requests.put(f"{BASE_URL}/api/featured-products/{featured_id}", json=update_data, headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Featured product updated")
        print(f"   New Sort Order: {data['data']['sortOrder']}")
    else:
        print(f"❌ Failed to update featured product: {response.status_code}")
    
    return featured_id, product_id

def cleanup_test_data(carousel_id, featured_id, product_id):
    """Clean up test data."""
    print("\n🧹 Cleaning up test data...")
    
    token = get_auth_token()
    if not token:
        print("❌ Failed to get auth token for cleanup")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Delete carousel
    if carousel_id:
        response = requests.delete(f"{BASE_URL}/api/carousels/{carousel_id}", headers=headers)
        if response.status_code == 200:
            print(f"✅ Deleted carousel: {carousel_id}")
        else:
            print(f"❌ Failed to delete carousel: {response.status_code}")
    
    # Delete featured product
    if featured_id:
        response = requests.delete(f"{BASE_URL}/api/featured-products/{featured_id}", headers=headers)
        if response.status_code == 200:
            print(f"✅ Deleted featured product: {featured_id}")
        else:
            print(f"❌ Failed to delete featured product: {response.status_code}")
    
    # Delete test product
    if product_id:
        response = requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
        if response.status_code == 200:
            print(f"✅ Deleted test product: {product_id}")
        else:
            print(f"❌ Failed to delete test product: {response.status_code}")

def main():
    """Run all homepage feature tests."""
    print("🏠 Homepage Features Test")
    print("=" * 50)
    
    # Test carousels
    carousel_id = test_carousel_features()
    
    # Test featured products
    featured_result = test_featured_products()
    featured_id, product_id = featured_result if featured_result else (None, None)
    
    # Cleanup
    cleanup_test_data(carousel_id, featured_id, product_id)
    
    print("\n🎉 Homepage features testing completed!")

if __name__ == "__main__":
    main()
