import { accountMatrixModule } from './account-matrix';
import { adminModule } from './admin';
import { authModule } from './auth';
import { breedersModule } from './breeders';
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
import { seriesModule } from './series';
import { sharesModule } from './shares';
import { subscriptionModule } from './subscription';

const allModules: TestModule[] = [
  authModule,
  productsModule,
  seriesModule,
  breedersModule,
  imagesModule,
  featuredModule,
  sharesModule,
  adminModule,
  subscriptionModule,
  accountMatrixModule,
];

const defaultModuleOrder: TestModule[] = [
  authModule,
  productsModule,
  seriesModule,
  breedersModule,
  imagesModule,
  featuredModule,
  sharesModule,
  adminModule,
  subscriptionModule,
];

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const only = parseOnlyModules(options.only);
  const selectedModules =
    only === null ? defaultModuleOrder : allModules.filter((module) => only.includes(module.name));

  if (selectedModules.length === 0) {
    throw new ApiTestError('No modules selected. Check --only values.');
  }

  const ctx = createContext(options);

  if (options.clearTokenCache) {
    const cleared = await clearTokenCache();
    ctx.log.info('auth.token-cache.clear', {
      path: cleared.path,
      removed: cleared.removed,
    });
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

  ctx.log.info('runner.start', {
    apiBase: options.apiBase,
    modules: selectedModules.map((module) => module.name).join(','),
  });

  const results: Array<{ name: string; result: ModuleResult }> = [];
  const failures: Array<{ name: string; error: string }> = [];

  for (const module of selectedModules) {
    const startedAt = Date.now();
    ctx.log.info('module.start', { module: module.name, description: module.description });

    try {
      const result = await module.run(ctx);
      const durationMs = Date.now() - startedAt;
      ctx.log.ok('module.done', { module: module.name, checks: result.checks, durationMs });
      results.push({ name: module.name, result });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = formatError(error);
      ctx.log.error('module.fail', { module: module.name, durationMs, error: message });
      failures.push({ name: module.name, error: message });
    }
  }

  const totalChecks = results.reduce((sum, item) => sum + item.result.checks, 0);
  if (failures.length > 0) {
    ctx.log.error('runner.failed', {
      passedModules: results.length,
      failedModules: failures.map((entry) => entry.name).join(','),
      totalChecks,
    });

    const details = failures.map((entry) => `${entry.name}: ${entry.error}`).join(' | ');
    throw new ApiTestError(`Module failures detected: ${details}`);
  }

  ctx.log.ok('runner.done', {
    modules: results.length,
    totalChecks,
  });
}

main().catch((error: unknown) => {
  const message = formatError(error);
  console.error(`[ERROR] ${message}`);

  if (error instanceof Error && !(error instanceof ApiTestError) && error.stack) {
    console.error(error.stack);
  }

  process.exitCode = 1;
});
