// Blueprint path: POST /v1/documents/upload — same contract as POST /api/documents.
export { POST } from "../../../documents/route";

// Segment config must be declared statically in each route file.
export const maxDuration = 300;
