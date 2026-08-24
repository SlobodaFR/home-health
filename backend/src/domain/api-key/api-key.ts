export interface ApiKeyProps {
  id: string;
  userId: string;
  label: string;
  hashedKey: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

/**
 * A long-lived credential a user issues to authenticate both the Health
 * Auto Export automation (POST /health/:apiKey) and home-remote-mcps reads
 * (GET /health/:apiKey/...). The raw key is only ever returned once, at
 * creation time; only its hash is stored.
 */
export class ApiKey {
  private constructor(private props: ApiKeyProps) {}

  static create(props: Omit<ApiKeyProps, 'lastUsedAt' | 'revokedAt'>): ApiKey {
    return new ApiKey({ ...props, lastUsedAt: null, revokedAt: null });
  }

  static restore(props: ApiKeyProps): ApiKey {
    return new ApiKey(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get label(): string {
    return this.props.label;
  }

  get hashedKey(): string {
    return this.props.hashedKey;
  }

  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get isActive(): boolean {
    return this.props.revokedAt === null;
  }

  markUsed(now: Date): void {
    this.props = { ...this.props, lastUsedAt: now };
  }

  revoke(now: Date): void {
    this.props = { ...this.props, revokedAt: now };
  }
}
