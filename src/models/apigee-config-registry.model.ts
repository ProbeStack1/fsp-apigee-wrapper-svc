import { Schema, model, models } from "mongoose";

const apigeeConfigRegistrySchema = new Schema(
  {
    onboardingId: { type: String, required: true, index: true },
    microserviceId: { type: String, index: true },
    configType: { type: String, required: true, index: true },
    source: { type: String, required: true, enum: ["PLATFORM", "DIRECT_MANAGEMENT_API"], index: true },
    org: { type: String, required: true, index: true },
    environment: { type: String, index: true },
    developerEmail: { type: String, index: true },
    name: { type: String, required: true, index: true },
    resourceKey: { type: String, required: true },
    status: { type: String, required: true, enum: ["ACTIVE", "DELETED"], index: true },
    lastKnownPayload: { type: Schema.Types.Mixed },
    payloadHash: { type: String },
    createdBy: { type: String },
    createdAt: { type: Date },
    updatedBy: { type: String },
    updatedAt: { type: Date },
    deletedBy: { type: String },
    deletedAt: { type: Date },
  },
  {
    collection: "apigee_config_registry",
    timestamps: false,
  },
);

apigeeConfigRegistrySchema.index({ onboardingId: 1, resourceKey: 1 }, { unique: true });

export const ApigeeConfigRegistryModel =
  models.ApigeeConfigRegistry || model("ApigeeConfigRegistry", apigeeConfigRegistrySchema);
