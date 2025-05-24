import mongoose from "mongoose";

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

// Add pre-save middleware for validation
blockHotoSchema.pre("save", function (next) {
  const requiredFields = [
    "District_Code",
    "Block_Code",
    "Block_Name",
    "Asset_Type",
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

const BlockHOTO = mongoose.model("BLOCK_HOTO", blockHotoSchema);
export default BlockHOTO;
