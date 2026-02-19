# OpenClaw Product Upload Skill Design

## Overview

This document outlines the design for the OpenClaw skill that automates product uploads to the TurtleAlbum backend API via Feishu integration.

## Database Schema Analysis

### Required Fields (Must Collect)
- `code` (VARCHAR, UNIQUE) - Product code (e.g., "CBF-001")
- `name` (VARCHAR) - Product name
- `shape` (VARCHAR) - Product shape
- `material` (VARCHAR) - Material composition
- `factory_price` (FLOAT) - Factory price

### Optional Fields (Collect Based on Context)

#### Basic Information
- `description` (TEXT) - Product description
- `series_id` (VARCHAR) - Link to series (FK to series.id)

#### Turtle-Specific Fields (for breeding animals)
- `sex` (VARCHAR) - 'male' or 'female'
- `offspring_unit_price` (FLOAT) - Price for offspring (female only)
- `sire_code` (VARCHAR) - Father's product code
- `dam_code` (VARCHAR) - Mother's product code
- `sire_image_url` (VARCHAR) - Father's image URL
- `dam_image_url` (VARCHAR) - Mother's image URL

#### Product Classification
- `product_type` (VARCHAR) - 'tube', 'box', or 'turtle'
- `tube_type` (VARCHAR) - Specific tube type
- `box_type` (VARCHAR) - Specific box type
- `process_type` (VARCHAR) - Manufacturing process
- `functional_designs` (VARCHAR) - Comma-separated features

#### Dimensions (JSON Object)
- `weight` (FLOAT) - Product weight
- `length` (FLOAT) - Product length
- `width` (FLOAT) - Product width
- `height` (FLOAT) - Product height
- `capacity` (JSON) - {min: float, max: float}
- `compartments` (INT) - Number of compartments

#### Pricing & Inventory
- `cost_price` (FLOAT) - Cost price
- `has_sample` (BOOLEAN) - Sample availability
- `box_dimensions` (VARCHAR) - Carton dimensions
- `box_quantity` (INTEGER) - Units per carton
- `in_stock` (BOOLEAN) - Stock status
- `popularity_score` (INTEGER) - Popularity ranking
- `is_featured` (BOOLEAN) - Featured flag

### Product Images
- Separate table: `product_images`
- Fields: `url`, `alt`, `type`, `sort_order`
- Types: 'main', 'gallery', 'dimensions', 'detail'

## Data Quality Validation Rules

### Level 1: Critical (Must Pass)
1. **Code Format**
   - Pattern: `^[A-Z0-9-]+$`
   - Length: 3-20 characters
   - Must be unique in database

2. **Name Quality**
   - Length: 3-100 characters
   - Should not be generic (e.g., "Product", "Item")
   - Should contain meaningful description

3. **Factory Price**
   - Must be > 0
   - Should be reasonable (warn if < 1 or > 10000)

4. **Shape & Material**
   - Should not be empty or "N/A"
   - Should match existing values in database (suggest from existing)

### Level 2: Important (Warn if Missing)
1. **Description**
   - Recommended length: 20-500 characters
   - Should describe key features and benefits

2. **Images**
   - At least 1 main image required
   - Recommended: 3-5 gallery images
   - Image quality: min 800x800px for main image

3. **Dimensions**
   - For physical products, dimensions should be provided
   - Weight should be > 0 if provided

### Level 3: Optional (Nice to Have)
1. **Series Assignment**
   - Helps with categorization
   - Improves discoverability

2. **Lineage Information** (for turtles)
   - Sire/dam codes for breeding records
   - Enhances product value

3. **Inventory Details**
   - Box dimensions and quantity
   - Helps with logistics

## Workflow Design

### Phase 1: Environment Selection
```
User: /openclaw upload-product
Bot:
  🌍 Select target environment:
  1. dev (http://localhost:8000)
  2. staging (https://staging.turtlealbum.com)
  3. prod (https://turtlealbum.com) ⚠️ REQUIRES CONFIRMATION

  Reply with number (1-3)
```

### Phase 2: Required Fields Collection
```
Bot: Let's create a new product. I'll guide you through the process.

📋 Required Information:
1. Product Code (e.g., CBF-001)
2. Product Name
3. Shape
4. Material
5. Factory Price

Please provide these in the following format:
---
Code: CBF-001
Name: Ceramic Bowl Feeder
Shape: Round
Material: Ceramic
Price: 25.50
---
```

### Phase 3: Data Validation
```
Bot: ✅ Validation Results:
- Code: CBF-001 (unique, valid format)
- Name: Ceramic Bowl Feeder (good quality)
- Shape: Round (matches existing)
- Material: Ceramic (matches existing)
- Price: 25.50 (reasonable)

⚠️ Recommendations:
- Add description (currently missing)
- Upload at least 1 main image
- Consider adding dimensions

Continue? (yes/no)
```

