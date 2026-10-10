import {
    evaluateExportAccess,
    evaluateGeneratorAccess,
} from "./licensePolicy.js";
// All consumers pass the verified access summary from AccessProvider.
export const canAccessGenerator = (generator, access) =>
    evaluateGeneratorAccess(generator, access).allowed;
export const canExportFormat = (generator, format, access) =>
    evaluateExportAccess(generator, format, access).allowed;
