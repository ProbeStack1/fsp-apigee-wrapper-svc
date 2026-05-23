import { Schema, model, models } from "mongoose";

const codegenResultSchema = new Schema(
  {
    artifactId: { type: String, index: true },
    microserviceId: { type: String, index: true },
    onboardingId: { type: String, index: true },
    status: { type: String, index: true },
  },
  {
    collection: "codegen_results",
    strict: false,
    timestamps: false,
  },
);

export const CodegenResultModel =
  models.CodegenResult || model("CodegenResult", codegenResultSchema);
