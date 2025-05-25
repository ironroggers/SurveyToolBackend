# OFC HOTO Service API Documentation

## Base URL

```
http://[host]:[port]/api/ofchoto
```

## Authentication

Authentication details should be provided in the request headers (specific implementation details needed)

## Endpoints

### 1. Get All OFC HOTO Records

- **Method:** GET
- **Endpoint:** `/`
- **Query Parameters:**
  - `page` (optional): Page number for pagination (default: 1)
  - `limit` (optional): Number of records per page (default: 10)
- **Response Format:**
  ```json
  {
    "data": [
      {
        // OFC HOTO record objects
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "pageSize": 10,
      "totalCount": 100,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

### 2. Get OFC HOTO by ID

- **Method:** GET
- **Endpoint:** `/:id`
- **Parameters:**
  - `id` (path parameter): OFC HOTO record ID
- **Success Response:** Single OFC HOTO record object
- **Error Response:**
  ```json
  {
    "message": "OFC HOTO record not found"
  }
  ```

### 3. Create OFC HOTO Record

- **Method:** POST
- **Endpoint:** `/`
- **Required Fields:**
  ```json
  {
    "State": "string",
    "District_Code": "string",
    "Block_Code": "string",
    "GP_Code": "string",
    "GP_Name": "string",
    "createdBy": "ObjectId",
    "location": "ObjectId",
    "blockHoto": "ObjectId"
  }
  ```
- **Optional Fields:**
  ```json
  {
    "FPOI_Latitude": "string",
    "FPOI_Longitude": "string",
    "FPOI_Closure_Available": "Yes/No",
    "FPOI_Joint_Closure_Photos": ["string"],
    "OTDR_Length_FPOI_to_GP": "number",
    "OTDR_Trace_Files": ["string"],
    "Overhead_Sections_Count": "number",
    "Total_Overhead_Stretch_Length": "number",
    "Overhead_Sections": [{
      "From_Latitude": "string",
      "From_Longitude": "string",
      "From_Photos": ["string"],
      "To_Latitude": "string",
      "To_Longitude": "string",
      "To_Photos": ["string"],
      "Calculated_Length": "number"
    }],
    "L14_Diagram_Files": ["string"],
    "ROW_Document_Files": ["string"],
    "Joints_Count": "number",
    "Chambers_Count": "number",
    "Chambers": [{
      "Latitude": "string",
      "Longitude": "string",
      "Photos": ["string"]
    }],
    "status": "number"
  }
  ```

### 4. Update OFC HOTO Record

- **Method:** PUT
- **Endpoint:** `/:id`
- **Parameters:**
  - `id` (path parameter): OFC HOTO record ID
- **Body:** Any fields that need to be updated
- **Success Response:** Updated OFC HOTO record object
- **Error Response:**
  ```json
  {
    "message": "OFC HOTO record not found"
  }
  ```

### 5. Delete OFC HOTO Record

- **Method:** DELETE
- **Endpoint:** `/:id`
- **Parameters:**
  - `id` (path parameter): OFC HOTO record ID
- **Success Response:**
  ```json
  {
    "message": "OFC HOTO record deleted successfully"
  }
  ```
- **Error Response:**
  ```json
  {
    "message": "OFC HOTO record not found"
  }
  ```

## Error Handling

- 404: Resource not found
- 400: Bad request (validation errors)
- 500: Internal server error
- All error responses follow the format:
  ```json
  {
    "error": "Error message description"
  }
  ```

## Technical Details

- Request body size limit: 10MB
- CORS enabled
- Security headers implemented via helmet
- Health check endpoint available at `/health`
- Mongoose Schema with timestamps (createdAt, updatedAt automatically added)
- All string fields are automatically trimmed
- Pagination implemented for list endpoints
- File upload support for photos and documents

## Data Model Validation

- All string fields are automatically trimmed
- Required fields are validated before saving
- Mongoose Schema includes timestamps for created and updated dates
- ObjectId references for:
  - createdBy (User model)
  - location (Location model)
  - blockHoto (BLOCK_HOTO model)
- FPOI_Closure_Available field is enum: ["Yes", "No"]
- Pre-save middleware validates required fields

## Health Check Endpoint

GET `/health`

```json
{
  "status": "ok",
  "service": "hoto-service",
  "timestamp": "ISO Date",
  "uptime": "seconds"
}
```

## Mongoose Schema Model

```javascript
const ofcHotoSchema = new mongoose.Schema(
  {
    State: {
      type: String,
      required: true,
      trim: true,
    },
    District_Code: {
      type: String,
      required: true,
      trim: true,
    },
    Block_Code: {
      type: String,
      required: true,
      trim: true,
    },
    GP_Code: {
      type: String,
      required: true,
      trim: true,
    },
    GP_Name: {
      type: String,
      required: true,
      trim: true,
    },
    FPOI_Latitude: {
      type: String,
      trim: true,
    },
    FPOI_Longitude: {
      type: String,
      trim: true,
    },
    FPOI_Closure_Available: {
      type: String,
      enum: ["Yes", "No"],
      trim: true,
    },
    FPOI_Joint_Closure_Photos: {
      type: [String],
      default: [],
    },
    OTDR_Length_FPOI_to_GP: {
      type: Number,  // in meters
    },
    OTDR_Trace_Files: {
      type: [String], // for PDF and image uploads
      default: [],
    },
    Overhead_Sections_Count: {
      type: Number,
      default: 0,
    },
    Total_Overhead_Stretch_Length: {
      type: Number, // in meters
      default: 0,
    },
    Overhead_Sections: {
      type: [{
        From_Latitude: String,
        From_Longitude: String,
        From_Photos: [String],
        To_Latitude: String,
        To_Longitude: String,
        To_Photos: [String],
        Calculated_Length: Number,
      }],
      default: [],
    },
    L14_Diagram_Files: {
      type: [String], // for PDF and image uploads
      default: [],
    },
    ROW_Document_Files: {
      type: [String], // for PDF and image uploads
      default: [],
    },
    Joints_Count: {
      type: Number,
      default: 0,
    },
    Chambers_Count: {
      type: Number,
      default: 0,
    },
    Chambers: {
      type: [{
        Latitude: String,
        Longitude: String,
        Photos: [String],
      }],
      default: [],
    },
    status: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    blockHoto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BLOCK_HOTO",
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

// Add pre-save middleware for validation
ofcHotoSchema.pre("save", function (next) {
  const requiredFields = [
    "State",
    "District_Code",
    "Block_Code",
    "GP_Code",
    "GP_Name",
    "createdBy",
    "location",
    "blockHoto"
  ];

  const errors = [];

  requiredFields.forEach((field) => {
    if (!this[field]) {
      errors.push(`${field} is required`);
    }
  });

  if (errors.length > 0) {
    next(new Error(errors.join(", ")));
  } else {
    next();
  }
});

const OFCHoto = mongoose.model("OFC_HOTO", ofcHotoSchema);
export default OFCHoto;
``` 