### Phase 4: Optional Fields Collection
```
Bot: Would you like to add optional information?

📝 Available Options:
1. Description
2. Product Type (tube/box/turtle)
3. Dimensions (weight, size, capacity)
4. Images
5. Series Assignment
6. Inventory Details
7. Skip to upload

Reply with numbers (comma-separated) or 7 to skip
```

### Phase 5: Image Upload
```
Bot: 📸 Image Upload

Please send images in this order:
1. Main product image (required)
2. Gallery images (optional, 2-4 recommended)
3. Dimensions diagram (optional)
4. Detail shots (optional)

Send images one by one or as a batch.
Type 'done' when finished.
```

### Phase 6: Final Confirmation
```
Bot: 📦 Product Summary:

Code: CBF-001
Name: Ceramic Bowl Feeder
Description: High-quality ceramic feeding bowl...
Shape: Round
Material: Ceramic
Price: ¥25.50
Images: 4 (1 main, 3 gallery)

Target: prod (https://turtlealbum.com)

⚠️ PRODUCTION UPLOAD - Type 'CONFIRM' to proceed
```

### Phase 7: Upload & Result
```
Bot: ⏳ Uploading product...

✅ Success!
Product created: CBF-001
Product ID: abc-123-def
View: https://turtlealbum.com/products/CBF-001

📊 Upload Summary:
- Product data: ✅
- Images uploaded: 4
- Series assigned: CB-2026
- Status: In Stock
```

## API Integration

### Authentication
```bash
POST /api/auth/login
{
  "username": "admin",
  "password": "***"
}
# Returns: { "access_token": "...", "token_type": "bearer" }
```

### Create Product
```bash
POST /api/admin/products
Headers: Authorization: Bearer {token}
{
  "code": "CBF-001",
  "name": "Ceramic Bowl Feeder",
  "description": "...",
  "shape": "Round",
  "material": "Ceramic",
  "factory_price": 25.50,
  "dimensions": {
    "weight": 0.5,
    "length": 15.0,
    "width": 15.0,
    "height": 5.0
  },
  "images": []
}
# Returns: { "data": { "id": "...", ... }, "message": "..." }
```

### Upload Images
```bash
POST /api/admin/products/{product_id}/images
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data
{
  "images": [file1, file2, ...]
}
# Returns: { "data": { "images": [...] }, "message": "..." }
```

## Error Handling

### Common Errors
1. **Duplicate Code**
   - Error: "Product code already exists"
   - Action: Suggest alternative code or update existing

2. **Authentication Failed**
   - Error: "Invalid credentials"
   - Action: Re-prompt for credentials

3. **Image Upload Failed**
   - Error: "Image too large" / "Invalid format"
   - Action: Suggest compression or format conversion

4. **Network Error**
   - Error: "Connection timeout"
   - Action: Retry with exponential backoff

### Validation Errors
1. **Invalid Code Format**
   - Show: "Code must be 3-20 characters, alphanumeric with hyphens"
   - Example: "CBF-001" ✅, "cbf 001" ❌

2. **Missing Required Fields**
   - Show: "Missing required fields: [list]"
   - Action: Re-prompt for missing fields

3. **Price Out of Range**
   - Show: "Price seems unusual: ¥{price}. Confirm? (yes/no)"
   - Action: Allow override with confirmation

## Security Considerations

### Environment Protection
1. **Default to Dev**
   - Never default to production
   - Require explicit selection

2. **Production Confirmation**
   - Require typing "CONFIRM" (case-sensitive)
   - Show clear warning with target URL
   - Log all production uploads

3. **Credential Management**
   - Never log passwords
   - Use secure token storage
   - Implement token refresh

### Data Validation
1. **Input Sanitization**
   - Escape special characters
   - Prevent SQL injection
   - Validate file types

2. **Rate Limiting**
   - Max 10 uploads per minute
   - Prevent abuse

## Implementation Checklist

- [ ] Create skill file: `openclaw-product-upload.skill.md`
- [ ] Implement environment selection logic
- [ ] Implement required fields collection
- [ ] Implement validation rules
- [ ] Implement optional fields collection
- [ ] Implement image upload handling
- [ ] Implement API integration
- [ ] Implement error handling
- [ ] Add production confirmation safeguard
- [ ] Add logging and audit trail
- [ ] Test with dev environment
- [ ] Test with staging environment
- [ ] Document usage examples
- [ ] Create user guide

## Future Enhancements

1. **Batch Upload**
   - Support Excel + ZIP upload via API
   - Reuse existing batch import endpoint

2. **Template Support**
   - Save product templates
   - Quick fill from templates

3. **Image Recognition**
   - Auto-detect product type from images
   - Suggest dimensions from images

4. **Smart Suggestions**
   - Suggest series based on product type
   - Auto-complete from existing products
   - Price recommendations based on similar products

5. **Audit Trail**
   - Track all uploads
   - Show upload history
   - Rollback capability
