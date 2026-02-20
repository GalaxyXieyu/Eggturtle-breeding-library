#!/usr/bin/env python3
"""Add comprehensive family tree data for testing."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Series, Product, ProductImage

# Image URLs for different generations
FEMALE_IMAGES = [
    "https://api3.superbed.cn/static/images/2026/0218/3a/69959618556e27f1c93a2e3a.jpg",
    "https://api3.superbed.cn/static/images/2026/0218/3b/69959619556e27f1c93a2e3b.jpg",
    "https://api3.superbed.cn/static/images/2026/0218/3c/6995961a556e27f1c93a2e3c.jpg",
    "https://api3.superbed.cn/static/images/2026/0218/3d/6995961b556e27f1c93a2e3d.jpg",
]

MALE_IMAGES = [
    "https://pic1.imgdb.cn/item/69959731556e27f1c93a2e55.jpg",
    "https://pic1.imgdb.cn/item/69959731556e27f1c93a2e56.jpg",
    "https://pic1.imgdb.cn/item/69959732556e27f1c93a2e57.jpg",
    "https://pic1.imgdb.cn/item/69959732556e27f1c93a2e58.jpg",
]

def create_breeder(db, series_id, code, name, sex, sire_code=None, dam_code=None, image_url=None):
    """Create a breeder with image."""
    p = Product(
        name=name,
        code=code,
        description=f"示例种龟 {code}",
        series_id=series_id,
        sex=sex,
        sire_code=sire_code,
        dam_code=dam_code,
        shape="turtle",
        material="n/a",
        price=0.0,
        price=0.0,
        in_stock=True,
        is_featured=False,
    )
    db.add(p)
    db.flush()

    if image_url:
        db.add(ProductImage(
            product_id=p.id,
            url=image_url,
            alt=f"{code} main",
            type="main",
            sort_order=0,
        ))

    return p

def main():
    engine = create_engine("sqlite:///turtle_album.db", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Get CB-2026 series
        series = db.query(Series).filter(Series.name == "CB-2026").first()
        if not series:
            print("Series CB-2026 not found")
            return

        # Create great-grandparents (generation -3)
        # Paternal-paternal line
        ggf_pp = create_breeder(db, series.id, "CB-GGF-PP", "曾祖父(父父)", "male", image_url=MALE_IMAGES[0])
        ggm_pp = create_breeder(db, series.id, "CB-GGM-PP", "曾祖母(父父)", "female", image_url=FEMALE_IMAGES[0])

        # Paternal-maternal line
        ggf_pm = create_breeder(db, series.id, "CB-GGF-PM", "曾祖父(父母)", "male", image_url=MALE_IMAGES[1])
        ggm_pm = create_breeder(db, series.id, "CB-GGM-PM", "曾祖母(父母)", "female", image_url=FEMALE_IMAGES[1])

        # Maternal-paternal line
        ggf_mp = create_breeder(db, series.id, "CB-GGF-MP", "曾祖父(母父)", "male", image_url=MALE_IMAGES[2])
        ggm_mp = create_breeder(db, series.id, "CB-GGM-MP", "曾祖母(母父)", "female", image_url=FEMALE_IMAGES[2])

        # Maternal-maternal line
        ggf_mm = create_breeder(db, series.id, "CB-GGF-MM", "曾祖父(母母)", "male", image_url=MALE_IMAGES[3])
        ggm_mm = create_breeder(db, series.id, "CB-GGM-MM", "曾祖母(母母)", "female", image_url=FEMALE_IMAGES[3])

        db.flush()

        # Create grandparents (generation -2)
        gf_p = create_breeder(db, series.id, "CB-GF-P", "祖父(父方)", "male",
                             sire_code=ggf_pp.code, dam_code=ggm_pp.code, image_url=MALE_IMAGES[0])
        gm_p = create_breeder(db, series.id, "CB-GM-P", "祖母(父方)", "female",
                             sire_code=ggf_pm.code, dam_code=ggm_pm.code, image_url=FEMALE_IMAGES[0])

        gf_m = create_breeder(db, series.id, "CB-GF-M", "祖父(母方)", "male",
                             sire_code=ggf_mp.code, dam_code=ggm_mp.code, image_url=MALE_IMAGES[1])
        gm_m = create_breeder(db, series.id, "CB-GM-M", "祖母(母方)", "female",
                             sire_code=ggf_mm.code, dam_code=ggm_mm.code, image_url=FEMALE_IMAGES[1])

        db.flush()

        # Update CBM-001 (father) to have parents
        father = db.query(Product).filter(Product.code == "CBM-001").first()
        if father:
            father.sire_code = gf_p.code
            father.dam_code = gm_p.code
            # Add image if missing
            existing_img = db.query(ProductImage).filter(ProductImage.product_id == father.id).first()
            if not existing_img:
                db.add(ProductImage(
                    product_id=father.id,
                    url=MALE_IMAGES[2],
                    alt=f"{father.code} main",
                    type="main",
                    sort_order=0,
                ))

        # Create mother (generation -1)
        mother = create_breeder(db, series.id, "CBF-M01", "CB 种母 M01", "female",
                               sire_code=gf_m.code, dam_code=gm_m.code, image_url=FEMALE_IMAGES[2])

        # Create father's siblings
        father_sib1 = create_breeder(db, series.id, "CBM-S01", "CB 种公 S01(父兄弟)", "male",
                                     sire_code=gf_p.code, dam_code=gm_p.code, image_url=MALE_IMAGES[3])
        father_sib2 = create_breeder(db, series.id, "CBF-S01", "CB 种母 S01(父姐妹)", "female",
                                     sire_code=gf_p.code, dam_code=gm_p.code, image_url=FEMALE_IMAGES[3])

        # Create mother's siblings
        mother_sib1 = create_breeder(db, series.id, "CBM-S02", "CB 种公 S02(母兄弟)", "male",
                                     sire_code=gf_m.code, dam_code=gm_m.code, image_url=MALE_IMAGES[0])
        mother_sib2 = create_breeder(db, series.id, "CBF-S02", "CB 种母 S02(母姐妹)", "female",
                                     sire_code=gf_m.code, dam_code=gm_m.code, image_url=FEMALE_IMAGES[0])

        db.flush()

        # Update CBF-002 to have mother
        current = db.query(Product).filter(Product.code == "CBF-002").first()
        if current:
            current.dam_code = mother.code
            # Add image if missing
            existing_img = db.query(ProductImage).filter(ProductImage.product_id == current.id).first()
            if not existing_img:
                db.add(ProductImage(
                    product_id=current.id,
                    url=FEMALE_IMAGES[1],
                    alt=f"{current.code} main",
                    type="main",
                    sort_order=0,
                ))

        # Create siblings for CBF-002
        sib1 = create_breeder(db, series.id, "CBF-SIB1", "CB 种母 SIB1(同胞姐妹)", "female",
                             sire_code=father.code, dam_code=mother.code, image_url=FEMALE_IMAGES[2])
        sib2 = create_breeder(db, series.id, "CBM-SIB1", "CB 种公 SIB1(同胞兄弟)", "male",
                             sire_code=father.code, dam_code=mother.code, image_url=MALE_IMAGES[1])

        # Create offspring for CBF-002 (generation +1)
        child1 = create_breeder(db, series.id, "CBF-C01", "CB 子代 C01", "female",
                               sire_code="CBM-002", dam_code=current.code, image_url=FEMALE_IMAGES[3])
        child2 = create_breeder(db, series.id, "CBM-C01", "CB 子代 C01", "male",
                               sire_code="CBM-002", dam_code=current.code, image_url=MALE_IMAGES[2])
        child3 = create_breeder(db, series.id, "CBF-C02", "CB 子代 C02", "female",
                               sire_code="CBM-002", dam_code=current.code, image_url=FEMALE_IMAGES[0])

        db.commit()
        print("Successfully added family tree data!")
        print(f"- 8 great-grandparents")
        print(f"- 4 grandparents")
        print(f"- 2 parents (updated CBM-001, added CBF-M01)")
        print(f"- 4 parent siblings")
        print(f"- 1 current (CBF-002)")
        print(f"- 2 siblings")
        print(f"- 3 offspring")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
