# HOTO Service API Documentation

## Overview

The HOTO (Handover-Takeover) Service provides a RESTful API for managing handover and takeover operations in the survey tool system. This service handles CRUD operations for HOTO records with advanced filtering capabilities.

## Base URL

```
http://localhost:5000/api/hotos
```

## Authentication

Currently, the API is public and does not require authentication.

## Data Schema

### HOTO Object Structure

```json
{
  "_id": "ObjectId",
  "locationId": "ObjectId (required, ref: Location)",
  "state": "String (default: 'kerala')",
  "districtCode": "String (required)",
  "districtName": "String (required)",
  "blockCode": "String (required)",
  "blockName": "String (required)",
  "gpCode": "String",
  "gpName": "String",
  "ofcCode": "String",
  "ofcName": "String",
  "hotoType": "String (required, enum: ['handover', 'takeover', 'inspection', 'maintenance'])",
  "remarks": "String",
  "latitude": "String",
  "longitude": "String",
  "contactPerson": {
    "name": "String (required)",
    "email": "String (required, valid email)",
    "mobile": "String (required)",
    "description": "String"
  },
  "others": {
    "key": "String",
    "value": "String",
    "confirmation": "Boolean (default: false)",
    "remarks": "String",
    "mediaFiles": [
      {
        "url": "String (required)",
        "fileType": "String (required)",
        "description": "String",
        "latitude": "String",
        "longitude": "String",
        "deviceName": "String",
        "accuracy": "Number",
        "place": "String",
        "source": "String (enum: ['mobile', 'web'], required)"
      }
    ]
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## API Endpoints

### 1. Get All HOTOs

**GET** `/api/hotos`

Retrieve all HOTO records with optional filtering and pagination.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | String | Filter by HOTO ID |
| `locationId` | String | Filter by location ID |
| `hotoType` | String | Filter by HOTO type |
| `districtCode` | String | Filter by district code |
| `blockCode` | String | Filter by block code |
| `gpCode` | String | Filter by GP code |
| `ofcCode` | String | Filter by OFC code |
| `state` | String | Filter by state |
| `page` | Number | Page number (default: 1) |
| `limit` | Number | Items per page (default: 25) |

#### Example Request

```bash
GET /api/hotos?hotoType=handover&districtCode=KL01&page=1&limit=10
```

#### Example Response

```json
{
  "success": true,
  "count": 10,
  "total": 45,
  "pagination": {
    "next": {
      "page": 2,
      "limit": 10
    }
  },
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "locationId": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
        "name": "Location Name",
        "code": "LOC001"
      },
      "state": "kerala",
      "districtCode": "KL01",
      "districtName": "Thiruvananthapuram",
      "blockCode": "BLK001",
      "blockName": "Block Name",
      "hotoType": "handover",
      "contactPerson": {
        "name": "John Doe",
        "email": "john@example.com",
        "mobile": "+919876543210"
      },
      "createdAt": "2023-09-06T10:30:00.000Z",
      "updatedAt": "2023-09-06T10:30:00.000Z"
    }
  ]
}
```

### 2. Get Single HOTO

**GET** `/api/hotos/:id`

Retrieve a specific HOTO record by ID.

#### Example Request

```bash
GET /api/hotos/64f8a1b2c3d4e5f6a7b8c9d0
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "locationId": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "name": "Location Name",
      "code": "LOC001"
    },
    "state": "kerala",
    "districtCode": "KL01",
    "districtName": "Thiruvananthapuram",
    "blockCode": "BLK001",
    "blockName": "Block Name",
    "gpCode": "GP001",
    "gpName": "GP Name",
    "ofcCode": "OFC001",
    "ofcName": "OFC Name",
    "hotoType": "handover",
    "remarks": "Initial handover process",
    "latitude": "8.5241",
    "longitude": "76.9366",
    "contactPerson": {
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "+919876543210",
      "description": "Project Manager"
    },
    "others": {
      "key": "equipment",
      "value": "surveying tools",
      "confirmation": true,
      "remarks": "All equipment verified",
      "mediaFiles": [
        {
          "url": "https://example.com/image1.jpg",
          "fileType": "image/jpeg",
          "description": "Equipment photo",
          "latitude": "8.5241",
          "longitude": "76.9366",
          "deviceName": "iPhone 14",
          "accuracy": 5.0,
          "place": "Survey Site",
          "source": "mobile"
        }
      ]
    },
    "createdAt": "2023-09-06T10:30:00.000Z",
    "updatedAt": "2023-09-06T10:30:00.000Z"
  }
}
```

### 3. Create New HOTO

**POST** `/api/hotos`

Create a new HOTO record.

#### Request Body

```json
{
  "locationId": "64f8a1b2c3d4e5f6a7b8c9d1",
  "districtCode": "KL01",
  "districtName": "Thiruvananthapuram",
  "blockCode": "BLK001",
  "blockName": "Block Name",
  "gpCode": "GP001",
  "gpName": "GP Name",
  "hotoType": "handover",
  "remarks": "Initial handover process",
  "latitude": "8.5241",
  "longitude": "76.9366",
  "contactPerson": {
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "+919876543210",
    "description": "Project Manager"
  },
  "others": {
    "key": "equipment",
    "value": "surveying tools",
    "confirmation": true,
    "remarks": "All equipment verified",
    "mediaFiles": [
      {
        "url": "https://example.com/image1.jpg",
        "fileType": "image/jpeg",
        "description": "Equipment photo",
        "source": "mobile"
      }
    ]
  }
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "locationId": "64f8a1b2c3d4e5f6a7b8c9d1",
    "state": "kerala",
    "districtCode": "KL01",
    "districtName": "Thiruvananthapuram",
    "blockCode": "BLK001",
    "blockName": "Block Name",
    "gpCode": "GP001",
    "gpName": "GP Name",
    "hotoType": "handover",
    "remarks": "Initial handover process",
    "latitude": "8.5241",
    "longitude": "76.9366",
    "contactPerson": {
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "+919876543210",
      "description": "Project Manager"
    },
    "others": {
      "key": "equipment",
      "value": "surveying tools",
      "confirmation": true,
      "remarks": "All equipment verified",
      "mediaFiles": [
        {
          "url": "https://example.com/image1.jpg",
          "fileType": "image/jpeg",
          "description": "Equipment photo",
          "source": "mobile"
        }
      ]
    },
    "createdAt": "2023-09-06T10:30:00.000Z",
    "updatedAt": "2023-09-06T10:30:00.000Z"
  }
}
```

### 4. Update HOTO

**PUT** `/api/hotos/:id`

Update an existing HOTO record.

#### Request Body

```json
{
  "remarks": "Updated handover process",
  "contactPerson": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "mobile": "+919876543211",
    "description": "Senior Project Manager"
  }
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "locationId": "64f8a1b2c3d4e5f6a7b8c9d1",
    "state": "kerala",
    "districtCode": "KL01",
    "districtName": "Thiruvananthapuram",
    "blockCode": "BLK001",
    "blockName": "Block Name",
    "hotoType": "handover",
    "remarks": "Updated handover process",
    "contactPerson": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "mobile": "+919876543211",
      "description": "Senior Project Manager"
    },
    "createdAt": "2023-09-06T10:30:00.000Z",
    "updatedAt": "2023-09-06T11:45:00.000Z"
  }
}
```

### 5. Delete HOTO

**DELETE** `/api/hotos/:id`

Delete a HOTO record.

#### Example Request

```bash
DELETE /api/hotos/64f8a1b2c3d4e5f6a7b8c9d0
```

#### Example Response

```json
{
  "success": true,
  "data": {}
}
```

### 6. Get HOTOs by Location

**GET** `/api/hotos/location/:locationId`

Retrieve all HOTO records for a specific location.

#### Example Request

```bash
GET /api/hotos/location/64f8a1b2c3d4e5f6a7b8c9d1
```

#### Example Response

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "locationId": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
        "name": "Location Name",
        "code": "LOC001"
      },
      "hotoType": "handover",
      "createdAt": "2023-09-06T10:30:00.000Z"
    }
  ]
}
```

