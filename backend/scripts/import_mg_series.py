import argparse
import os
import shutil
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Series, Product, ProductImage


def _make_engine(db_url: str):
    return create_engine(
        db_url,
        connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
    )


MG_SERIES_DESCRIPTION = (
    "本组的U公属于F的子代，和本组的母龟属于同父异母。\n"
    "本组母基于编号F5的延续版本，表现特殊作为单独一条血线选育（脖子纹路遗传率很高）。\n"
    "一代母本疑似带果盔基因，大概率是果x果盔的后代，品相偏果核。\n"
    "小时候颜值很高长的跟果核一样当果核收来的。\n"
    "后面出苗发现鼻尖金三角较弱，腹部黑斑较多，判定为携带果盔基因。\n"
    "本组后代选育方向：在保留脖子头纹的前提下，提纯鼻尖金三角。"
)


def _ensure_series(db, *, name: str) -> Series:
    s = db.query(Series).filter(Series.name == name).first()
    if s:
        # Ensure MG stays first in the series tabs.
        s.sort_order = 0
        s.description = MG_SERIES_DESCRIPTION
        return s
    s = Series(name=name, sort_order=0, is_active=True, description=MG_SERIES_DESCRIPTION)
    db.add(s)
    db.flush()
    return s


def _upsert_breeder(
    db,
    *,
    series_id: str,
    code: str,
    description: str,
    offspring_unit_price: float | None,
    image_url: str,
    image_alt: str,
):
    p = db.query(Product).filter(Product.code == code).first()
    if p is None:
        p = Product(
            name=code,
            code=code,
            description=description,
            series_id=series_id,
            sex="female",
            offspring_unit_price=offspring_unit_price,
            # legacy-required fields
            shape="turtle",
            material="n/a",
            price=0.0,
            price=0.0,
            in_stock=True,
            is_featured=False,
        )
        db.add(p)
        db.flush()
    else:
        p.name = code
        p.description = description
        p.series_id = series_id
        p.sex = "female"
        p.offspring_unit_price = offspring_unit_price

    # Ensure single main image
    db.query(ProductImage).filter(ProductImage.product_id == p.id).delete()
    db.add(
        ProductImage(
            product_id=p.id,
            url=image_url,
            alt=image_alt,
            type="main",
            sort_order=0,
        )
    )


def main():
    parser = argparse.ArgumentParser(description="Import MG series females into a sqlite DB using local images.")
    parser.add_argument(
        "--db-url",
        default=os.getenv("DATABASE_URL", "sqlite:///./data/app.db"),
        help="SQLAlchemy DB URL (default: DATABASE_URL or sqlite:///./data/app.db)",
    )
    parser.add_argument(
        "--upload-dir",
        default=os.getenv("UPLOAD_DIR", "static/images"),
        help="Backend upload dir (served at /images). Default: static/images (or env UPLOAD_DIR)",
    )
    parser.add_argument(
        "--series-name",
        default="mg",
        help="Series name to upsert (default: mg)",
    )
    parser.add_argument(
        "--images",
        nargs=5,
        required=True,
        help="5 image paths for MG-01..MG-05 in order",
    )

    args = parser.parse_args()

    upload_dir = Path(args.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    engine = _make_engine(args.db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    mg = [
        ("MG-01", 888.0, "超粗纹  对比度高  发色很黄"),
        ("MG-02", 1000.0, "顶级满纹满脖子"),
        ("MG-03", 788.0, "细满纹  底色很黄"),
        ("MG-04", 888.0, "满纹  粗纹  高黄"),
        ("MG-05", 888.0, "细满纹"),
    ]

    db = SessionLocal()
    try:
        series = _ensure_series(db, name=args.series_name)

        for idx, (code, price, desc) in enumerate(mg):
            src = Path(args.images[idx])
            if not src.exists():
                raise SystemExit(f"Image not found: {src}")

            # Copy into upload dir with deterministic filename.
            dst_name = f"{code.lower().replace('-', '_')}.jpg"
            dst_path = upload_dir / dst_name
            shutil.copyfile(src, dst_path)

            image_url = f"/api/images/{dst_name}"
            _upsert_breeder(
                db,
                series_id=series.id,
                code=code,
                description=desc,
                offspring_unit_price=price,
                image_url=image_url,
                image_alt=f"{code} 主图",
            )

        db.commit()
        print("Imported MG series: MG-01..MG-05")
    finally:
        db.close()


if __name__ == "__main__":
    main()
