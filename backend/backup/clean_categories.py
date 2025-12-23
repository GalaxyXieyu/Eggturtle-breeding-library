#!/usr/bin/env python3
"""
数据库分类数据清洗脚本
统一分隔符为 / 并清理重复数据
"""

from sqlalchemy.orm import sessionmaker
from database import engine
from models import Product

def clean_category_field(value):
    """清洗分类字段，统一分隔符"""
    if not value:
        return value

    # 替换各种分隔符为统一的 /
    cleaned = value.replace(',', '/').replace('，', '/').replace('、', '/')

    # 分割、去重、去空格、重新组合
    items = [item.strip() for item in cleaned.split('/') if item.strip()]
    items = list(dict.fromkeys(items))  # 保持顺序的去重

    return '/'.join(items) if items else None

def clean_database_categories():
    """清洗数据库中的分类数据"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # 获取所有产品
        products = db.query(Product).all()

        print(f"开始清洗 {len(products)} 个产品的分类数据...")

        updated_count = 0

        for product in products:
            updated = False

            # 清洗 tube_type
            if product.tube_type:
                cleaned_tube_type = clean_category_field(product.tube_type)
                if cleaned_tube_type != product.tube_type:
                    print(f"产品 {product.code}: tube_type '{product.tube_type}' -> '{cleaned_tube_type}'")
                    product.tube_type = cleaned_tube_type
                    updated = True

            # 清洗 box_type
            if product.box_type:
                cleaned_box_type = clean_category_field(product.box_type)
                if cleaned_box_type != product.box_type:
                    print(f"产品 {product.code}: box_type '{product.box_type}' -> '{cleaned_box_type}'")
                    product.box_type = cleaned_box_type
                    updated = True

            # 清洗 functional_designs
            if product.functional_designs:
                cleaned_functional_designs = clean_category_field(product.functional_designs)
                if cleaned_functional_designs != product.functional_designs:
                    print(f"产品 {product.code}: functional_designs '{product.functional_designs}' -> '{cleaned_functional_designs}'")
                    product.functional_designs = cleaned_functional_designs
                    updated = True

            # 清洗 shape (虽然shape通常是单个值，但也可能有多值)
            if product.shape:
                cleaned_shape = clean_category_field(product.shape)
                if cleaned_shape != product.shape:
                    print(f"产品 {product.code}: shape '{product.shape}' -> '{cleaned_shape}'")
                    product.shape = cleaned_shape
                    updated = True

            # 清洗 material
            if product.material:
                cleaned_material = clean_category_field(product.material)
                if cleaned_material != product.material:
                    print(f"产品 {product.code}: material '{product.material}' -> '{cleaned_material}'")
                    product.material = cleaned_material
                    updated = True

            if updated:
                updated_count += 1

        # 提交更改
        db.commit()
        print(f"\n清洗完成！共更新了 {updated_count} 个产品的分类数据")

        # 显示清洗后的统计
        print("\n=== 清洗后的统计 ===")

        # 统计各分类的唯一值
        tube_types = db.query(Product.tube_type).filter(Product.tube_type.isnot(None)).distinct().all()
        box_types = db.query(Product.box_type).filter(Product.box_type.isnot(None)).distinct().all()
        functional_designs = db.query(Product.functional_designs).filter(Product.functional_designs.isnot(None)).distinct().all()
        shapes = db.query(Product.shape).distinct().all()
        materials = db.query(Product.material).distinct().all()

        print(f"Tube Types ({len(tube_types)}): {sorted([t[0] for t in tube_types if t[0]])}")
        print(f"Box Types ({len(box_types)}): {sorted([b[0] for b in box_types if b[0]])}")
        print(f"Functional Designs ({len(functional_designs)}): {sorted([fd[0] for fd in functional_designs if fd[0]])}")
        print(f"Shapes ({len(shapes)}): {sorted([s[0] for s in shapes if s[0]])}")
        print(f"Materials ({len(materials)}): {sorted([m[0] for m in materials if m[0]])}")

    except Exception as e:
        print(f"清洗过程中发生错误: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clean_database_categories()