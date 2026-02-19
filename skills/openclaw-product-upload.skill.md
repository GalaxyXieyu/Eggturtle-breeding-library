# OpenClaw Product Upload Skill

Upload products to TurtleAlbum backend with guided workflow, validation, and environment safety.

## Usage

```
/openclaw upload-product
```

## Skill Behavior

This skill guides users through uploading a product to the TurtleAlbum backend API via an interactive workflow.

### Key Features

1. **Environment Safety**: Supports dev/staging/prod with explicit production confirmation
2. **Guided Workflow**: Step-by-step collection of required and optional fields
3. **Data Validation**: Multi-level validation with quality scoring
4. **Image Handling**: Support for multiple image types with optimization
5. **Error Recovery**: Comprehensive error handling with helpful suggestions

## Workflow Phases

### Phase 1: Environment Selection

Ask user to select target environment:
- **dev**: http://localhost:8000 (default, safe for testing)
- **staging**: https://staging.turtlealbum.com (pre-production testing)
- **prod**: https://turtlealbum.com (⚠️ requires explicit "CONFIRM" keyword)

**Default**: Always default to `dev` unless explicitly specified.

**Production Safety**:
- Show clear warning with target URL
- Require user to type "CONFIRM" (case-sensitive)
- Log all production uploads for audit

### Phase 2: Authentication

Authenticate with the backend API:
```
POST {base_url}/api/auth/login
{
  "username": "admin",
  "password": "***"
}
```

Store the access token for subsequent requests.

### Phase 3: Required Fields Collection

Collect the following required fields:

1. **Product Code** (code)
   - Format: 3-20 characters, alphanumeric with hyphens
   - Pattern: `^[A-Z0-9-]+$`
   - Must be unique in database
   - Example: "CBF-001", "TURTLE-M-001"

2. **Product Name** (name)
   - Length: 3-100 characters
   - Should be descriptive and meaningful
   - Example: "Ceramic Bowl Feeder", "Male Turtle - CB 2026"

3. **Shape** (shape)
   - Should match existing values in database
   - Common values: "Round", "Square", "Rectangular", "Oval"
   - Suggest from existing products

4. **Material** (material)
   - Should match existing values in database
   - Common values: "Ceramic", "Plastic", "Stainless Steel", "Glass"
   - Suggest from existing products

5. **Factory Price** (factory_price)
   - Must be > 0
   - Reasonable range: 1-10000 (warn if outside)
   - Format: Float with 2 decimal places

**Collection Format**:
```
Please provide the required information:

Code: [product code]
Name: [product name]
Shape: [shape]
Material: [material]
Price: [factory price]
```

### Phase 4: Data Validation

Validate collected data with three levels:

#### Level 1: Critical (Must Pass)
- Code format and uniqueness
- Name quality (not generic)
- Price > 0 and reasonable
- Shape and material not empty

#### Level 2: Important (Warn if Missing)
- Description (recommended 20-500 chars)
- At least 1 main image
- Dimensions for physical products

#### Level 3: Optional (Nice to Have)
- Series assignment
- Lineage information (for turtles)
- Inventory details

**Validation Output**:
```
✅ Validation Results:
- Code: CBF-001 (unique, valid format)
- Name: Ceramic Bowl Feeder (good quality)
- Shape: Round (matches existing)
- Material: Ceramic (matches existing)
- Price: 25.50 (reasonable)

⚠️ Recommendations:
- Add description (improves SEO and user understanding)
- Upload at least 1 main image (required for display)
- Consider adding dimensions (helps with shipping)

Quality Score: 7/10 (Good)

Continue? (yes/no)
```

### Phase 5: Optional Fields Collection

Ask user which optional fields to add:

1. **Description** (description)
   - Recommended length: 20-500 characters
   - Should describe features, benefits, and use cases

2. **Product Type** (product_type)
   - Options: 'tube', 'box', 'turtle'
   - Determines which sub-fields are relevant

3. **Dimensions** (dimensions)
   - weight (float): Product weight in kg
   - length (float): Length in cm
   - width (float): Width in cm
   - height (float): Height in cm
   - capacity (object): {min: float, max: float} in ml
   - compartments (int): Number of compartments

4. **Series Assignment** (series_id)
   - Link to existing series
   - Fetch available series from API: `GET /api/series`
   - Show series code and name for selection

5. **Turtle-Specific Fields** (if product_type = 'turtle')
   - sex: 'male' or 'female'
   - offspring_unit_price (float): Price for offspring (female only)
   - sire_code (string): Father's product code
   - dam_code (string): Mother's product code
   - sire_image_url (string): Father's image URL
   - dam_image_url (string): Mother's image URL

6. **Product Classification**
   - tube_type (string): Specific tube type
   - box_type (string): Specific box type
   - process_type (string): Manufacturing process
   - functional_designs (list): Comma-separated features

