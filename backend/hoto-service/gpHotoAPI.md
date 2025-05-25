# GP HOTO Service API Documentation

## Base URL

```
http://[host]:[port]/api/gphoto
```

## Authentication

Authentication details should be provided in the request headers (specific implementation details needed)

## Endpoints

### 1. Get All GP HOTO Records

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
        // GP HOTO record objects
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

### 2. Get GP HOTO by ID

- **Method:** GET
- **Endpoint:** `/:id`
- **Parameters:**
  - `id` (path parameter): GP HOTO record ID
- **Success Response:** Single GP HOTO record object
- **Error Response:**
  ```json
  {
    "message": "GP HOTO record not found"
  }
  ```

### 3. Create GP HOTO Record

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
    "location": "ObjectId"
  }
  ```
- **Optional Fields:**
  - Optical_Power_dB (Number)
  - Ring_Code (String)
  - Route_Code (String)
  - LGD_Code (String)
  - Latitude (String)
  - Longitude (String)
  - Contact_Person (String)
  - Email (String)
  - Mobile (String)
  - ONTs_Installed (Number)
  - Litup (String)
  - Phase (Number)
  - OTDR_Status (String)
  - OTDR_Status_Date (Date)
  - Ring_Topology (String)
  - LPSM_Status (String)
  - Fiber_Core (Number)
  - Op_Received_GP_Date (Date)
  - Op_Transmitted_From_Block_dB (Number)
  - Op_Transmitted_From_Block_Date (Date)
  - Splice_Loss_dB (Number)
  - And many more equipment-specific fields...

### 4. Update GP HOTO Record

- **Method:** PUT
- **Endpoint:** `/:id`
- **Parameters:**
  - `id` (path parameter): GP HOTO record ID
- **Body:** Any fields that need to be updated
- **Success Response:** Updated GP HOTO record object
- **Error Response:**
  ```json
  {
    "message": "GP HOTO record not found"
  }
  ```

### 5. Delete GP HOTO Record

- **Method:** DELETE
- **Endpoint:** `/:id`
- **Parameters:**
  - `id` (path parameter): GP HOTO record ID
- **Success Response:**
  ```json
  {
    "message": "GP HOTO record deleted successfully"
  }
  ```
- **Error Response:**
  ```json
  {
    "message": "GP HOTO record not found"
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

## Data Model Validation

- All string fields are automatically trimmed
- Required fields are validated before saving
- Mongoose Schema includes timestamps for created and updated dates
- ObjectId references for:
  - createdBy (User model)
  - location (Location model)

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
const gpHotoSchema = new mongoose.Schema(
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
    Optical_Power_dB: {
      type: Number,
      trim: true,
    },
    Ring_Code: {
      type: String,
      trim: true,
    },
    Route_Code: {
      type: String,
      trim: true,
    },
    LGD_Code: {
      type: String,
      trim: true,
    },
    Latitude: {
      type: String,
      trim: true,
    },
    Longitude: {
      type: String,
      trim: true,
    },
    Contact_Person: {
      type: String,
      trim: true,
    },
    Email: {
      type: String,
      trim: true,
    },
    Mobile: {
      type: String,
      trim: true,
    },
    ONTs_Installed: {
      type: Number,
    },
    Litup: {
      type: String,
      trim: true,
    },
    Phase: {
      type: Number,
    },
    OTDR_Status: {
      type: String,
      trim: true,
    },
    OTDR_Status_Date: {
      type: Date,
    },
    Ring_Topology: {
      type: String,
      trim: true,
    },
    LPSM_Status: {
      type: String,
      trim: true,
    },
    Fiber_Core: {
      type: Number,
    },
    Op_Received_GP_Date: {
      type: Date,
    },
    Op_Transmitted_From_Block_dB: {
      type: Number,
    },
    Op_Transmitted_From_Block_Date: {
      type: Date,
    },
    Splice_Loss_dB: {
      type: Number,
    },
    Asset_Make: {
      type: String,
      trim: true,
    },
    Asset_Model: {
      type: String,
      trim: true,
    },
    Serial_Number: {
      type: String,
      trim: true,
    },
    MAC_Address: {
      type: String,
      trim: true,
    },
    IP_Address: {
      type: String,
      trim: true,
    },
    Subnet: {
      type: String,
      trim: true,
    },
    Firmware: {
      type: String,
      trim: true,
    },
    No_Of_PON_Ports: {
      type: Number,
    },
    Uplink_Ports: {
      type: Number,
    },
    Power_Type: {
      type: String,
      trim: true,
    },
    No_Of_WAN_Ports: {
      type: Number,
    },
    No_Of_LAN_Ports: {
      type: Number,
    },
    Switch_Type: {
      type: String,
      trim: true,
    },
    No_Of_Ports: {
      type: Number,
    },
    VLAN_Support: {
      type: String,
      trim: true,
    },
    PoE_Support: {
      type: String,
      trim: true,
    },
    ONT_Type: {
      type: String,
      trim: true,
    },
    No_Of_Ethernet_Ports: {
      type: Number,
    },
    WiFi_Capability: {
      type: String,
      trim: true,
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
    }
  },
  {
    timestamps: true,
  }
);

// Add pre-save middleware for validation
gpHotoSchema.pre("save", function (next) {
  const requiredFields = [
    "State",
    "District_Code",
    "Block_Code",
    "GP_Code",
    "GP_Name",
    "createdBy",
    "location"
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

const GPHoto = mongoose.model("GP_HOTO", gpHotoSchema);
export default GPHoto; 