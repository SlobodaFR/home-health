import { InitSchema1787572677428 } from './1787572677428-InitSchema';
import { AddRevokedSessions1787573101601 } from './1787573101601-AddRevokedSessions';

/**
 * Migrations, in order. Listed as classes (no glob) so src/*.ts and dist/*.js cannot diverge.
 * A migration made by `migration:generate` must be appended here by hand: it is not picked up
 * otherwise, and only the migrations spec (CI) notices, not the boot.
 */
export const MIGRATIONS = [
  InitSchema1787572677428,
  AddRevokedSessions1787573101601,
];