7. **Inventory Details**
   - cost_price (float): Cost price
   - has_sample (boolean): Sample availability
   - box_dimensions (string): Carton dimensions
   - box_quantity (int): Units per carton
   - in_stock (boolean): Stock status
   - popularity_score (int): Popularity ranking (0-100)
   - is_featured (boolean): Featured flag

**Collection Format**:
```
📝 Optional Information:

Select what to add (comma-separated numbers):
1. Description
2. Product Type (tube/box/turtle)
3. Dimensions
4. Series Assignment
5. Turtle-Specific Fields
6. Product Classification
7. Inventory Details
8. Skip to images

Your choice: [1,3,4]
```

### Phase 6: Image Upload

Handle image uploads with proper typing:

**Image Types**:
- **main**: Primary product image (required, only 1)
- **gallery**: Additional product views (optional, 2-4 recommended)
- **dimensions**: Dimension diagram (optional, 1)
- **detail**: Close-up detail shots (optional, 1-3)

**Image Requirements**:
- Format: JPG, PNG, WebP
- Min size: 800x800px for main image
- Max size: 5MB per image
- Recommended: 1200x1200px, < 500KB

**Upload Process**:
1. Ask user to send images via Feishu
2. Download images from Feishu
3. Validate image format and size
4. Upload to backend API after product creation

**Collection Format**:
```
📸 Image Upload

Please send images in this order:
1. Main product image (required)
2. Gallery images (optional, 2-4 recommended)
3. Dimensions diagram (optional)
4. Detail shots (optional)

Send images one by one or as a batch.
Type 'done' when finished.
```

### Phase 7: Final Confirmation

Show complete product summary and request confirmation:

```
📦 Product Summary:

Required Fields:
- Code: CBF-001
- Name: Ceramic Bowl Feeder
- Shape: Round
- Material: Ceramic
- Factory Price: ¥25.50

Optional Fields:
- Description: High-quality ceramic feeding bowl for reptiles...
- Product Type: box
- Dimensions: 15x15x5 cm, 0.5 kg
- Series: CB-2026
- In Stock: Yes

Images:
- Main: 1
- Gallery: 3
- Total: 4

Target Environment: prod (https://turtlealbum.com)

⚠️ PRODUCTION UPLOAD - Type 'CONFIRM' to proceed
(or 'cancel' to abort)
```

### Phase 8: API Upload

Execute the upload in two steps:

**Step 1: Create Product**
```
POST {base_url}/api/admin/products
Headers:
  Authorization: Bearer {access_token}
  Content-Type: application/json

Body:
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
  "series_id": "...",
  "in_stock": true,
  "images": []
}
```

**Step 2: Upload Images** (if any)
```
POST {base_url}/api/admin/products/{product_id}/images
Headers:
  Authorization: Bearer {access_token}
  Content-Type: multipart/form-data

Body:
  images: [file1, file2, ...]
```

### Phase 9: Result & Confirmation

Show upload result with details:

```
✅ Success!

Product Created:
- Code: CBF-001
- Product ID: abc-123-def-456
- View URL: https://turtlealbum.com/products/CBF-001

Upload Summary:
- Product data: ✅
- Images uploaded: 4 (1 main, 3 gallery)
- Series assigned: CB-2026
- Status: In Stock

Next Steps:
- Verify product on website
- Update inventory if needed
- Add to featured products (optional)
```

## Error Handling

### Authentication Errors
```
❌ Authentication Failed

Error: Invalid credentials
Action: Please check your username and password

Retry? (yes/no)
```

### Duplicate Code Error
```
❌ Product Code Already Exists

Error: Product code "CBF-001" is already in use
Existing Product: Ceramic Bowl Feeder (ID: xyz-789)

Options:
1. Use a different code (e.g., CBF-002)
2. Update existing product
3. Cancel upload

Your choice: [1-3]
```

### Image Upload Error
```
❌ Image Upload Failed

Error: Image too large (6.2 MB > 5 MB limit)
File: main-image.jpg

Suggestions:
- Compress image to < 5 MB
- Resize to 1200x1200px
- Convert to WebP format

Retry with compressed image? (yes/no)
```

### Network Error
```
❌ Network Error

Error: Connection timeout to https://turtlealbum.com
Attempt: 1/3

Retrying in 5 seconds...
```

### Validation Error
```
❌ Validation Failed

Errors:
- Code: Must be 3-20 characters (current: 2)
- Price: Must be > 0 (current: -10)
- Shape: Cannot be empty

Please fix the errors and try again.
```

## Data Quality Scoring

Calculate quality score based on completeness:

**Scoring Criteria**:
- Required fields complete: +5 points
- Description provided: +1 point
- Images uploaded: +1 point per image (max +3)
- Dimensions provided: +1 point
- Series assigned: +1 point
- Inventory details: +1 point

**Quality Levels**:
- 10/10: Excellent (all fields complete)
- 7-9/10: Good (most fields complete)
- 5-6/10: Fair (required + some optional)
- 0-4/10: Poor (only required fields)

