export { DomainError, isDomainError } from './errors';
export type { DomainErrorCode } from './errors';

export { CEP_LENGTH, CEP_SECTOR_LENGTH, cepSector, formatCep, normalizeCep } from './cep';

export {
  BRAZIL_COUNTRY_CODE,
  formatPhone,
  isMobile,
  maskPhone,
  normalizeE164,
} from './contact/phone';

export {
  canRemoveContact,
  CONTACT_CHANNELS,
  CONTACT_RELATIONS,
  CONTACT_STATUSES,
  flagDuplicateContacts,
  formatHandle,
  hasReachableContact,
  isThirdParty,
  maskHandle,
  normalizeHandle,
  phonesAmong,
  reconcilePrimary,
  SOCIAL_PLATFORMS,
} from './contact/rules';
export type {
  ContactChannel,
  ContactRelation,
  ContactRuleViolation,
  ContactStatus,
  ContactSummary,
  SocialPlatform,
} from './contact/rules';

export {
  ANCHOR_KINDS,
  MAX_ANCHOR_POSITION,
  MIN_ANCHOR_POSITION,
  RESIDENCE_POSITION,
} from './location-anchor';
export type { AnchorKind } from './location-anchor';

export { estimateDistance, haversineKm } from './recommendation/distance';
export type { Coordinate, DistanceEstimate } from './recommendation/distance';

export {
  DEMAND_LEVELS,
  FAR_DISTANCE_KM,
  isFarFromAllAnchors,
  recommendUnits,
  servedAgeGroup,
} from './recommendation/recommend';
export type {
  AnchorDistance,
  DemandLevel,
  RecommendableUnit,
  RecommendationAnchor,
  RecommendationInput,
  RecommendationReason,
  RecommendedUnit,
} from './recommendation/recommend';

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
