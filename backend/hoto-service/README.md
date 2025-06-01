# HOTO Service

A RESTful API service for managing HOTO (Handover-Takeover) operations in the survey tool system.

## Features

- ✅ Complete CRUD operations for HOTO records
- ✅ Advanced filtering by multiple parameters
- ✅ Pagination support
- ✅ Location-based queries
- ✅ Type-based queries
- ✅ Statistics and analytics
- ✅ Comprehensive error handling
- ✅ Input validation
- ✅ MongoDB integration with Mongoose
- ✅ RESTful API design
- ✅ CORS support
- ✅ Security middleware (Helmet)
- ✅ Request logging (Morgan)

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd hoto-service
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

4. Update the `.env` file with your configuration:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hoto-service
CORS_ORIGIN=*
```

5. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## API Documentation

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### Quick API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hotos` | Get all HOTOs with filtering |
| GET | `/api/hotos/:id` | Get single HOTO |
| POST | `/api/hotos` | Create new HOTO |
| PUT | `/api/hotos/:id` | Update HOTO |
| DELETE | `/api/hotos/:id` | Delete HOTO |
| GET | `/api/hotos/location/:locationId` | Get HOTOs by location |
| GET | `/api/hotos/type/:hotoType` | Get HOTOs by type |
| GET | `/api/hotos/stats` | Get HOTO statistics |
| GET | `/health` | Health check |

### Example Usage

```bash
# Get all block HOTOs for a specific district with status filter
curl "http://localhost:5000/api/hotos?hotoType=block&districtCode=KL01&status=1"

# Create a new HOTO
curl -X POST http://localhost:5000/api/hotos \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "64f8a1b2c3d4e5f6a7b8c9d1",
    "districtCode": "KL01",
    "districtName": "Thiruvananthapuram",
    "blockCode": "BLK001",
    "blockName": "Block Name",
    "hotoType": "block",
    "status": 1,
    "others": {
      "priority": "high",
      "assignedTeam": "Team A"
    },
    "contactPerson": {
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "+919876543210"
    }
  }'
```

## Data Schema

### HOTO Schema

```javascript
{
  _id: ObjectId,
  locationId: ObjectId (required, ref: Location),
  state: String (default: 'kerala'),
  districtCode: String (required),
  districtName: String (required),
  blockCode: String (required),
  blockName: String (required),
  gpCode: String,
  gpName: String,
  ofcCode: String,
  ofcName: String,
  hotoType: String (required, enum: ['block', 'ofc', 'gp']),
  remarks: String,
  latitude: String,
  longitude: String,
  status: Number,
  others: Mixed/Object (any data type),
  contactPerson: {
    name: String (required),
    email: String (required, valid email),
    mobile: String (required),
    description: String
  },
  fields: [{
    sequence: Number (required),
    key: String,
    value: String,
    confirmation: Boolean (default: false),
    remarks: String,
    status: Number,
    others: Mixed/Object (any data type),
    mediaFiles: [{
      url: String (required),
      fileType: String (required),
      description: String,
      latitude: String,
      longitude: String,
      deviceName: String,
      accuracy: Number,
      place: String,
      source: String (enum: ['mobile', 'web'], required)
    }]
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## Project Structure

```
hoto-service/
├── src/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── controllers/
│   │   └── hotoController.js    # HOTO business logic
│   ├── middleware/
│   │   ├── asyncHandler.js      # Async error handler
│   │   └── errorHandler.js      # Global error handler
│   ├── models/
│   │   └── Hoto.js             # Mongoose schema
│   └── routes/
│       └── hotoRoutes.js       # API routes
├── server.js                   # Main server file
├── package.json               # Dependencies and scripts
├── env.example               # Environment variables template
├── README.md                 # This file
└── API_DOCUMENTATION.md      # Detailed API docs
```

## Filtering Options

The API supports filtering by the following parameters:

- `_id` - Filter by HOTO ID
- `locationId` - Filter by location ID
- `hotoType` - Filter by HOTO type (`block`, `ofc`, `gp`)
- `districtCode` - Filter by district code
- `blockCode` - Filter by block code
- `gpCode` - Filter by GP code
- `ofcCode` - Filter by OFC code
- `state` - Filter by state
- `status` - Filter by status (Number)

### Pagination

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 25)

## Error Handling

The service includes comprehensive error handling:

- **Validation Errors**: Mongoose validation errors with detailed messages
- **Cast Errors**: Invalid ObjectId format errors
- **Duplicate Key Errors**: Unique constraint violations
- **404 Errors**: Resource not found
- **500 Errors**: Internal server errors

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing configuration
- **Input Validation**: Mongoose schema validation
- **Error Sanitization**: Prevents sensitive information leakage

## Development

### Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests (not implemented yet)
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/hoto-service |
| `CORS_ORIGIN` | CORS origin configuration | * |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support and questions, please contact the development team. 