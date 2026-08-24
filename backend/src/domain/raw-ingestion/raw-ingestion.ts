export interface RawIngestion {
  userId: string;
  automationId: string | null;
  automationName: string | null;
  sessionId: string | null;
  dataType: string;
  payload: unknown;
}
