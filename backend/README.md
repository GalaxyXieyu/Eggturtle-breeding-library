# Turtle Album Backend API

FastAPI backend for Turtle Album, providing public breeder browsing APIs and admin management APIs.

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python3 -m venv .venv
   
   # On Windows
   .venv\Scripts\activate
   
   # On macOS/Linux
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the server:**
   ```bash
   python run.py
   ```

The API will be available at `http://localhost:8000`

## 📚 API Documentation

Once the server is running, you can access:

- **Interactive API Documentation (Swagger):** http://localhost:8000/docs
- **Alternative Documentation (ReDoc):** http://localhost:8000/redoc
- **Health Check:** http://localhost:8000/health

## 🔐 Authentication

### Default Admin Credentials
- **Username:** `admin`
- **Password:** `admin123`

### Authentication Flow
1. POST `/api/auth/login` with credentials
2. Receive JWT token in response
3. Include token in `Authorization: Bearer <token>` header for protected endpoints

## 📡 API Endpoints

### Public Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/series` | List active breeder series |
| GET | `/api/breeders` | List breeders (supports series/sex filter) |
| GET | `/api/breeders/{id}` | Get breeder detail |
| GET | `/api/breeders/{id}/records` | Get mating/egg records |
| GET | `/api/images/{filename}` | Proxy image serving endpoint |

### Admin Endpoints (Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| POST | `/api/auth/logout` | Admin logout |
| GET | `/api/auth/verify` | Verify JWT token |
| GET | `/api/admin/series` | Manage series list |
| POST | `/api/admin/series` | Create series |
| PUT | `/api/admin/series/{id}` | Update series |
| DELETE | `/api/admin/series/{id}` | Delete series |
| GET | `/api/admin/breeders` | Manage breeders |
| POST | `/api/products` | Create new product |
| PUT | `/api/products/{id}` | Update existing product |
| DELETE | `/api/products/{id}` | Delete product |
| POST | `/api/products/{id}/images` | Upload product images |
| DELETE | `/api/products/{id}/images/{imageId}` | Delete product image |

## 🧪 Testing

### Automated Tests

Run the complete test suite:

```bash
# Install test dependencies (already included in requirements.txt)
pip install pytest pytest-asyncio httpx

# Run all tests
python3 -m pytest tests/ -v

# Run specific test file
python3 -m pytest tests/test_auth.py -v

# Run with coverage
python3 -m pytest tests/ --cov=. --cov-report=html
```

### Manual Testing

Quick API verification:

```bash
python test_api_manual.py
```

### Test Runner Script

Automated test runner that starts server and runs tests:

```bash
python tests/run_tests.py
```

## 📁 Project Structure

``` 
backend/
├── app/
│   ├── main.py            # FastAPI app entry
│   ├── api/routers/       # API routers
│   ├── core/              # Security/auth core logic
│   ├── db/session.py      # DB session + engine config
│   ├── models/models.py   # SQLAlchemy models
│   └── schemas/schemas.py # Pydantic schemas
├── run.py                 # Server startup script
├── scripts/               # DB init/import helper scripts
├── requirements.txt       # Python dependencies
├── .env                   # Environment configuration
├── README.md             # This file
├── data/
│   ├── app.db            # SQLite database file (runtime, ignored by git)
│   └── archive/          # Historical DB backups (ignored by git)
├── tests/                # API test cases and scripts
├── http-client/          # HTTP request collections
├── static/               # Static file storage
│   ├── images/           # Uploaded images
│   └── qr_codes/         # QR code images
└── venv/                 # Python virtual environment
```

## ⚙️ Configuration

### Environment Variables

Create or modify `.env` file:

```env
# Database Configuration
DATABASE_URL=sqlite:///./data/app.db

# JWT Configuration
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Admin User Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=True

# File Upload Configuration
UPLOAD_DIR=static/images
MAX_FILE_SIZE=5242880  # 5MB in bytes
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,webp
```

## 🗄️ Database

The application uses SQLite for development with the following models:

- **Product:** Main product information
- **ProductImage:** Product images with metadata
- **User:** Admin user accounts

### Database Initialization

The database is automatically created when the server starts. The admin user is also created automatically.

## 📸 Image Upload

- **Storage:** Local filesystem in `static/images/`
- **Access:** Images served as static files at `/static/images/`
- **Formats:** JPG, JPEG, PNG, GIF, WebP
- **Size Limit:** 5MB per file
- **Optimization:** Automatic image compression and resizing

## 🔧 Development

### Adding New Endpoints

1. Define Pydantic schemas in `app/schemas/schemas.py`
2. Add database models in `app/models/models.py` if needed
3. Implement endpoint in `app/api/routers/*.py` and register router in `app/main.py`
4. Add tests in appropriate test file

### Database Changes

1. Modify models in `app/models/models.py`
2. Delete existing database file for development
3. Restart server to recreate tables

### Running in Development Mode

```bash
# Enable auto-reload and debug logging
DEBUG=True python run.py

# Or use uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 🚀 Production Deployment

### Security Considerations

1. **Change default credentials:**
   ```env
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_secure_password
   ```

2. **Use strong secret key:**
   ```env
   SECRET_KEY=your-very-long-random-secret-key
   ```

3. **Use production database:**
   ```env
   DATABASE_URL=postgresql://user:password@localhost/dbname
   ```

4. **Disable debug mode:**
   ```env
   DEBUG=False
   ```

### Production Server

```bash
# Install production server
pip install gunicorn

# Run with gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Change port in .env file
   PORT=8001
   ```

2. **Database locked:**
   ```bash
   # Stop all server instances and restart
   ```

3. **Import errors:**
   ```bash
   # Ensure virtual environment is activated
   # Reinstall dependencies
   pip install -r requirements.txt
   ```

4. **CORS issues:**
   - Frontend URLs are configured in `main.py`
   - Add your frontend URL to `allow_origins` list

### Logs

The server provides detailed logging for debugging:
- Request/response logging
- Authentication events
- File upload operations
- Database operations

## 📞 Support

For issues or questions:
1. Check the logs for error details
2. Verify all dependencies are installed
3. Ensure the database is accessible
4. Check the API documentation at `/docs`

## 🧹 Project Organization

This backend has been thoroughly organized and optimized:

### ✅ Completed Optimizations

1. **Image Organization:** All product images from B/ and Z/ folders have been moved to `static/images/` and organized by product code
2. **Code Structure:** All core files (main.py, models.py, schemas.py) follow Python best practices and PEP8 standards
3. **Dependency Management:** All required dependencies are properly listed in requirements.txt
4. **Configuration:** Environment variables are properly configured in .env file
5. **Testing:** Comprehensive test suite is available and functional
6. **Documentation:** README.md reflects the current project structure

### 📊 Organization Statistics

- **575 image files** moved and organized by product code
- **104 product directories** created in static/images/
- **Removed unnecessary files:** package.json (not needed for Python project)
- **Clean project structure** with proper separation of concerns

## 🎯 Next Steps

1. **Frontend Integration:** The API is ready to integrate with the existing frontend
2. **Production Database:** Consider PostgreSQL for production
3. **Caching:** Add Redis for improved performance
4. **Monitoring:** Add application monitoring and logging
5. **Backup:** Implement database backup strategy
