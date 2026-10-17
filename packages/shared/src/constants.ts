// Shared limits — api-contract-spec §1.1. Frontend and backend must import these, never hard-code.

export const TRIP_NAME_MIN = 3;
export const TRIP_NAME_MAX = 80;
export const DAY_TEXT_MAX = 5000;
export const DAY_TEXT_WARN = 4500;
export const TRIP_MAX_DAYS = 60;
export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 40;
export const EMAIL_MAX = 254;
export const SEARCH_QUERY_MIN = 2;
export const SEARCH_QUERY_MAX = 100;
export const SESSION_ID_MIN = 8;
export const SESSION_ID_MAX = 64;
export const PRESENCE_TTL_SECONDS = 30;
export const PRESENCE_HEARTBEAT_SECONDS = 15;
export const TRIP_POLL_SECONDS = 10;
export const PAGE_LIMIT_DEFAULT = 12;
export const PAGE_LIMIT_MAX = 50;
export const TOKEN_LENGTH = 43;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const API_VERSION_PREFIX = '/api/v1';
