#!/usr/bin/env python3
"""
文件处理工具模块
提供图片上传、优化、删除等功能
"""

import os
import shutil
import uuid
from typing import List, Dict, Any
from fastapi import UploadFile
from PIL import Image, ImageOps
from pathlib import Path

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except:
    pass

# 配置（支持环境变量）
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "static/images")
IMAGES_DIR = UPLOAD_DIR
STATIC_DIR = os.path.dirname(UPLOAD_DIR) if "/" in UPLOAD_DIR else "static"
CAROUSEL_DIR = os.path.join(IMAGES_DIR, "carousel")
QR_CODES_DIR = os.path.join(STATIC_DIR, "qr_codes")

# 确保目录存在
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(CAROUSEL_DIR, exist_ok=True)
os.makedirs(QR_CODES_DIR, exist_ok=True)

def optimize_single_image(input_path: str, output_path: str, size=None, quality=85, format='JPEG', crop_square: bool = False):
    """优化单张图片"""
    try:
        with Image.open(input_path) as img:
            # 转换为RGB模式（确保兼容性）
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            # 自动旋转（处理EXIF信息）
            img = ImageOps.exif_transpose(img)
            
            # Optional center-crop to square (used by turtle-album: 1:1 everywhere)
            if crop_square:
                w, h = img.size
                side = min(w, h)
                left = (w - side) // 2
                top = (h - side) // 2
                img = img.crop((left, top, left + side, top + side))

            # 调整尺寸
            if size:
                if crop_square:
                    # After square-crop we can do an exact resize without padding.
                    img = img.resize(size, Image.Resampling.LANCZOS)
                else:
                    # 保持宽高比
                    img.thumbnail(size, Image.Resampling.LANCZOS)

                    # 如果需要确切的尺寸，在中心创建新图片
                    if img.size != size:
                        new_img = Image.new('RGB', size, (255, 255, 255))
                        paste_x = (size[0] - img.size[0]) // 2
                        paste_y = (size[1] - img.size[1]) // 2
                        new_img.paste(img, (paste_x, paste_y))
                        img = new_img
            
            # 确保输出目录存在
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # 保存优化后的图片
            save_params = {'format': format}
            if format == 'JPEG':
                save_params.update({
                    'quality': quality,
                    'optimize': True,
                    'progressive': True
                })
            elif format == 'WebP':
                save_params.update({
                    'quality': quality,
                    'method': 6,
                    'lossless': False
                })
            
            img.save(output_path, **save_params)
            return True
            
    except Exception as e:
        print(f"Error optimizing image {input_path}: {e}")
        return False

async def save_multiple_files(files: List[UploadFile], subfolder: str) -> List[Dict[str, Any]]:
    """保存多个文件到指定子文件夹"""
    if not files:
        return []
    
    saved_files = []
    dest_dir = os.path.join(STATIC_DIR, subfolder)
    os.makedirs(dest_dir, exist_ok=True)
    
    for file in files:
        if file.filename:
            # 生成唯一文件名
            file_extension = Path(file.filename).suffix.lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = os.path.join(dest_dir, unique_filename)
            
            # 保存文件
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            # 返回相对路径
            relative_path = f"{subfolder}/{unique_filename}"
            
            saved_files.append({
                "filename": unique_filename,
                "original_name": file.filename,
                "url": relative_path,
                "size": len(content)
            })
    
    return saved_files

async def save_carousel_image(file: UploadFile) -> str:
    """保存轮播图片，进行优化处理"""
    if not file.filename:
        raise ValueError("No filename provided")
    
    # 生成唯一文件名
    file_extension = Path(file.filename).suffix.lower()
    unique_filename = f"carousel-{uuid.uuid4()}.jpg"  # 统一转换为jpg
    temp_path = f"/tmp/{uuid.uuid4()}{file_extension}"
    final_path = os.path.join(CAROUSEL_DIR, unique_filename)
    
    try:
        # 先保存临时文件
        content = await file.read()
        with open(temp_path, "wb") as buffer:
            buffer.write(content)
        
        # 优化图片 - 轮播图需要更大尺寸
        success = optimize_single_image(
            temp_path, 
            final_path, 
            size=(1920, 1080),  # 轮播图尺寸
            quality=90, 
            format='JPEG'
        )
        
        if not success:
            raise Exception("Failed to optimize carousel image")
        
        # 返回相对路径
        return f"images/carousel/{unique_filename}"
        
    finally:
        # 清理临时文件
        if os.path.exists(temp_path):
            os.remove(temp_path)

