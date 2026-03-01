#!/usr/bin/env python3
"""API 接口测试脚本"""
import requests
import json

BASE_URL = "http://localhost:8000"
HEADERS = {"Content-Type": "application/json"}

def test_api(name, method, path, expected_status=200, data=None, auth=False):
    """测试单个 API 接口"""
    url = f"{BASE_URL}{path}"
    token = None

    if auth:
        # 先登录获取 token
        try:
            login_resp = requests.post(f"{BASE_URL}/api/auth/login",
                json={"username": "admin", "password": "admin123"},
                headers=HEADERS)
            if login_resp.status_code == 200:
                token = login_resp.json()["data"]["token"]
        except:
            pass

    try:
        headers = HEADERS.copy()
        if token:
            headers["Authorization"] = f"Bearer {token}"

        if method == "GET":
            resp = requests.get(url, headers=headers)
        elif method == "POST":
            resp = requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            resp = requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers)
        else:
            return False, "Unknown method"

        status = "✅ PASS" if resp.status_code == expected_status else "❌ FAIL"
        result = resp.status_code == expected_status
        return result, f"{status} (status: {resp.status_code})"
    except Exception as e:
        return False, f"❌ ERROR: {str(e)}"

def main():
    print("=" * 60)
    print("        Glam-Cart 后端 API 接口测试报告")
    print("=" * 60)
    print()

    results = []

    # 公开接口测试
    print("【公开接口】无需认证")
    print("-" * 40)

    r, msg = test_api("Settings", "GET", "/api/settings")
    results.append(("GET /api/settings", r, msg))
    print(f"  GET  /api/settings          - {msg}")

    r, msg = test_api("Carousels", "GET", "/api/carousels")
    results.append(("GET /api/carousels", r, msg))
    print(f"  GET  /api/carousels         - {msg}")

    r, msg = test_api("Products", "GET", "/api/products?page=1&limit=5")
    results.append(("GET /api/products", r, msg))
    print(f"  GET  /api/products          - {msg}")

    r, msg = test_api("Featured Products", "GET", "/api/products/featured?limit=5")
    results.append(("GET /api/products/featured", r, msg))
    print(f"  GET  /api/products/featured - {msg}")

    r, msg = test_api("Filter Options", "GET", "/api/products/filter-options")
    results.append(("GET /api/products/filter-options", r, msg))
    print(f"  GET  /api/products/filter-options - {msg}")

    # 认证接口测试
    print()
    print("【认证接口】需要认证")
    print("-" * 40)

    r, msg = test_api("Login", "POST", "/api/auth/login", expected_status=200,
                      data={"username": "admin", "password": "admin123"})
    results.append(("POST /api/auth/login", r, msg))
    print(f"  POST /api/auth/login        - {msg}")

    r, msg = test_api("Verify Token", "GET", "/api/auth/verify", auth=True)
    results.append(("GET /api/auth/verify", r, msg))
    print(f"  GET  /api/auth/verify       - {msg}")

    r, msg = test_api("Refresh Token", "POST", "/api/auth/refresh", auth=True)
    results.append(("POST /api/auth/refresh", r, msg))
    print(f"  POST /api/auth/refresh      - {msg}")

    r, msg = test_api("Logout", "POST", "/api/auth/logout", auth=True)
    results.append(("POST /api/auth/logout", r, msg))
    print(f"  POST /api/auth/logout       - {msg}")

    # 管理接口测试（需要认证）
    print()
    print("【管理接口】需要认证")
    print("-" * 40)

    r, msg = test_api("Featured Admin", "GET", "/api/admin/featured", auth=True)
    results.append(("GET /api/admin/featured", r, msg))
    print(f"  GET  /api/admin/featured    - {msg}")

    # 统计结果
    print()
    print("=" * 60)
    print("【测试统计】")
    print("-" * 40)
    passed = sum(1 for _, r, _ in results if r)
    total = len(results)
    rate = (passed / total * 100) if total > 0 else 0

    print(f"  总测试数: {total}")
    print(f"  通过: {passed}")
    print(f"  失败: {total - passed}")
    print(f"  通过率: {rate:.1f}%")
    print("=" * 60)

    return passed, total

if __name__ == "__main__":
    main()
