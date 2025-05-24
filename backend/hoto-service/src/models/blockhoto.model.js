import mongoose from "mongoose";

const blockHotoSchema = new mongoose.Schema(
  {
    District_Code: {
      type: String,
      required: true,
    },
    Block_Code: {
      type: String,
      required: true,
    },
    Block_Name: {
      type: String,
      required: true,
    },
    Asset_Type: {
      type: String,
      required: true,
    },
    Item_Description: {
      type: String,
    },
    Asset_make: {
      type: String,
    },
    Asset_Model: {
      type: String,
    },
    Serial_Number: {
      type: String,
    },
    MAC_Address: {
      type: String,
    },
    IP_Address: {
      type: String,
    },
    Subnet: {
      type: String,
    },
    Firm_ware: {
      type: String,
    },
    No_of_PON_Ports: {
      type: Number,
    },
    Uplink_Ports: {
      type: Number,
    },
    Power_Type: {
      type: String,
    },
    No_Of_WAN_Ports: {
      type: Number,
    },
    No_Of_LANPorts: {
      type: Number,
    },
    Switch_Type: {
      type: String,
    },
    No_Of_Ports: {
      type: Number,
    },
    VLAN_Support: {
      type: Boolean,
    },
    PoE_Support: {
      type: Boolean,
    },
    ONT_Type: {
      type: String,
    },
    No_of_Ethernet_Ports: {
      type: Number,
    },
    WiFi_Capability: {
      type: Boolean,
    },
    Rack_Type: {
      type: String,
    },
    SizeU: {
      type: String,
    },
    Manufacture: {
      type: String,
    },
    Power_Source: {
      type: String,
    },
    Battery_Backup: {
      type: String,
    },
    Cooling_System: {
      type: String,
    },
    Capacity_kVA: {
      type: Number,
    },
    Input_Voltage: {
      type: String,
    },
    Output_Voltage: {
      type: String,
    },
    Capacity_Ah: {
      type: Number,
    },
    Voltage: {
      type: Number,
    },
    Battery_Type: {
      type: String,
    },
    Fuel_Type: {
      type: String,
    },
    Power_Rating_W: {
      type: Number,
    },
    Surge_Protection: {
      type: Boolean,
    },
    Panel_Type: {
      type: String,
    },
    Battery_Integration: {
      type: Boolean,
    },
    Capacity_FiberPortsSplices: {
      type: Number,
    },
    No_Of_Input_Output_Ports: {
      type: Number,
    },
    FDMS_Type: {
      type: String,
    },
    Rack_Mount: {
      type: Boolean,
    },
    Enclosure_Type: {
      type: String,
    },
    Ingress_Protection: {
      type: String,
    },
    No_Of_Adapter_Panels: {
      type: Number,
    },
    No_Of_Splice_Trays: {
      type: Number,
    },
    Cable_Entry_Type: {
      type: String,
    },
    Patch_Cord_Type: {
      type: String,
    },
    No_Of_Patch_Cords_Installed: {
      type: Number,
    },
    Fiber_Core_Type: {
      type: String,
    },
    Connector_Type: {
      type: String,
    },
    Fiber_Termination_Method: {
      type: String,
    },
    Remarks: {
      type: String,
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