async def save_product_images_optimized(files: List[UploadFile], product_code: str) -> List[Dict[str, Any]]:
    """保存并优化产品图片，生成多个尺寸"""
    if not files:
        return []
    
    # 定义尺寸
    sizes = {
        'thumbnail': (150, 150),
        'small': (300, 300),
        'medium': (500, 500), 
        'large': (800, 800)
    }
    
    # 创建产品图片目录
    product_dir = os.path.join(IMAGES_DIR, product_code)
    os.makedirs(product_dir, exist_ok=True)
    
    # 为每个尺寸创建子目录
    for size_name in sizes.keys():
        size_dir = os.path.join(product_dir, size_name)
        os.makedirs(size_dir, exist_ok=True)
    
    saved_images = []
    
    for i, file in enumerate(files):
        if not file.filename:
            continue
            
        # 生成唯一文件名
        file_stem = Path(file.filename).stem
        file_extension = Path(file.filename).suffix.lower()
        unique_stem = f"{file_stem}_{uuid.uuid4().hex[:8]}"
        temp_path = f"/tmp/{uuid.uuid4()}{file_extension}"
        
        try:
            # 先保存临时文件
            content = await file.read()
            with open(temp_path, "wb") as buffer:
                buffer.write(content)
            
            # 保存原图（JPEG和WebP格式）
            original_jpg = os.path.join(product_dir, f"{unique_stem}.jpg")
            original_webp = os.path.join(product_dir, f"{unique_stem}.webp")
            
            optimize_single_image(temp_path, original_jpg, None, quality=90, format='JPEG', crop_square=True)
            optimize_single_image(temp_path, original_webp, None, quality=80, format='WebP', crop_square=True)
            
            # 生成各种尺寸
            for size_name, size_dims in sizes.items():
                # JPEG版本
                jpg_path = os.path.join(product_dir, size_name, f"{unique_stem}.jpg")
                optimize_single_image(temp_path, jpg_path, size_dims, quality=85, format='JPEG', crop_square=True)
                
                # WebP版本
                webp_path = os.path.join(product_dir, size_name, f"{unique_stem}.webp")
                optimize_single_image(temp_path, webp_path, size_dims, quality=80, format='WebP', crop_square=True)
            
            # 返回图片信息
            relative_path = f"images/{product_code}/{unique_stem}.jpg"
            image_type = "main" if i == 0 else "gallery"
            
            saved_images.append({
                "url": relative_path,
                "alt": f"{product_code} - Image {i+1}",
                "type": image_type,
                "filename": f"{unique_stem}.jpg",
                "original_name": file.filename
            })
            
        finally:
            # 清理临时文件
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    return saved_images

def delete_file(file_path: str) -> bool:
    """删除文件及其所有尺寸版本"""
    if not file_path:
        return True
        
    try:
        # 如果是产品图片，删除所有相关文件
        if file_path.startswith("images/") and "/" in file_path:
            parts = file_path.replace("images/", "").split("/")
            if len(parts) >= 2:
                product_code = parts[0]
                filename = parts[1]
                file_stem = Path(filename).stem
                
                product_dir = os.path.join(IMAGES_DIR, product_code)
                
                # 删除原图
                for ext in ['.jpg', '.webp']:
                    original_file = os.path.join(product_dir, f"{file_stem}{ext}")
                    if os.path.exists(original_file):
                        os.remove(original_file)
                
                # 删除各种尺寸版本
                sizes = ['thumbnail', 'small', 'medium', 'large']
                for size in sizes:
                    size_dir = os.path.join(product_dir, size)
                    for ext in ['.jpg', '.webp']:
                        size_file = os.path.join(size_dir, f"{file_stem}{ext}")
                        if os.path.exists(size_file):
                            os.remove(size_file)
                
                return True
        else:
            # 删除单个文件
            full_path = os.path.join(STATIC_DIR, file_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
        
    except Exception as e:
        print(f"Error deleting file {file_path}: {e}")
        return False
    
    return True

def get_file_info(file_path: str) -> Dict[str, Any]:
    """获取文件信息"""
    full_path = os.path.join(STATIC_DIR, file_path)
    
    if not os.path.exists(full_path):
        return {"exists": False}
    
    stat = os.stat(full_path)
    return {
        "exists": True,
        "size": stat.st_size,
        "modified": stat.st_mtime,
        "path": file_path
    }

def cleanup_empty_dirs():
    """清理空目录"""
    for root, dirs, files in os.walk(IMAGES_DIR, topdown=False):
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            try:
                if not os.listdir(dir_path):  # 目录为空
                    os.rmdir(dir_path)
            except OSError:
                pass  # 目录可能不为空或有其他问题