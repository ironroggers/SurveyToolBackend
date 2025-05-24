# HOTO Service API Documentation

## Base URL

```
http://[host]:[port]/api/blockhoto
```

## Authentication

Authentication details should be provided in the request headers (specific implementation details needed)

## Endpoints

### 1. Get All HOTO Records

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
        // HOTO record objects
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

### 2. Get HOTO by ID

- **Method:** GET
- **Endpoint:** `/:id`
- **Parameters:**
  - `id` (path parameter): HOTO record ID
- **Success Response:** Single HOTO record object
- **Error Response:**
  ```json
  {
    "message": "BlockHOTO record not found"
  }
  ```

### 3. Create HOTO Record

- **Method:** POST
- **Endpoint:** `/`
- **Required Fields:**
  ```json
  {
    "District_Code": "string",
    "Block_Code": "string",
    "Block_Name": "string",
    "Asset_Type": "string",
    "location": "ObjectId",
    "createdBy": "ObjectId"
  }
  ```
- **Optional Fields Based on Asset Type:**

### 4. Update HOTO Record

- **Method:** PUT
- **Endpoint:** `/:id`
- **Parameters:**
  - `id` (path parameter): HOTO record ID
- **Body:** Any fields that need to be updated
- **Success Response:** Updated HOTO record object
- **Error Response:**
  ```json
  {
    "message": "BlockHOTO record not found"
  }
  ```
- **Note:** Updates are validated against the schema

### 5. Delete HOTO Record

- **Method:** DELETE
- **Endpoint:** `/:id`
- **Parameters:**
  - `id` (path parameter): HOTO record ID
- **Success Response:**
  ```json
  {
    "message": "BlockHOTO record deleted successfully"
  }
  ```
- **Error Response:**
  ```json
  {
    "message": "BlockHOTO record not found"
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

const blockHotoSchema = new mongoose.Schema(
{
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
Block_Name: {
type: String,
required: true,
trim: true,
},
Asset_Type: {
type: String,
required: true,
trim: true,
},
Item_Description: {
type: String,
trim: true,
},
Asset_make: {
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
Firm_ware: {
type: String,
trim: true,
},
No_of_PON_Ports: {
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
No_Of_LANPorts: {
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
No_of_Ethernet_Ports: {
type: Number,
},
WiFi_Capability: {
type: String,
trim: true,
},
Rack_Type: {
type: String,
trim: true,
},
SizeU: {
type: String,
trim: true,
},
Manufacture: {
type: String,
trim: true,
},
Power_Source: {
type: String,
trim: true,
},
Battery_Backup: {
type: String,
trim: true,
},
Cooling_System: {
type: String,
trim: true,
},
Capacity_kVA: {
type: Number,
},
Input_Voltage: {
type: String,
trim: true,
},
Output_Voltage: {
type: String,
trim: true,
},
Capacity_Ah: {
type: Number,
},
Voltage: {
type: Number,
},
Battery_Type: {
type: String,
trim: true,
},
Fuel_Type: {
type: String,
trim: true,
},
Power_Rating_W: {
type: Number,
},
Surge_Protection: {
type: String,
trim: true,
},
Panel_Type: {
type: String,
trim: true,
},
Battery_Integration: {
type: String,
trim: true,
},
Capacity_FiberPortsSplices: {
type: Number,
},
No_Of_Input_Output_Ports: {
type: Number,
},
FDMS_Type: {
type: String,
trim: true,
},
Rack_Mount: {
type: String,
trim: true,
},
Enclosure_Type: {
type: String,
trim: true,
},
Ingress_Protection: {
type: String,
trim: true,
},
No_Of_Adapter_Panels: {
type: Number,
},
No_Of_Splice_Trays: {
type: Number,
},
Cable_Entry_Type: {
type: String,
trim: true,
},
Patch_Cord_Type: {
type: String,
trim: true,
},
No_Of_Patch_Cords_Installed: {
type: Number,
},
Fiber_Core_Type: {
type: String,
trim: true,
},
Connector_Type: {
type: String,
trim: true,
},
Fiber_Termination_Method: {
type: String,
trim: true,
},
Remarks: {
type: String,
trim: true,
},
others: {
type: Object,
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
},
{
timestamps: true,
}
);
