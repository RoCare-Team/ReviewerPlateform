import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },   // "business_owner"
    name: { type: String, required: true },                // "Business Owner"

    permissions: [{ type: String }],                       // ["campaign:*", "review:reply"]

    signup: { type: String, enum: ["open", "closed"], default: "closed" },
    authMethods: [{ type: String }],                       // ["google", "credentials"]
    otpRequired: { type: Boolean, default: true },

    isSystem: { type: Boolean, default: true },            // can't be deleted from admin UI
  },
  { timestamps: true }
);

export default mongoose.models.Role || mongoose.model("Role", RoleSchema);