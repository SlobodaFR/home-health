import { RawIngestion } from './raw-ingestion';

/** Port (driven side) implemented by the infrastructure layer. Always inserts - this is an audit trail. */
export abstract class RawIngestionRepository {
  abstract save(entry: RawIngestion): Promise<void>;
}
