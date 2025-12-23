#!/usr/bin/env python3
"""
数据库迁移脚本：为ProductImage表添加sort_order字段
并为现有图片设置默认排序值
"""

import sqlite3
import os
import sys
from datetime import datetime

def migrate_database():
    """执行数据库迁移"""
    db_path = "glam_cart.db"
    
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件不存在: {db_path}")
        return False
    
    try:
        # 连接数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 检查当前数据库结构...")
        
        # 检查是否已经有sort_order字段
        cursor.execute("PRAGMA table_info(product_images)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'sort_order' in columns:
            print("✅ sort_order字段已存在，跳过迁移")
            conn.close()
            return True
        
        print("📊 当前product_images表结构:")
        for col in columns:
            print(f"  - {col}")
        
        # 备份当前数据
        print("\n💾 备份当前数据...")
        backup_filename = f"glam_cart_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        
        # 使用SQLite的备份API
        backup = sqlite3.connect(backup_filename)
        conn.backup(backup)
        backup.close()
        print(f"✅ 数据已备份到: {backup_filename}")
        
        # 开始迁移
        print("\n🔧 开始数据库迁移...")
        
        # 1. 添加sort_order字段
        print("1️⃣ 添加sort_order字段...")
        cursor.execute("ALTER TABLE product_images ADD COLUMN sort_order INTEGER DEFAULT 0")
        
        # 2. 为现有图片设置排序值
        print("2️⃣ 为现有图片设置默认排序值...")
        
        # 获取所有产品的图片，按产品分组，按创建时间排序
        cursor.execute("""
            SELECT id, product_id, created_at 
            FROM product_images 
            ORDER BY product_id, created_at
        """)
        
        images = cursor.fetchall()
        
        if images:
            print(f"   找到 {len(images)} 张图片需要设置排序")
            
            # 按产品分组设置排序
            current_product_id = None
            sort_order = 0
            
            for image_id, product_id, created_at in images:
                if product_id != current_product_id:
                    current_product_id = product_id
                    sort_order = 0
                
                cursor.execute("""
                    UPDATE product_images 
                    SET sort_order = ? 
                    WHERE id = ?
                """, (sort_order, image_id))
                
                sort_order += 1
            
            print(f"   ✅ 已为所有图片设置排序值")
        else:
            print("   ℹ️ 没有找到现有图片数据")
        
        # 3. 验证迁移结果
        print("3️⃣ 验证迁移结果...")
        cursor.execute("SELECT COUNT(*) FROM product_images WHERE sort_order IS NOT NULL")
        count = cursor.fetchone()[0]
        print(f"   ✅ {count} 张图片已设置排序值")
        
        # 提交更改
        conn.commit()
        print("\n✅ 数据库迁移完成！")
        
        # 显示迁移后的表结构
        print("\n📊 迁移后的product_images表结构:")
        cursor.execute("PRAGMA table_info(product_images)")
        columns = cursor.fetchall()
        for column in columns:
            print(f"  - {column[1]} ({column[2]})")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ 迁移失败: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

def verify_migration():
    """验证迁移是否成功"""
    try:
        conn = sqlite3.connect("glam_cart.db")
        cursor = conn.cursor()
        
        # 检查字段是否存在
        cursor.execute("PRAGMA table_info(product_images)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'sort_order' not in columns:
            print("❌ 验证失败：sort_order字段不存在")
            return False
        
        # 检查数据
        cursor.execute("SELECT COUNT(*) FROM product_images")
        total_images = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM product_images WHERE sort_order IS NOT NULL")
        sorted_images = cursor.fetchone()[0]
        
        print(f"\n📊 验证结果:")
        print(f"  - 总图片数: {total_images}")
        print(f"  - 已设置排序的图片数: {sorted_images}")
        
        if total_images == sorted_images:
            print("✅ 验证成功：所有图片都已设置排序值")
            return True
        else:
            print("⚠️ 验证警告：部分图片未设置排序值")
            return False
            
    except Exception as e:
        print(f"❌ 验证失败: {str(e)}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("🚀 开始ProductImage表sort_order字段迁移")
    print("=" * 50)
    
    # 执行迁移
    if migrate_database():
        print("\n" + "=" * 50)
        print("🔍 验证迁移结果...")
        verify_migration()
        print("\n🎉 迁移完成！现在可以使用图片排序功能了。")
    else:
        print("\n❌ 迁移失败，请检查错误信息")
        sys.exit(1)
