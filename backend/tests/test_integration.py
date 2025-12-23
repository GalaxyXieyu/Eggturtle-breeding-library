#!/usr/bin/env python3
"""
Integration test script for Glam Cart Builder API
Tests the complete workflow from frontend perspective
"""

import pytest
pytest.skip("manual integration script (requires running server)", allow_module_level=True)

import requests
import json
import time
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

def test_api_health():
    """Test API health endpoint"""
    print("🔍 Testing API health...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    return response.status_code == 200

def test_public_products():
    """Test public products endpoint"""
    print("\n🔍 Testing public products endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/products")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if 'data' in data:
                print(f"   Products count: {data['data']['total']}")
            else:
                print(f"   Response structure: {list(data.keys())}")
                print(f"   Response: {data}")
        else:
            print(f"   Error: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"   Connection error: {e}")
        return False

def test_featured_products():
    """Test featured products endpoint"""
    print("\n🔍 Testing featured products endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/products/featured")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if 'data' in data:
                print(f"   Featured products count: {len(data['data'])}")
            else:
                print(f"   Response structure: {list(data.keys())}")
                print(f"   Response: {data}")
        else:
            print(f"   Error: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"   Connection error: {e}")
        return False

def test_admin_login():
    """Test admin login"""
    print("\n🔍 Testing admin login...")
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=login_data,
        headers={"Content-Type": "application/json"}
    )
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   Login successful! Token received.")
        return data['data']['token']
    else:
        print(f"   Login failed: {response.text}")
        return None

def test_protected_endpoint(admin_token: str):
    """Test protected endpoint with token"""
    print("\n🔍 Testing protected endpoint...")
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    
    # Test creating a product with unique code
    import time
    unique_code = f"TEST{int(time.time())}"
    product_data = {
        "name": "Test Product",
        "code": unique_code,
        "description": "A test product for integration testing",
        "shape": "圆形",
        "material": "PETG",
        "dimensions": {
            "weight": 15,
            "length": 70,
            "width": 20,
            "height": 20,
            "capacity": {
                "min": 3,
                "max": 5
            }
        },
        "cost_price": 10.00,
        "factory_price": 15.00,
        "has_sample": True,
        "box_dimensions": "300x200x150mm",
        "box_quantity": 1000,
        "in_stock": True,
        "popularity_score": 85,
        "images": []
    }
    
    response = requests.post(
        f"{BASE_URL}/api/products",
        json=product_data,
        headers=headers
    )
    print(f"   Create product status: {response.status_code}")

    if response.status_code in [200, 201]:
        data = response.json()
        product_id = data['data']['id']
        print(f"   Product created with ID: {product_id}")
        return product_id
    else:
        print(f"   Failed to create product: {response.text}")
        return None

def test_cors_headers():
    """Test CORS headers"""
    print("\n🔍 Testing CORS headers...")
    # Test CORS headers on a GET request with Origin header
    headers = {
        'Origin': 'http://localhost:8080'
    }
    response = requests.get(f"{BASE_URL}/api/products", headers=headers)
    print(f"   Status: {response.status_code}")
    cors_headers = {
        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
    }
    print(f"   CORS Headers: {cors_headers}")
    # Check if at least Access-Control-Allow-Origin is present
    return response.status_code == 200 and response.headers.get('Access-Control-Allow-Origin') is not None

def test_api_documentation():
    """Test API documentation accessibility"""
    print("\n🔍 Testing API documentation...")
    response = requests.get(f"{BASE_URL}/docs")
    print(f"   Docs status: {response.status_code}")
    
    response = requests.get(f"{BASE_URL}/openapi.json")
    print(f"   OpenAPI spec status: {response.status_code}")
    return response.status_code == 200

def main():
    """Run all integration tests"""
    print("🚀 Starting Glam Cart Builder Integration Tests")
    print("=" * 50)
    
    tests_passed = 0
    total_tests = 0
    
    # Test 1: API Health
    total_tests += 1
    if test_api_health():
        tests_passed += 1
        print("   ✅ PASSED")
    else:
        print("   ❌ FAILED")
    
    # Test 2: Public Products
    total_tests += 1
    if test_public_products():
        tests_passed += 1
        print("   ✅ PASSED")
    else:
        print("   ❌ FAILED")
    
    # Test 3: Featured Products
    total_tests += 1
    if test_featured_products():
        tests_passed += 1
        print("   ✅ PASSED")
    else:
        print("   ❌ FAILED")
    
    # Test 4: CORS Headers
    total_tests += 1
    if test_cors_headers():
        tests_passed += 1
        print("   ✅ PASSED")
    else:
        print("   ❌ FAILED")
    
    # Test 5: API Documentation
    total_tests += 1
    if test_api_documentation():
        tests_passed += 1
        print("   ✅ PASSED")
    else:
        print("   ❌ FAILED")
    
    # Test 6: Admin Login
    total_tests += 1
    token = test_admin_login()
    if token:
        tests_passed += 1
        print("   ✅ PASSED")
        
        # Test 7: Protected Endpoint (only if login successful)
        total_tests += 1
        product_id = test_protected_endpoint(token)
        if product_id:
            tests_passed += 1
            print("   ✅ PASSED")
        else:
            print("   ❌ FAILED")
    else:
        print("   ❌ FAILED")
        print("   ⚠️  Skipping protected endpoint test due to login failure")
    
    # Summary
    print("\n" + "=" * 50)
    print(f"🎯 Integration Test Results:")
    print(f"   Tests Passed: {tests_passed}/{total_tests}")
    print(f"   Success Rate: {(tests_passed/total_tests)*100:.1f}%")
    
    if tests_passed == total_tests:
        print("   🎉 ALL TESTS PASSED! Frontend-Backend integration is working!")
    else:
        print("   ⚠️  Some tests failed. Check the logs above for details.")
    
    return tests_passed == total_tests

if __name__ == "__main__":
    main()
