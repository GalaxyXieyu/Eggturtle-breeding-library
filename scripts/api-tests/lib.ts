import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type ModuleName =
  | 'auth'
  | 'products'
  | 'images'
  | 'featured'
  | 'shares'
  | 'admin'
  | 'account-matrix';

export type LogLevel = 'info' | 'ok' | 'warn' | 'error';

export interface CliOptions {
  apiBase: string;
  allowRemote: boolean;
  confirmWrites: boolean;
  json: boolean;
  only?: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  email?: string;
  ownerEmail?: string;
  adminEmail?: string;
  editorEmail?: string;
  viewerEmail?: string;
  superAdminEmail?: string;
  provision: boolean;
  requireSuperAdminPass: boolean;
  help: boolean;
}

export interface ApiRequestOptions {
  method: HttpMethod;
  path: string;
  token?: string;
  query?: Record<string, string | number | boolean | undefined>;
  json?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  redirect?: RequestRedirect;
}

export interface ApiResponse<TBody = unknown> {
  status: number;
  headers: Headers;
  body: TBody;
  text: string;
  url: string;
}

export interface Logger {
  log: (level: LogLevel, event: string, fields?: Record<string, unknown>) => void;
  info: (event: string, fields?: Record<string, unknown>) => void;
  ok: (event: string, fields?: Record<string, unknown>) => void;
  warn: (event: string, fields?: Record<string, unknown>) => void;
  error: (event: string, fields?: Record<string, unknown>) => void;
}

export interface TestContext {
  options: CliOptions;
  log: Logger;
  state: Map<string, unknown>;
  request: <TBody = unknown>(request: ApiRequestOptions) => Promise<ApiResponse<TBody>>;
  requireWrites: (reason: string) => void;
}

export interface ModuleResult {
  checks: number;
  details?: Record<string, unknown>;
}

export interface TestModule {
  name: ModuleName;
  description: string;
  requiresWrites: boolean;
  run: (ctx: TestContext) => Promise<ModuleResult>;
}

export interface TenantSession {
  email: string;
  baseToken: string;
  token: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DEFAULT_API_BASE = 'http://localhost:30011';

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apiBase: DEFAULT_API_BASE,
    allowRemote: false,
    confirmWrites: false,
    json: false,
    provision: false,
    requireSuperAdminPass: false,
    help: false,
  };

  const readValue = (flag: string, index: number): [string, number] => {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new ApiTestError(`Missing value for ${flag}`);
    }

    return [value, index + 1];
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case '--':
        break;
      case '--api-base': {
        const [value, next] = readValue(arg, i);
        options.apiBase = value;
        i = next;
        break;
      }
      case '--allow-remote':
        options.allowRemote = true;
        break;
      case '--confirm-writes':
        options.confirmWrites = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--tenant-id': {
        const [value, next] = readValue(arg, i);
        options.tenantId = value;
        i = next;
        break;
      }
      case '--tenant-slug': {
        const [value, next] = readValue(arg, i);
        options.tenantSlug = value;
        i = next;
        break;
      }
      case '--tenant-name': {
        const [value, next] = readValue(arg, i);
        options.tenantName = value;
        i = next;
        break;
      }
      case '--email': {
        const [value, next] = readValue(arg, i);
        options.email = value;
        i = next;
        break;
      }
      case '--owner-email': {
        const [value, next] = readValue(arg, i);
        options.ownerEmail = value;
        i = next;
        break;
      }
      case '--admin-email': {
        const [value, next] = readValue(arg, i);
        options.adminEmail = value;
        i = next;
        break;
      }
      case '--editor-email': {
        const [value, next] = readValue(arg, i);
        options.editorEmail = value;
        i = next;
        break;
      }
      case '--viewer-email': {
        const [value, next] = readValue(arg, i);
        options.viewerEmail = value;
        i = next;
        break;
      }
      case '--super-admin-email': {
        const [value, next] = readValue(arg, i);
        options.superAdminEmail = value;
        i = next;
        break;
      }
      case '--provision':
        options.provision = true;
        break;
      case '--require-super-admin-pass':
        options.requireSuperAdminPass = true;
        break;
      case '--only': {
        const [value, next] = readValue(arg, i);
        options.only = value;
        i = next;
        break;
      }
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        throw new ApiTestError(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function printUsage(): void {
  const message = [
    'Usage: ts-node scripts/api-tests/run.ts [options]',
    '',
    'Options:',
    '  --api-base <url>            API base URL (default: http://localhost:30011)',
    '  --allow-remote              Allow non-local API base URL',
    '  --confirm-writes            Execute write scenarios (safe mode is dry-run)',
    '  --json                      Emit JSONL logs',
    '  --only <list>               Comma-separated modules: auth,products,images,featured,shares,admin,account-matrix',
    '  --tenant-id <id>            Existing tenant ID for tenant-scoped modules',
    '  --tenant-slug <slug>        Tenant slug when auto-creating tenant',
    '  --tenant-name <name>        Tenant name when auto-creating tenant',
    '  --email <email>             Base email for non-matrix modules',
    '  --owner-email <email>       Account-matrix OWNER email',
    '  --admin-email <email>       Account-matrix ADMIN email',
    '  --editor-email <email>      Account-matrix EDITOR email',
    '  --viewer-email <email>      Account-matrix VIEWER email',
    '  --super-admin-email <email> super-admin email for admin/account-matrix checks',
    '  --provision                 Account-matrix: create tenant + memberships via /admin/*',
    '  --require-super-admin-pass  Fail if super-admin positive checks are not 2xx',
    '  -h, --help                  Show help',
  ];

  console.log(message.join('\n'));
}

export function createLogger(json: boolean): Logger {
  const emit = (level: LogLevel, event: string, fields?: Record<string, unknown>) => {
    if (json) {
      const payload = {
        ts: new Date().toISOString(),
        level,
        event,
        ...(fields ?? {}),
      };
      console.log(JSON.stringify(payload));
      return;
    }

    const segments: string[] = [];
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        segments.push(`${key}=${formatValue(value)}`);
      }
    }

    const suffix = segments.length > 0 ? ` ${segments.join(' ')}` : '';
    console.log(`[${level.toUpperCase()}] ${event}${suffix}`);
  };

  return {
    log: emit,
    info: (event, fields) => emit('info', event, fields),
    ok: (event, fields) => emit('ok', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
  };
}

