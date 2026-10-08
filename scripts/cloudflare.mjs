import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = resolve(root, '.cloudflare');
const configPath = resolve(directory, 'wrangler.json');
const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js');

export function deploymentConfig(
  { account, database, name, origin = '' },
  previous,
  mode = 'cloudflare',
) {
  if (
    !/^[a-f0-9]{32}$/.test(account) ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(database) ||
    !/^[a-z][a-z0-9-]{2,62}$/.test(name) ||
    !['sites', 'cloudflare'].includes(mode)
  )
    throw new Error('Invalid deployment identifiers or mode');
  let site;
  if (mode === 'sites') {
    site = new URL(origin);
    if (
      site.protocol !== 'https:' ||
      !site.hostname.endsWith('.chatgpt.site') ||
      site.port ||
      site.username ||
      site.password ||
      site.pathname !== '/' ||
      site.search ||
      site.hash
    )
      throw new Error('Expected a root Sites HTTPS origin');
  }
  if (
    previous?.vars.BACKEND_MODE === 'cloudflare' &&
    mode === 'sites' &&
    previous.vars.PUBLIC_ENABLED === 'true'
  )
    throw new Error('Reverse cutover requires a separately reviewed fresh-window rehearsal');
  const template = JSON.parse(readFileSync(resolve(root, 'wrangler.cloudflare.json'), 'utf8'));
  const vars = { ...template.vars, ...previous?.vars };
  delete vars.SITES_ORIGIN;
  return {
    ...template,
    name,
    account_id: account,
    main: '../core/cloudflare-worker.ts',
    workers_dev: true,
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'agent-signal',
        database_id: database,
        migrations_dir: '../drizzle',
      },
    ],
    vars: {
      ...vars,
      BACKEND_MODE: mode,
      ...(site ? { SITES_ORIGIN: site.origin } : {}),
      STATE_EPOCH:
        previous?.vars.BACKEND_MODE === mode ? previous.vars.STATE_EPOCH : new Date().toISOString(),
    },
  };
}
export function pilotConfig(previous, enabled, now = new Date().toISOString()) {
  if (previous.vars.BACKEND_MODE !== 'cloudflare')
    throw new Error('Pilot requires direct Cloudflare hosting');
  return {
    ...previous,
    vars: {
      ...previous.vars,
      PUBLIC_ENABLED: enabled ? 'true' : previous.vars.PUBLIC_ENABLED,
      REPORTING_ENABLED: String(enabled),
      STATE_EPOCH:
        enabled && previous.vars.REPORTING_ENABLED !== 'true' ? now : previous.vars.STATE_EPOCH,
    },
  };
}
function execute(args) {
  const child = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      WRANGLER_LOG_PATH: resolve(directory, 'logs'),
    },
  });
  if (child.status !== 0)
    throw new Error('Cloudflare command failed; inspect deployment state before retrying');
}
export function requireReleaseSource(directory = root) {
  const readGit = (args) => {
    const reply = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    if (reply.status !== 0)
      throw new Error('Deployment requires a clean, exactly tagged release checkout');
    return reply.stdout.trim();
  };
  const tag = readGit(['describe', '--exact-match', '--tags', 'HEAD']);
  if (!/^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(tag) || readGit(['status', '--porcelain']))
    throw new Error('Deployment requires a clean, exactly tagged release checkout');
  return { tag, commit: readGit(['rev-parse', 'HEAD']) };
}
function deployCandidate(next) {
  const source = requireReleaseSource();
  const candidate = resolve(directory, 'candidate.json');
  writeFileSync(candidate, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  execute(['deploy', '--config', candidate, '--outdir', resolve(directory, 'deployed-bundle')]);
  writeFileSync(
    resolve(directory, 'deployment-source.json'),
    JSON.stringify({ ...source, recordedAt: new Date().toISOString() }, null, 2) + '\n',
    { mode: 0o600 },
  );
  writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
}
export async function verifyDeployment(
  endpoint,
  config,
  privateToken,
  send = fetch,
  attempts = 45,
) {
  const url = new URL(endpoint);
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.workers.dev') ||
    url.hostname.split('.')[0] !== config.name ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Invalid stable deployment endpoint');
  if (config.vars.PUBLIC_ENABLED !== 'true' && !privateToken)
    throw new Error(
      'Private rehearsal verification requires PRIVATE_ACCESS_TOKEN in the process environment',
    );
  const headers = { 'Content-Type': 'application/json' };
  if (config.vars.PUBLIC_ENABLED !== 'true') headers['X-Agent-Signal-Private'] = privateToken;
  let consecutive = 0;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await send(new URL('/api/v1/check', url), {
      method: 'POST',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        cohort: {
          service: 'github',
          operation: 'git_push',
          access: 'git_https',
          environment: 'unknown',
          error: 'http_503',
        },
      }),
    });
    const expected = config.vars.REPORTING_ENABLED === 'true' ? 200 : 503;
    const matches =
      response.status === expected &&
      response.headers.get('X-Agent-Signal-Backend') === config.vars.BACKEND_MODE &&
      response.headers.get('X-Agent-Signal-Epoch') === config.vars.STATE_EPOCH;
    await response.body?.cancel();
    consecutive = matches ? consecutive + 1 : 0;
    if (consecutive === 3) return;
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    'Live backend verification failed; do not claim cutover success or automatically replay writes',
  );
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const previous = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, 'utf8'))
    : undefined;
  if (command === 'prepare') {
    if (previous)
      throw new Error('Configuration already exists; preserve its endpoint and deployment state');
    const [account, database, name, origin] = args;
    writeFileSync(
      configPath,
      JSON.stringify(deploymentConfig({ account, database, name, origin }), null, 2) + '\n',
      { mode: 0o600 },
    );
    console.log('Prepared guarded deployment configuration; no deployment performed.');
    return;
  }
  if (!previous) throw new Error('Run prepare first');
  if (command === 'pilot-open' || command === 'pilot-stop') {
    if (command === 'pilot-open' && args[0] !== '--approved')
      throw new Error('Opening public reporting requires explicit launch approval and --approved');
    if (command === 'pilot-stop' && previous.vars.PUBLIC_ENABLED !== 'true')
      throw new Error('Configuration is already private; inspect live state before changing it');
    const next = pilotConfig(previous, command === 'pilot-open');
    const endpoint = JSON.parse(readFileSync(resolve(directory, 'endpoint.json'), 'utf8')).url;
    deployCandidate(next);
    await verifyDeployment(endpoint, next);
    console.log(
      command === 'pilot-open'
        ? 'Public pilot enabled and verified.'
        : 'Reporting stopped and verified.',
    );
    return;
  }
  if (command === 'dry-run')
    return execute([
      'deploy',
      '--config',
      configPath,
      '--dry-run',
      '--outdir',
      resolve(directory, 'bundle'),
    ]);
  if (command === 'migrate')
    return execute(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', configPath]);
  if (command === 'deploy' || command === 'cutover') {
    const endpoint = JSON.parse(readFileSync(resolve(directory, 'endpoint.json'), 'utf8')).url;
    if (previous.vars.PUBLIC_ENABLED !== 'true' && !process.env.PRIVATE_ACCESS_TOKEN)
      throw new Error(
        'Private rehearsal deployment requires PRIVATE_ACCESS_TOKEN for live verification',
      );
    const mode = command === 'cutover' ? 'cloudflare' : previous.vars.BACKEND_MODE;
    const next = deploymentConfig(
      {
        account: previous.account_id,
        database: previous.d1_databases[0].database_id,
        name: previous.name,
        origin: previous.vars.SITES_ORIGIN,
      },
      previous,
      mode,
    );
    deployCandidate(next);
    await verifyDeployment(endpoint, next, process.env.PRIVATE_ACCESS_TOKEN);
    console.log(`Deployment and live backend verification passed: ${mode}.`);
    return;
  }
  throw new Error('Expected prepare, dry-run, migrate, deploy, cutover, pilot-open or pilot-stop');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
