import mongoose from "mongoose";

const gPhotoSchema = new mongoose.Schema(
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
    blockHoto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BLOCK_HOTO",
      required: true,
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

// Add pre-save middleware for validation
gPhotoSchema.pre("save", function (next) {
  const requiredFields = [
    "State",
    "District_Code",
    "Block_Code",
    "GP_Code",
    "GP_Name",
    "createdBy",
    "location",
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

const GPhoto = mongoose.model("GP_HOTO", gPhotoSchema);
export default GPhoto;