export function createContext(options: CliOptions): TestContext {
  assertApiBaseSafety(options.apiBase, options.allowRemote);

  const log = createLogger(options.json);
  const state = new Map<string, unknown>();

  return {
    options,
    log,
    state,
    request: async <TBody = unknown>(request: ApiRequestOptions): Promise<ApiResponse<TBody>> => {
      const response = await requestApi<TBody>(options.apiBase, request);
      return response;
    },
    requireWrites: (reason: string) => {
      if (!options.confirmWrites) {
        throw new ApiTestError(
          `Refusing write scenario (${reason}). Re-run with --confirm-writes to execute.`,
        );
      }
    },
  };
}

export function parseOnlyModules(value: string | undefined): ModuleName[] | null {
  if (!value) {
    return null;
  }

  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parsed.length === 0) {
    throw new ApiTestError('--only requires at least one module name');
  }

  const known = new Set<ModuleName>([
    'auth',
    'products',
    'images',
    'featured',
    'shares',
    'admin',
    'account-matrix',
  ]);

  const modules: ModuleName[] = [];
  for (const name of parsed) {
    if (!known.has(name as ModuleName)) {
      throw new ApiTestError(`Unknown module in --only: ${name}`);
    }

    modules.push(name as ModuleName);
  }

  return modules;
}