**Display**:
```
Quality Score: 8/10 (Good)

Completeness:
✅ Required fields
✅ Description
✅ Images (4)
✅ Dimensions
✅ Series
⚠️ Inventory details (missing)

Recommendation: Add inventory details to reach 10/10
```

## Environment Configuration

### Development
```
BASE_URL: http://localhost:8000
SAFE_MODE: true
REQUIRE_CONFIRMATION: false
LOG_LEVEL: debug
```

### Staging
```
BASE_URL: https://staging.turtlealbum.com
SAFE_MODE: true
REQUIRE_CONFIRMATION: false
LOG_LEVEL: info
```

### Production
```
BASE_URL: https://turtlealbum.com
SAFE_MODE: false
REQUIRE_CONFIRMATION: true
CONFIRMATION_KEYWORD: "CONFIRM"
LOG_LEVEL: info
AUDIT_LOG: true
```

## Security Best Practices

1. **Never log passwords or tokens**
2. **Always validate input before API calls**
3. **Use HTTPS for all API requests**
4. **Implement rate limiting (max 10 uploads/min)**
5. **Sanitize user input to prevent injection**
6. **Validate file types and sizes before upload**
7. **Require explicit confirmation for production**
8. **Log all production uploads for audit trail**

## API Reference

### Authentication
```
POST /api/auth/login
Body: { "username": "admin", "password": "***" }
Response: { "access_token": "...", "token_type": "bearer" }
```

### Get Series List
```
GET /api/series
Response: { "data": [{ "id": "...", "code": "...", "name": "..." }] }
```

### Create Product
```
POST /api/admin/products
Headers: Authorization: Bearer {token}
Body: { ProductCreate schema }
Response: { "data": { ProductResponse }, "message": "..." }
```

### Upload Images
```
POST /api/admin/products/{product_id}/images
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data
Body: { "images": [files] }
Response: { "data": { "images": [...] }, "message": "..." }
```

### Get Product
```
GET /api/products/{product_id}
Response: { "data": { ProductResponse } }
```

## Testing Checklist

- [ ] Test with dev environment
- [ ] Test with staging environment
- [ ] Test with production (with confirmation)
- [ ] Test duplicate code handling
- [ ] Test image upload (single and batch)
- [ ] Test validation errors
- [ ] Test network errors and retry
- [ ] Test authentication failure
- [ ] Test all optional fields
- [ ] Test quality scoring
- [ ] Test production confirmation safeguard
- [ ] Test audit logging

## Future Enhancements

1. **Batch Upload**: Support Excel + ZIP via existing batch import API
2. **Template Support**: Save and reuse product templates
3. **Image Recognition**: Auto-detect product type from images
4. **Smart Suggestions**: Auto-complete from existing products
5. **Audit Trail**: Track and rollback uploads
6. **Multi-language**: Support Chinese and English
7. **Price Calculator**: Suggest pricing based on similar products
8. **Inventory Sync**: Auto-update inventory from external systems

## Example Usage

### Simple Upload (Required Fields Only)
```
User: /openclaw upload-product
Bot: Select environment: 1) dev 2) staging 3) prod
User: 1
Bot: Please provide required information...
User:
  Code: CBF-001
  Name: Ceramic Bowl Feeder
  Shape: Round
  Material: Ceramic
  Price: 25.50
Bot: ✅ Validation passed. Quality: 5/10. Continue? (yes/no)
User: yes
Bot: Upload images? (yes/no)
User: no
Bot: ✅ Product created! ID: abc-123
```

### Complete Upload (All Fields)
```
User: /openclaw upload-product
Bot: Select environment: 1) dev 2) staging 3) prod
User: 3
Bot: ⚠️ PRODUCTION selected. Continue? Type 'CONFIRM'
User: CONFIRM
Bot: Please provide required information...
User:
  Code: TURTLE-M-001
  Name: Male Turtle - CB 2026
  Shape: N/A
  Material: N/A
  Price: 1500.00
Bot: ✅ Validation passed. Add optional fields?
User: yes
Bot: Select options: 1) Description 2) Type 3) Dimensions...
User: 1,2,5
Bot: [Collects description, type, turtle-specific fields]
Bot: Upload images?
User: yes
Bot: Send main image...
User: [sends image]
Bot: Send gallery images or type 'done'
User: [sends 3 images]
User: done
Bot: 📦 Summary: [shows complete summary]
Bot: Type 'CONFIRM' to upload to PRODUCTION
User: CONFIRM
Bot: ⏳ Uploading...
Bot: ✅ Success! Product ID: xyz-789
```

## Notes

- This skill is designed for Feishu integration but can be adapted for other platforms
- All API endpoints require authentication except public product views
- Images are automatically optimized by the backend (thumbnails, WebP conversion)
- The skill maintains conversation state throughout the workflow
- Production uploads are logged for compliance and audit purposes
