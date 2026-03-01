#!/usr/bin/env python3
"""Add carousel images and series descriptions."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Series, Carousel
import uuid

def main():
    engine = create_engine("sqlite:///./data/app.db", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Update series descriptions
        cb_series = db.query(Series).filter(Series.name == "CB-2026").first()
        if cb_series:
            cb_series.description = """CB-2026系列是我们精心培育的高品质果核龟系列
专注于体型、花纹和健康度的综合选育
每只种龟都经过严格筛选，确保优良基因传承
适合追求高品质繁育的玩家"""
            print(f"✅ 更新 CB-2026 系列描述")

        hc_series = db.query(Series).filter(Series.name == "高对比").first()
        if hc_series:
            hc_series.description = """高对比系列专注于培育色彩鲜明、对比度强烈的果核龟
黑白分明的花纹是本系列的最大特色
经过多代选育，稳定遗传优秀的对比度基因
是追求视觉冲击力玩家的首选"""
            print(f"✅ 更新 高对比 系列描述")

        # Add carousel images
        carousels = [
            {
                "image_url": "https://api3.superbed.cn/static/images/2026/0218/3a/69959618556e27f1c93a2e3a.jpg",
                "title": "精品果核种龟",
                "description": "专业繁育 · 品质保证",
                "link_url": "/",
                "sort_order": 1,
                "is_active": True
            },
            {
                "image_url": "https://api3.superbed.cn/static/images/2026/0218/3b/69959619556e27f1c93a2e3b.jpg",
                "title": "CB-2026系列",
                "description": "高品质繁育种龟",
                "link_url": "/",
                "sort_order": 2,
                "is_active": True
            },
            {
                "image_url": "https://api3.superbed.cn/static/images/2026/0218/3c/6995961a556e27f1c93a2e3c.jpg",
                "title": "高对比系列",
                "description": "色彩鲜明 · 对比强烈",
                "link_url": "/",
                "sort_order": 3,
                "is_active": True
            }
        ]

        for carousel_data in carousels:
            carousel = Carousel(
                id=str(uuid.uuid4()),
                **carousel_data
            )
            db.add(carousel)
            print(f"✅ 添加轮播图: {carousel_data['title']}")

        db.commit()
        print("\n✅ 所有数据添加成功！")

    except Exception as e:
        db.rollback()
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
