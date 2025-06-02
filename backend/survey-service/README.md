# Survey Service API Documentation

## Overview
The Survey Service provides comprehensive CRUD operations for managing survey data with advanced filtering capabilities based on location, survey type, and other parameters.

## Base URL
```
http://localhost:3000/api/surveys
```

## Authentication
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Data Models

### Survey Schema
```json
{
  "name": "string (required)",
  "description": "string (required)",
  "locationId": "ObjectId (required)",
  "stateName": "string",
  "stateCode": "string",
  "districtName": "string",
  "districtCode": "string",
  "blockName": "string",
  "blockCode": "string",
  "latitude": "string (required)",
  "longitude": "string (required)",
  "blockAddress": "string",
  "mediaFiles": [MediaFile],
  "contactPerson": {
    "sdeName": "string",
    "sdeMobile": "string",
    "engineerName": "string",
    "engineerMobile": "string",
    "address": "string"
  },
  "surveyType": "enum: ['block', 'gp', 'ofc'] (required)",
  "fields": [Field],
  "status": "number (default: 1)",
  "createdOn": "Date (required)",
  "createdBy": "ObjectId (required)",
  "updatedOn": "Date (required)",
  "updatedBy": "ObjectId (required)",
  "others": "Mixed"
}
```

### MediaFile Schema
```json
{
  "url": "string (required)",
  "fileType": "enum: ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'] (required)",
  "description": "string",
  "latitude": "string (required)",
  "longitude": "string (required)",
  "deviceName": "string",
  "accuracy": "number",
  "place": "string"
}
```

### Field Schema
```json
{
  "sequence": "number (required)",
  "key": "string (required)",
  "value": "string",
  "fieldType": "enum: ['dropdown', 'text'] (required)",
  "dropdownOptions": ["string"],
  "mediaFiles": [MediaFile],
  "status": "number (default: 1)"
}
```

## API Endpoints

### 1. Create Survey
**POST** `/`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Block Survey 1",
  "description": "Initial block survey for project XYZ",
  "locationId": "64f8b2d5e1a2c3d4e5f6g7h8",
  "stateName": "Maharashtra",
  "stateCode": "MH",
  "districtName": "Pune",
  "districtCode": "PN",
  "blockName": "Hadapsar",
  "blockCode": "HD",
  "latitude": "18.5204",
  "longitude": "73.8567",
  "blockAddress": "Hadapsar, Pune, Maharashtra",
  "surveyType": "block",
  "createdBy": "64f8b2d5e1a2c3d4e5f6g7h9",
  "updatedBy": "64f8b2d5e1a2c3d4e5f6g7h9",
  "contactPerson": {
    "sdeName": "John Doe",
    "sdeMobile": "+91-9876543210",
    "engineerName": "Jane Smith",
    "engineerMobile": "+91-8765432109",
    "address": "Survey Office, Pune"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Survey created successfully",
  "data": {
    "_id": "64f8b2d5e1a2c3d4e5f6g7h0",
    "name": "Block Survey 1",
    // ... full survey object
  }
}
```

### 2. Get All Surveys
**GET** `/`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 100)
- `locationId` (string): Filter by location ID
- `surveyType` (string): Filter by survey type (block, gp, ofc)
- `status` (number): Filter by status
- `stateName` (string): Filter by state name (partial match)
- `districtName` (string): Filter by district name (partial match)
- `blockName` (string): Filter by block name (partial match)
- `createdBy` (string): Filter by creator ID
- `sortBy` (string): Sort field (default: createdOn)
- `sortOrder` (string): Sort order (asc/desc, default: desc)
- `search` (string): Search in name, description, blockAddress
- `createdOnFrom` (string): Filter surveys created after date
- `createdOnTo` (string): Filter surveys created before date

**Example:**
```
GET /api/surveys?locationId=64f8b2d5e1a2c3d4e5f6g7h8&surveyType=block&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8b2d5e1a2c3d4e5f6g7h0",
      "name": "Block Survey 1",
      // ... survey data
    }
  ],
  "pagination": {
    "total": 25,
    "pages": 3,
    "page": 1,
    "limit": 10
  }
}
```

### 3. Get Survey by ID
**GET** `/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f8b2d5e1a2c3d4e5f6g7h0",
    "name": "Block Survey 1",
    // ... full survey object with populated references
  }
}
```

### 4. Update Survey
**PUT** `/:id`

**Authentication:** Required

**Request Body:** (partial update supported)
```json
{
  "name": "Updated Survey Name",
  "description": "Updated description",
  "updatedBy": "64f8b2d5e1a2c3d4e5f6g7h9"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Survey updated successfully",
  "data": {
    // ... updated survey object
  }
}
```

### 5. Delete Survey (Soft Delete)
**DELETE** `/:id`

**Authentication:** Required

**Request Body:**
```json
{
  "updatedBy": "64f8b2d5e1a2c3d4e5f6g7h9"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Survey deleted successfully"
}
```

### 6. Get Surveys by Location
**GET** `/location/:locationId`

**Query Parameters:** Same as Get All Surveys (except locationId)

**Response:** Same format as Get All Surveys

### 7. Get Surveys by Type
**GET** `/type/:surveyType`

**Path Parameters:**
- `surveyType`: block, gp, or ofc

**Query Parameters:** Same as Get All Surveys (except surveyType)

**Response:** Same format as Get All Surveys

### 8. Get Survey Statistics
**GET** `/stats`

**Query Parameters:**
- `locationId` (string): Filter stats by location
- `surveyType` (string): Filter stats by survey type

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSurveys": 150,
    "activeSurveys": 120,
    "blockSurveys": 80,
    "gpSurveys": 45,
    "ofcSurveys": 25,
    "totalMediaFiles": 450,
    "totalFields": 890
  }
}
```