### 7. Get HOTOs by Type

**GET** `/api/hotos/type/:hotoType`

Retrieve all HOTO records of a specific type.

#### Example Request

```bash
GET /api/hotos/type/handover
```

#### Example Response

```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "locationId": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
        "name": "Location Name",
        "code": "LOC001"
      },
      "hotoType": "handover",
      "districtName": "Thiruvananthapuram",
      "createdAt": "2023-09-06T10:30:00.000Z"
    }
  ]
}
```

### 8. Get HOTO Statistics

**GET** `/api/hotos/stats`

Retrieve statistics about HOTO records.

#### Example Request

```bash
GET /api/hotos/stats
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "total": 100,
    "byType": [
      {
        "_id": "handover",
        "count": 45
      },
      {
        "_id": "takeover",
        "count": 30
      },
      {
        "_id": "inspection",
        "count": 15
      },
      {
        "_id": "maintenance",
        "count": 10
      }
    ]
  }
}
```

### 9. Health Check

**GET** `/health`

Check if the service is running.

#### Example Response

```json
{
  "success": true,
  "message": "HOTO Service is running",
  "timestamp": "2023-09-06T10:30:00.000Z"
}
```

## Error Responses

### Validation Error (400)

```json
{
  "success": false,
  "error": "Validation error message"
}
```

### Not Found (404)

```json
{
  "success": false,
  "error": "Hoto not found"
}
```

### Server Error (500)

```json
{
  "success": false,
  "error": "Server Error"
}
```

## Filtering Examples

### Multiple Filters

```bash
GET /api/hotos?hotoType=handover&districtCode=KL01&blockCode=BLK001
```

### Pagination with Filters

```bash
GET /api/hotos?hotoType=takeover&page=2&limit=20
```

### Location-based Filtering

```bash
GET /api/hotos?locationId=64f8a1b2c3d4e5f6a7b8c9d1&state=kerala
```

## Setup and Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp env.example .env
```

3. Update environment variables in `.env` file

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

- `NODE_ENV`: Environment mode (development/production)
- `PORT`: Server port (default: 5000)
- `MONGODB_URI`: MongoDB connection string
- `CORS_ORIGIN`: CORS origin configuration

## Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **cors**: Cross-origin resource sharing
- **helmet**: Security middleware
- **morgan**: HTTP request logger
- **dotenv**: Environment variable loader

## Notes

- All timestamps are in ISO 8601 format
- The `locationId` field references a Location collection
- Media files support both mobile and web sources
- Pagination is available on the main GET endpoint
- All responses follow a consistent format with `success` and `data`/`error` fields 