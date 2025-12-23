#!/usr/bin/env python3
"""
Manual API testing script for quick verification.
Run this script to test the API endpoints manually.
"""

import pytest
pytest.skip("manual integration script (requires running server)", allow_module_level=True)

import requests
import json
import time
from pathlib import Path

BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint."""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_auth():
    """Test authentication endpoints."""
    print("\n🔐 Testing authentication...")
    
    # Test login
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            token = data["data"]["token"]
            print("✅ Login successful")
            
            # Test token verification
            headers = {"Authorization": f"Bearer {token}"}
            verify_response = requests.get(f"{BASE_URL}/api/auth/verify", headers=headers)
            if verify_response.status_code == 200:
                print("✅ Token verification successful")
                return token
            else:
                print(f"❌ Token verification failed: {verify_response.status_code}")
                return None
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"❌ Auth error: {e}")
        return None

def test_public_endpoints():
    """Test public product endpoints."""
    print("\n🌐 Testing public endpoints...")
    
    # Test get products (empty)
    try:
        response = requests.get(f"{BASE_URL}/api/products")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Get products: {data['data']['total']} products found")
        else:
            print(f"❌ Get products failed: {response.status_code}")
            
        # Test featured products
        response = requests.get(f"{BASE_URL}/api/products/featured")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Get featured products: {len(data['data'])} products found")
        else:
            print(f"❌ Get featured products failed: {response.status_code}")
            
        # Test filter options
        response = requests.get(f"{BASE_URL}/api/products/filter-options")
        if response.status_code == 200:
            print("✅ Get filter options successful")
        else:
            print(f"❌ Get filter options failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Public endpoints error: {e}")

def test_product_crud(admin_token):
    """Test product CRUD operations."""
    print("\n📦 Testing product CRUD operations...")
    
    if not admin_token:
        print("❌ No auth token available")
        return

    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test create product
    product_data = {
        "name": "Test Lipstick Tube",
        "code": "TEST001",
        "description": "A test lipstick tube for API testing",
        "tube_type": "口红管",
        "functional_designs": ["磁吸", "多格"],
        "shape": "圆形",
        "material": "PETG",
        "dimensions": {
            "weight": 15.5,
            "length": 10.2,
            "width": 2.1,
            "height": 2.1,
            "capacity": {"min": 3.5, "max": 4.0}
        },
        "cost_price": 2.50,
        "factory_price": 1.80,
        "has_sample": True,
        "box_dimensions": "50x30x20cm",
        "box_quantity": 100,
        "in_stock": True,
        "popularity_score": 85
    }
    
    try:
        # Create product
        response = requests.post(f"{BASE_URL}/api/products", json=product_data, headers=headers)
        if response.status_code == 200:
            data = response.json()
            product_id = data["data"]["id"]
            print(f"✅ Product created: {product_id}")
            
            # Test get single product
            get_response = requests.get(f"{BASE_URL}/api/products/{product_id}")
            if get_response.status_code == 200:
                print("✅ Get single product successful")
            else:
                print(f"❌ Get single product failed: {get_response.status_code}")
            
            # Test update product
            update_data = {
                "name": "Updated Test Lipstick Tube",
                "description": "Updated description"
            }
            update_response = requests.put(f"{BASE_URL}/api/products/{product_id}", json=update_data, headers=headers)
            if update_response.status_code == 200:
                print("✅ Product updated successfully")
            else:
                print(f"❌ Product update failed: {update_response.status_code}")
            
            # Test delete product
            delete_response = requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=headers)
            if delete_response.status_code == 200:
                print("✅ Product deleted successfully")
            else:
                print(f"❌ Product deletion failed: {delete_response.status_code}")
                
        else:
            print(f"❌ Product creation failed: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Product CRUD error: {e}")

def test_error_handling():
    """Test error handling."""
    print("\n🚨 Testing error handling...")
    
    try:
        # Test 404
        response = requests.get(f"{BASE_URL}/api/products/nonexistent-id")
        if response.status_code == 404:
            print("✅ 404 error handling works")
        else:
            print(f"❌ Expected 404, got {response.status_code}")
        
        # Test unauthorized access
        response = requests.post(f"{BASE_URL}/api/products", json={"name": "test"})
        if response.status_code == 403:
            print("✅ Unauthorized access protection works")
        else:
            print(f"❌ Expected 403, got {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error handling test error: {e}")

def main():
    """Run all tests."""
    print("🧪 Glam Cart Builder API Manual Test")
    print("=" * 50)
    
    # Test health
    if not test_health():
        print("❌ Server is not running. Please start the server first.")
        return
    
    # Test authentication
    token = test_auth()
    
    # Test public endpoints
    test_public_endpoints()
    
    # Test CRUD operations
    test_product_crud(token)
    
    # Test error handling
    test_error_handling()
    
    print("\n🎉 Manual testing completed!")
    print("📚 For full API documentation, visit: http://localhost:8000/docs")

if __name__ == "__main__":
    main()
