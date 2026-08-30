export { DomainError, isDomainError } from './errors';
export type { DomainErrorCode } from './errors';

export { SHIFTS, isShift, shiftLabel } from './shift';
export type { Shift } from './shift';

export {
  AGE_GROUP_CODES,
  DEMO_AGE_GROUP_POLICY_2026,
  findAgeGroupPolicy,
  listAgeGroupPolicies,
} from './age-group/policy';
export type { AgeGroupBand, AgeGroupCode, AgeGroupPolicy, PolicyStatus } from './age-group/policy';

export { ageInMonthsAt, parseIsoDate, resolveAgeGroup } from './age-group/resolve';
export type {
  AgeGroupOutcome,
  AgeGroupResolution,
  CalendarDate,
  ExplanationStep,
  ResolveAgeGroupInput,
} from './age-group/resolve';
