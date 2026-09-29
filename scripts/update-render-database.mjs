import {readFile} from 'node:fs/promises';

const [serviceId, renderConfig = '.local-cache/render-auth/cli.yaml', environmentFile = '.env'] = process.argv.slice(2);
if (!/^srv-[a-z0-9]+$/.test(serviceId ?? '')) {
  console.error('Usage: node scripts/update-render-database.mjs <service-id> [render-cli-config] [env-file]');
  process.exit(1);
}

const [config, environment] = await Promise.all([
  readFile(renderConfig, 'utf8'),
  readFile(environmentFile, 'utf8')
]);

const apiBlock = config.match(/^api:\s*\r?\n((?:^[ \t]+.*(?:\r?\n|$))*)/m)?.[1] ?? '';
const token = apiBlock.match(/^\s*key:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1];
const databaseUrl = environment.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1];
if (!token) throw new Error('Render CLI token not found. Run render login first.');
if (!databaseUrl || !/^postgres(ql)?:\/\//.test(databaseUrl)) throw new Error('Valid DATABASE_URL not found.');

const headers = {accept: 'application/json', authorization: `Bearer ${token}`, 'content-type': 'application/json'};
const update = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars/DATABASE_URL`, {
  method: 'PUT', headers, body: JSON.stringify({value: databaseUrl})
});
if (!update.ok) throw new Error(`Render rejected DATABASE_URL update (${update.status}).`);

const deploy = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
  method: 'POST', headers, body: JSON.stringify({clearCache: 'do_not_clear', deployMode: 'build_and_deploy'})
});
if (!deploy.ok) throw new Error(`DATABASE_URL changed, but Render deploy could not start (${deploy.status}).`);
const result = await deploy.json();
console.log(JSON.stringify({databaseUpdated: true, deployId: result.id, status: result.status}, null, 2));
