import os
import sqlite3
import subprocess
import sys
from pathlib import Path


def _init_sqlite(db_file: Path, product_id: str, code_folder: str) -> None:
    conn = sqlite3.connect(db_file)
    try:
        conn.execute(
            """
            CREATE TABLE products (
              id TEXT PRIMARY KEY,
              code TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE product_images (
              id TEXT PRIMARY KEY,
              product_id TEXT NOT NULL,
              url TEXT NOT NULL,
              alt TEXT NOT NULL,
              type TEXT NOT NULL,
              sort_order INTEGER DEFAULT 0,
              created_at TEXT
            );
            """
        )
        conn.execute("INSERT INTO products (id, code) VALUES (?, ?)", (product_id, "P01"))
        conn.execute(
            "INSERT INTO product_images (id, product_id, url, alt, type, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
            ("img-1", product_id, f"images/{code_folder}/a.jpg", "alt", "main", 0),
        )
        conn.commit()
    finally:
        conn.close()


def test_migrate_images_to_product_id_apply(tmp_path: Path) -> None:
    product_id = "550e8400-e29b-41d4-a716-446655440000"
    code_folder = "P01"

    db_file = tmp_path / "app.db"
    images_root = tmp_path / "images"
    images_root.mkdir(parents=True, exist_ok=True)

    # Fake old folder structure (includes size subfolders).
    src = images_root / code_folder
    (src / "thumbnail").mkdir(parents=True, exist_ok=True)
    (src / "small").mkdir(parents=True, exist_ok=True)
    (src / "medium").mkdir(parents=True, exist_ok=True)
    (src / "large").mkdir(parents=True, exist_ok=True)
    (src / "a.jpg").write_bytes(b"jpg")
    (src / "thumbnail" / "a.jpg").write_bytes(b"thumb")

    _init_sqlite(db_file, product_id=product_id, code_folder=code_folder)

    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{db_file.as_posix()}"
    env["UPLOAD_DIR"] = images_root.as_posix()

    script = Path(__file__).resolve().parents[1] / "scripts" / "migrate_images_to_product_id.py"
    proc = subprocess.run(
        [sys.executable, str(script), "--apply"],
        env=env,
        cwd=str(script.parent.parent),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=True,
    )
    assert "OK (apply)." in proc.stdout

    # Folder moved.
    assert not (images_root / code_folder).exists()
    assert (images_root / product_id / "a.jpg").exists()
    assert (images_root / product_id / "thumbnail" / "a.jpg").exists()

    # DB updated.
    conn = sqlite3.connect(db_file)
    try:
        (url,) = conn.execute("SELECT url FROM product_images WHERE id='img-1'").fetchone()
    finally:
        conn.close()

    assert url == f"images/{product_id}/a.jpg"