export async function requestApi<TBody = unknown>(
  apiBase: string,
  options: ApiRequestOptions,
): Promise<ApiResponse<TBody>> {
  const url = buildUrl(apiBase, options.path, options.query);

  const headers = new Headers(options.headers ?? {});
  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`);
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.json);
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body,
    redirect: options.redirect ?? 'follow',
  });

  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';

  let parsedBody: unknown = text;
  if (text.length > 0 && contentType.includes('application/json')) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  return {
    status: response.status,
    headers: response.headers,
    body: parsedBody as TBody,
    text,
    url,
  };
}

export function assertStatus(
  response: ApiResponse,
  expected: number | number[],
  label?: string,
): void {
  const expectedList = Array.isArray(expected) ? expected : [expected];

  if (expectedList.includes(response.status)) {
    return;
  }

  const hint = label ? `${label}: ` : '';
  throw new ApiTestError(
    `${hint}expected HTTP ${expectedList.join('/')}, got ${response.status}. body=${shortBody(response.body)}`,
  );
}

export function assertErrorCode(response: ApiResponse, expectedCode: string): void {
  const body = asObject(response.body, 'error payload');
  const actualCode = body.errorCode;

  if (actualCode !== expectedCode) {
    throw new ApiTestError(
      `expected errorCode=${expectedCode}, got ${formatValue(actualCode)}; body=${shortBody(body)}`,
    );
  }
}

export function asObject(value: unknown, label = 'object'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiTestError(`Expected ${label} object, got ${formatValue(value)}`);
  }

  return value as Record<string, unknown>;
}

export function asArray(value: unknown, label = 'array'): unknown[] {
  if (!Array.isArray(value)) {
    throw new ApiTestError(`Expected ${label} array, got ${formatValue(value)}`);
  }

  return value;
}

export function readString(
  objectValue: Record<string, unknown>,
  key: string,
  label?: string,
  allowEmpty = false,
): string {
  const value = objectValue[key];
  if (typeof value !== 'string') {
    throw new ApiTestError(`Expected ${label ?? key} string, got ${formatValue(value)}`);
  }

  if (!allowEmpty && value.trim().length === 0) {
    throw new ApiTestError(`Expected ${label ?? key} to be non-empty`);
  }

  return value;
}

export function readBoolean(
  objectValue: Record<string, unknown>,
  key: string,
  label?: string,
): boolean {
  const value = objectValue[key];
  if (typeof value !== 'boolean') {
    throw new ApiTestError(`Expected ${label ?? key} boolean, got ${formatValue(value)}`);
  }

  return value;
}

export function readObject(
  objectValue: Record<string, unknown>,
  key: string,
  label?: string,
): Record<string, unknown> {
  return asObject(objectValue[key], label ?? key);
}

export function ensureKeys(
  objectValue: Record<string, unknown>,
  keys: string[],
  label: string,
): void {
  for (const key of keys) {
    if (!(key in objectValue)) {
      throw new ApiTestError(`Missing key ${label}.${key}`);
    }
  }
}

export function uniqueSuffix(prefix: string): string {
  const compactUuid = randomUUID().replace(/-/g, '').slice(0, 10);
  return `${prefix}-${Date.now()}-${compactUuid}`;
}

export function defaultEmail(prefix = 'api-test'): string {
  return `${uniqueSuffix(prefix)}@example.com`;
}

export function createTinyPngFile(fieldName = 'file', filename = 'pixel.png'): FormData {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7f6S8AAAAASUVORK5CYII=';

  const bytes = Buffer.from(pngBase64, 'base64');
  const blob = new Blob([bytes], { type: 'image/png' });

  const formData = new FormData();
  formData.append(fieldName, blob, filename);
  return formData;
}

export function parseShareRedirect(location: string): {
  sid: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  exp: string;
  sig: string;
} {
  let url: URL;
  try {
    url = new URL(location);
  } catch {
    try {
      url = new URL(location, 'http://localhost');
    } catch {
      throw new ApiTestError(`Invalid share redirect URL: ${location}`);
    }
  }

  const readParam = (name: string): string => {
    const value = url.searchParams.get(name);
    if (!value) {
      throw new ApiTestError(`Share redirect URL missing query param: ${name}`);
    }

    return value;
  };

  return {
    sid: readParam('sid'),
    tenantId: readParam('tenantId'),
    resourceType: readParam('resourceType'),
    resourceId: readParam('resourceId'),
    exp: readParam('exp'),
    sig: readParam('sig'),
  };
}

export async function requestCode(ctx: TestContext, email: string): Promise<{ devCode: string }> {
  const response = await ctx.request({
    method: 'POST',
    path: '/auth/request-code',
    json: { email },
  });

  assertStatus(response, 201, 'auth.request-code');
  const payload = asObject(response.body, 'auth.request-code response');
  ensureKeys(payload, ['ok', 'expiresAt'], 'auth.request-code');
  readBoolean(payload, 'ok', 'auth.request-code.ok');
  readString(payload, 'expiresAt', 'auth.request-code.expiresAt');

  const devCode = payload.devCode;
  if (typeof devCode !== 'string' || devCode.length === 0) {
    throw new ApiTestError(
      'devCode missing from request-code response. Ensure AUTH_DEV_CODE_ENABLED=true in development.',
    );
  }

  return { devCode };
}

export async function verifyCode(
  ctx: TestContext,
  email: string,
  code: string,
): Promise<{ accessToken: string; user: Record<string, unknown> }> {
  const response = await ctx.request({
    method: 'POST',
    path: '/auth/verify-code',
    json: { email, code },
  });

  assertStatus(response, 201, 'auth.verify-code');
  const payload = asObject(response.body, 'auth.verify-code response');
  const accessToken = readString(payload, 'accessToken', 'auth.verify-code.accessToken');
  const user = readObject(payload, 'user', 'auth.verify-code.user');
  readString(user, 'id', 'auth.verify-code.user.id');
  readString(user, 'email', 'auth.verify-code.user.email');

  return { accessToken, user };
}

export async function loginWithDevCode(
  ctx: TestContext,
  email: string,
): Promise<{ token: string; user: Record<string, unknown> }> {
  const { devCode } = await requestCode(ctx, email);
  const { accessToken, user } = await verifyCode(ctx, email, devCode);
  return { token: accessToken, user };
}

export async function switchTenant(
  ctx: TestContext,
  token: string,
  tenant: { tenantId?: string; slug?: string },
): Promise<{ token: string; tenant: Record<string, unknown>; role: string }> {
  if (!tenant.tenantId && !tenant.slug) {
    throw new ApiTestError('switchTenant requires tenantId or slug');
  }

  const response = await ctx.request({
    method: 'POST',
    path: '/auth/switch-tenant',
    token,
    json: tenant,
  });

  assertStatus(response, 201, 'auth.switch-tenant');
  const payload = asObject(response.body, 'auth.switch-tenant response');
  const switchedToken = readString(payload, 'accessToken', 'auth.switch-tenant.accessToken');
  const switchedTenant = readObject(payload, 'tenant', 'auth.switch-tenant.tenant');
  const role = readString(payload, 'role', 'auth.switch-tenant.role');

  return { token: switchedToken, tenant: switchedTenant, role };
}

export async function createTenant(
  ctx: TestContext,
  token: string,
  tenant: { slug: string; name: string },
): Promise<{ tenantId: string; tenantSlug: string; tenantName: string }> {
  const response = await ctx.request({
    method: 'POST',
    path: '/tenants',
    token,
    json: tenant,
  });

  assertStatus(response, 201, 'tenants.create');
  const payload = asObject(response.body, 'tenants.create response');
  const createdTenant = readObject(payload, 'tenant', 'tenants.create.tenant');
  const tenantId = readString(createdTenant, 'id', 'tenants.create.tenant.id');
  const tenantSlug = readString(createdTenant, 'slug', 'tenants.create.tenant.slug');
  const tenantName = readString(createdTenant, 'name', 'tenants.create.tenant.name');

  return { tenantId, tenantSlug, tenantName };
}

export async function ensureTenantSession(
  ctx: TestContext,
  input: { email?: string; tenantId?: string; tenantSlug?: string; tenantName?: string } = {},
): Promise<TenantSession> {
  const email = input.email ?? ctx.options.email ?? defaultEmail('api-user');
  const cacheKey = `tenant-session:${email}:${input.tenantId ?? 'new'}`;
  const cached = ctx.state.get(cacheKey);
  if (cached) {
    return cached as TenantSession;
  }

  const { token: baseToken } = await loginWithDevCode(ctx, email);

  let tenantId = input.tenantId ?? ctx.options.tenantId;
  let tenantSlug = input.tenantSlug ?? ctx.options.tenantSlug ?? uniqueSuffix('api-tenant');
  let tenantName = input.tenantName ?? ctx.options.tenantName ?? `API Tenant ${Date.now()}`;

  if (!tenantId) {
    const created = await createTenant(ctx, baseToken, {
      slug: tenantSlug,
      name: tenantName,
    });
    tenantId = created.tenantId;
    tenantSlug = created.tenantSlug;
    tenantName = created.tenantName;
  }

  const switched = await switchTenant(ctx, baseToken, { tenantId });

  const session: TenantSession = {
    email,
    baseToken,
    token: switched.token,
    tenantId,
    tenantSlug,
    tenantName,
  };

  ctx.state.set(cacheKey, session);
  return session;
}

export function shortBody(value: unknown): string {
  return inspect(value, {
    depth: 4,
    compact: true,
    breakLength: 120,
    maxArrayLength: 10,
    maxStringLength: 240,
  });
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export class ApiTestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiTestError';
  }
}

function assertApiBaseSafety(apiBase: string, allowRemote: boolean): void {
  let parsed: URL;
  try {
    parsed = new URL(apiBase);
  } catch {
    throw new ApiTestError(`Invalid --api-base URL: ${apiBase}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ApiTestError(`Unsupported API protocol: ${parsed.protocol}`);
  }

  if (allowRemote) {
    return;
  }

  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new ApiTestError(`Refusing non-local API base URL without --allow-remote: ${apiBase}`);
  }
}

function buildUrl(
  apiBase: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(path, apiBase);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  if (value === undefined) {
    return 'undefined';
  }

  return shortBody(value);
}
