# HOTO Service Testing Examples

## Base URL
```
http://localhost:3000/api/hotos
```

## 1. Create Sample Location (Optional - for testing)

First, create a sample location if you want to test with real location data:

**POST** `http://localhost:3000/api/locations` (if you create location endpoints)

```json
{
  "name": "Neyyattinkara Block",
  "code": "LOC001",
  "type": "block",
  "coordinates": {
    "latitude": "8.5241",
    "longitude": "76.9366"
  },
  "isActive": true
}
```

## 2. Create HOTO - Comprehensive Example

**POST** `http://localhost:3000/api/hotos`

### Example 1: Block Level HOTO (Complete)

```json
{
  "locationId": "64f8a1b2c3d4e5f6a7b8c9d1",
  "state": "kerala",
  "districtCode": "KL01",
  "districtName": "Thiruvananthapuram",
  "blockCode": "BLK001",
  "blockName": "Neyyattinkara",
  "gpCode": "GP001",
  "gpName": "Aruvikkara",
  "ofcCode": "OFC001",
  "ofcName": "Aruvikkara OFC",
  "hotoType": "block",
  "remarks": "Initial block level handover process for survey equipment and documentation",
  "latitude": "8.5241",
  "longitude": "76.9366",
  "status": 1,
  "others": {
    "department": "Survey Department",
    "region": "South Kerala",
    "season": "Monsoon 2023",
    "weather": "partly cloudy",
    "accessibility": "good road access",
    "internetConnectivity": "4G available",
    "powerSupply": "stable"
  },
  "contactPerson": {
    "name": "Rajesh Kumar",
    "email": "rajesh.kumar@kerala.gov.in",
    "mobile": "+919876543210",
    "description": "Block Development Officer"
  },
  "fields": [
    {
      "sequence": 1,
      "key": "equipment_handover",
      "value": "GPS devices, tablets, measuring tapes",
      "confirmation": true,
      "remarks": "All equipment verified and in working condition",
      "status": 1,
      "others": {
        "verifiedBy": "Inspector A",
        "verificationDate": "2023-12-01",
        "equipmentCount": 15,
        "batteryStatus": "fully charged",
        "warrantyStatus": "active"
      },
      "mediaFiles": [
        {
          "url": "https://example.com/equipment-photo-1.jpg",
          "fileType": "image/jpeg",
          "description": "GPS devices and tablets",
          "latitude": "8.5241",
          "longitude": "76.9366",
          "deviceName": "iPhone 14",
          "accuracy": 5.0,
          "place": "Block Office",
          "source": "mobile"
        },
        {
          "url": "https://example.com/equipment-photo-2.jpg",
          "fileType": "image/jpeg",
          "description": "Measuring equipment",
          "source": "mobile"
        }
      ]
    },
    {
      "sequence": 2,
      "key": "documentation",
      "value": "Survey permits, land records, mapping guidelines",
      "confirmation": true,
      "remarks": "All documents verified and digitized",
      "status": 1,
      "others": {
        "documentCount": 25,
        "digitalCopies": true,
        "lastUpdated": "2023-11-30",
        "reviewedBy": "Legal Team",
        "expiryCheck": "completed"
      }
    },
    {
      "sequence": 3,
      "key": "training_completion",
      "value": "Field staff training on new procedures",
      "confirmation": true,
      "remarks": "Training completed for 12 staff members",
      "status": 1,
      "others": {
        "trainedStaff": 12,
        "trainingDuration": "2 days",
        "certificatesIssued": true,
        "nextTrainingDate": "2024-03-01"
      }
    },
    {
      "sequence": 4,
      "key": "vehicle_assignment",
      "value": "Survey vehicle KL-01-AB-1234",
      "confirmation": true,
      "remarks": "Vehicle assigned with full fuel tank",
      "status": 1,
      "others": {
        "vehicleNumber": "KL-01-AB-1234",
        "fuelLevel": "100%",
        "lastService": "2023-11-15",
        "insuranceValid": true,
        "driverAssigned": "Suresh M"
      }
    },
    {
      "sequence": 5,
      "key": "safety_briefing",
      "value": "Safety protocols and emergency procedures",
      "confirmation": true,
      "remarks": "Safety briefing completed for all team members",
      "status": 1,
      "others": {
        "briefingDate": "2023-12-01",
        "emergencyContacts": ["108", "1077"],
        "firstAidKit": "available",
        "safetyGear": "provided"
      }
    }
  ]
}
```

### Example 2: OFC Level HOTO (Minimal)

