import { Schema, model, models } from "mongoose";

const apigeeConfigHistorySchema = new Schema(
  {
    configId: { type: String, index: true },
    onboardingId: { type: String, required: true, index: true },
    microserviceId: { type: String, index: true },
    configType: { type: String, required: true, index: true },
    operation: { type: String, required: true, index: true },
    source: { type: String, required: true, enum: ["PLATFORM", "DIRECT_MANAGEMENT_API"], index: true },
    org: { type: String, required: true, index: true },
    environment: { type: String, index: true },
    developerEmail: { type: String, index: true },
    name: { type: String, required: true, index: true },
    resourceKey: { type: String, required: true, index: true },
    requestPayload: { type: Schema.Types.Mixed },
    beforeSnapshot: { type: Schema.Types.Mixed },
    afterSnapshot: { type: Schema.Types.Mixed },
    responsePayload: { type: Schema.Types.Mixed },
    status: { type: String, required: true, enum: ["SUCCESS", "FAILED"], index: true },
    errorMessage: { type: String },
    createdBy: { type: String },
    performedAt: { type: Date, required: true, index: true },
  },
  {
    collection: "apigee_config_history",
    timestamps: false,
  },
);

export const ApigeeConfigHistoryModel =
  models.ApigeeConfigHistory || model("ApigeeConfigHistory", apigeeConfigHistorySchema);