## Media File Management

### 9. Add Media File
**POST** `/:id/media`

**Authentication:** Required

**Request Body:**
```json
{
  "url": "https://example.com/media/file.jpg",
  "fileType": "IMAGE",
  "description": "Survey location photo",
  "latitude": "18.5204",
  "longitude": "73.8567",
  "deviceName": "iPhone 13",
  "accuracy": 5.0,
  "place": "Survey Point 1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Media file added successfully",
  "data": {
    // ... updated survey object with new media file
  }
}
```

### 10. Remove Media File
**DELETE** `/:id/media/:mediaId`

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Media file removed successfully",
  "data": {
    // ... updated survey object
  }
}
```

## Field Management

### 11. Add Field
**POST** `/:id/fields`

**Authentication:** Required

**Request Body:**
```json
{
  "sequence": 1,
  "key": "infrastructure_type",
  "value": "poles",
  "fieldType": "dropdown",
  "dropdownOptions": ["poles", "ducts", "manholes", "cables"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Field added successfully",
  "data": {
    // ... updated survey object with new field
  }
}
```

### 12. Update Field
**PUT** `/:id/fields/:fieldId`

**Authentication:** Required

**Request Body:**
```json
{
  "value": "ducts",
  "dropdownOptions": ["poles", "ducts", "manholes", "cables", "fiber"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Field updated successfully",
  "data": {
    // ... updated survey object
  }
}
```

### 13. Remove Field
**DELETE** `/:id/fields/:fieldId`

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Field removed successfully",
  "data": {
    // ... updated survey object
  }
}
```

## Status Management

### 14. Update Survey Status
**PATCH** `/:id/status`

**Authentication:** Required

**Request Body:**
```json
{
  "status": 2,
  "updatedBy": "64f8b2d5e1a2c3d4e5f6g7h9"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Survey status updated successfully",
  "data": {
    // ... updated survey object
  }
}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific error message"
    }
  ]
}
```

## HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## Example Usage

### Create a complete survey with media files and fields:

```javascript
const surveyData = {
  name: "GP Survey - Village ABC",
  description: "Comprehensive survey for gram panchayat infrastructure",
  locationId: "64f8b2d5e1a2c3d4e5f6g7h8",
  stateName: "Karnataka",
  districtName: "Bangalore Rural",
  blockName: "Devanahalli",
  latitude: "13.2516",
  longitude: "77.7044",
  surveyType: "gp",
  createdBy: "64f8b2d5e1a2c3d4e5f6g7h9",
  updatedBy: "64f8b2d5e1a2c3d4e5f6g7h9",
  contactPerson: {
    sdeName: "Rajesh Kumar",
    sdeMobile: "+91-9876543210"
  },
  mediaFiles: [
    {
      url: "https://storage.com/survey1.jpg",
      fileType: "IMAGE",
      latitude: "13.2516",
      longitude: "77.7044",
      description: "Main road view"
    }
  ],
  fields: [
    {
      sequence: 1,
      key: "road_condition",
      value: "good",
      fieldType: "dropdown",
      dropdownOptions: ["excellent", "good", "fair", "poor"]
    }
  ]
};

fetch('/api/surveys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify(surveyData)
});
```

## Notes
- All dates are in ISO 8601 format
- ObjectIds should be valid MongoDB ObjectIds
- File uploads should be handled separately via the upload service
- Coordinates can be stored as strings to maintain precision
- Soft delete is used (status = 0) instead of hard delete
- All operations maintain audit trail with createdBy/updatedBy fields 