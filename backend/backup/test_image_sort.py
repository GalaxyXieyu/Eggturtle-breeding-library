#!/usr/bin/env python3
"""
测试图片排序功能
"""

import sqlite3
import json

def test_image_sort():
    """测试图片排序功能"""
    try:
        conn = sqlite3.connect("glam_cart.db")
        cursor = conn.cursor()
        
        print("🔍 测试图片排序功能...")
        
        # 查找有图片的产品
        cursor.execute("""
            SELECT p.id, p.name, COUNT(pi.id) as image_count
            FROM products p
            JOIN product_images pi ON p.id = pi.product_id
            GROUP BY p.id, p.name
            HAVING COUNT(pi.id) > 1
            LIMIT 5
        """)
        
        products_with_images = cursor.fetchall()
        
        if not products_with_images:
            print("❌ 没有找到有多张图片的产品")
            return
        
        print(f"📊 找到 {len(products_with_images)} 个有多张图片的产品:")
        
        for product_id, product_name, image_count in products_with_images:
            print(f"\n🔸 产品: {product_name} (ID: {product_id})")
            print(f"   图片数量: {image_count}")
            
            # 查看该产品的图片排序
            cursor.execute("""
                SELECT id, url, alt, type, sort_order, created_at
                FROM product_images
                WHERE product_id = ?
                ORDER BY sort_order
            """, (product_id,))
            
            images = cursor.fetchall()
            
            print("   图片排序:")
            for i, (img_id, url, alt, img_type, sort_order, created_at) in enumerate(images):
                print(f"     {i+1}. {alt} (排序: {sort_order}, 类型: {img_type})")
                print(f"        URL: {url}")
                print(f"        创建时间: {created_at}")
        
        print("\n✅ 图片排序功能测试完成")
        
    except Exception as e:
        print(f"❌ 测试失败: {str(e)}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    test_image_sort()