```json
{
  "locationId": "64f8a1b2c3d4e5f6a7b8c9d2",
  "districtCode": "KL02",
  "districtName": "Kollam",
  "blockCode": "BLK002",
  "blockName": "Karunagappally",
  "ofcCode": "OFC002",
  "ofcName": "Karunagappally OFC",
  "hotoType": "ofc",
  "status": 2,
  "others": {
    "priority": "high",
    "urgency": "immediate"
  },
  "contactPerson": {
    "name": "Priya Nair",
    "email": "priya.nair@kerala.gov.in",
    "mobile": "+919876543211"
  },
  "fields": [
    {
      "sequence": 1,
      "key": "fiber_installation",
      "value": "New fiber cable installation completed",
      "confirmation": false,
      "status": 2,
      "others": {
        "pending": "final testing"
      }
    }
  ]
}
```

### Example 3: GP Level HOTO (Medium)

```json
{
  "locationId": "64f8a1b2c3d4e5f6a7b8c9d3",
  "districtCode": "KL03",
  "districtName": "Pathanamthitta",
  "blockCode": "BLK003",
  "blockName": "Ranni",
  "gpCode": "GP003",
  "gpName": "Ranni Panchayat",
  "hotoType": "gp",
  "remarks": "Panchayat level survey coordination",
  "latitude": "9.3667",
  "longitude": "76.8167",
  "status": 1,
  "others": {
    "population": 15000,
    "area": "25 sq km",
    "wards": 12
  },
  "contactPerson": {
    "name": "Santhosh George",
    "email": "santhosh.george@ranni.gov.in",
    "mobile": "+919876543212",
    "description": "Panchayat Secretary"
  },
  "fields": [
    {
      "sequence": 1,
      "key": "boundary_survey",
      "value": "Village boundary survey completed",
      "confirmation": true,
      "remarks": "GPS coordinates recorded for all boundary points",
      "status": 1,
      "others": {
        "boundaryPoints": 45,
        "surveyMethod": "GPS",
        "accuracy": "sub-meter"
      }
    },
    {
      "sequence": 2,
      "key": "ward_mapping",
      "value": "All 12 wards mapped digitally",
      "confirmation": true,
      "status": 1,
      "others": {
        "wardsCompleted": 12,
        "digitalFormat": "GIS",
        "resolution": "1:1000"
      }
    }
  ]
}
```

## 3. Update HOTO Example

**PUT** `http://localhost:3000/api/hotos/{hoto_id}`

```json
{
  "status": 3,
  "remarks": "Updated: All activities completed successfully",
  "others": {
    "completedDate": "2023-12-02",
    "finalReport": "submitted",
    "qualityScore": 95
  },
  "fields": [
    {
      "sequence": 1,
      "key": "equipment_handover",
      "value": "GPS devices, tablets, measuring tapes - all returned",
      "confirmation": true,
      "remarks": "Equipment returned in good condition",
      "status": 3,
      "others": {
        "returnDate": "2023-12-02",
        "condition": "excellent",
        "damages": "none"
      }
    }
  ]
}
```

## 4. Filter Examples

### Get HOTOs with various filters:

```bash
# By type
GET /api/hotos?hotoType=block

# By status
GET /api/hotos?status=1

# By district
GET /api/hotos?districtCode=KL01

# Multiple filters
GET /api/hotos?hotoType=ofc&status=2&districtCode=KL02

# With pagination
GET /api/hotos?page=1&limit=5

# By location
GET /api/hotos/location/64f8a1b2c3d4e5f6a7b8c9d1

# By type endpoint
GET /api/hotos/type/block

# Statistics
GET /api/hotos/stats
```

## 5. Field Status Codes (Suggested)

```
0 = Not Started
1 = In Progress  
2 = Pending Review
3 = Completed
4 = On Hold
5 = Cancelled
```

## 6. Priority Levels (for others field)

```
"low" = Non-urgent tasks
"medium" = Regular priority (default)
"high" = Important tasks
"urgent" = Critical/emergency tasks
```

## 7. Quick Test Sequence

1. **Create a Location** (if needed)
2. **Create HOTO** using Example 1 (Block level)
3. **Get All HOTOs** to verify creation
4. **Get Single HOTO** by ID
5. **Update HOTO** using update example
6. **Filter HOTOs** by status, type, etc.
7. **Get Statistics**

## 8. Error Testing

Try these to test validation:

```json
{
  "districtCode": "KL01",
  "districtName": "Test",
  "blockCode": "BLK001",
  "blockName": "Test Block",
  "hotoType": "invalid_type",
  "contactPerson": {
    "name": "Test User",
    "email": "invalid-email",
    "mobile": "123"
  }
}
```

This should trigger validation errors for:
- Missing required `locationId`
- Invalid `hotoType` enum value
- Invalid email format 