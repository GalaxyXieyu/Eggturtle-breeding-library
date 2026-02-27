import { accountMatrixModule } from './account-matrix';
import { adminModule } from './admin';
import { authModule } from './auth';
import { featuredModule } from './featured';
import { imagesModule } from './images';
import {
  ApiTestError,
  ModuleResult,
  TestModule,
  clearTokenCache,
  createContext,
  createLogger,
  formatError,
  parseCliArgs,
  parseOnlyModules,
  printUsage,
} from './lib';
import { productsModule } from './products';
import { sharesModule } from './shares';

const allModules: TestModule[] = [
  authModule,
  productsModule,
  imagesModule,
  featuredModule,
  sharesModule,
  adminModule,
  accountMatrixModule,
];

const defaultModuleOrder: TestModule[] = [
  authModule,
  productsModule,
  imagesModule,
  featuredModule,
  sharesModule,
  adminModule,
];

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (options.clearTokenCache) {
    const removed = await clearTokenCache(options);
    const log = createLogger(options.json);
    log.info('runner.token-cache-cleared', {
      path: options.tokenCachePath,
      removed,
    });
    return;
  }

  const only = parseOnlyModules(options.only);
  const selectedModules =
    only === null ? defaultModuleOrder : allModules.filter((module) => only.includes(module.name));

  if (selectedModules.length === 0) {
    throw new ApiTestError('No modules selected. Check --only values.');
  }

  if (!options.confirmWrites && selectedModules.some((module) => module.requiresWrites)) {
    const log = createLogger(options.json);
    log.info('runner.plan', {
      mode: 'dry-run',
      apiBase: options.apiBase,
      modules: selectedModules.map((module) => module.name).join(','),
    });
    log.info('runner.plan.note', {
      message: 'No requests were sent. Re-run with --confirm-writes to execute.',
    });
    return;
  }

  const ctx = createContext(options);
  ctx.log.info('runner.start', {
    apiBase: options.apiBase,
    modules: selectedModules.map((module) => module.name).join(','),
  });

  const results: Array<{ name: string; result: ModuleResult }> = [];

  for (const module of selectedModules) {
    const startedAt = Date.now();
    ctx.log.info('module.start', { module: module.name, description: module.description });
    const result = await module.run(ctx);
    const durationMs = Date.now() - startedAt;
    ctx.log.ok('module.done', { module: module.name, checks: result.checks, durationMs });
    results.push({ name: module.name, result });
  }

  const totalChecks = results.reduce((sum, item) => sum + item.result.checks, 0);
  ctx.log.ok('runner.done', {
    modules: results.length,
    totalChecks,
  });
}

main().catch((error: unknown) => {
  const message = formatError(error);
  console.error(`[ERROR] ${message}`);
  process.exitCode = 1;
});
