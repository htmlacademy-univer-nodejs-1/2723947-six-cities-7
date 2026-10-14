import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const valid = {PORT: '3000', DB_HOST: '127.0.0.1', SALT: 'test-secret-salt'};

async function run(environment, envFile) {
  const cwd = await mkdtemp(join(tmpdir(), 'six-cities-app-'));
  try {
    if (envFile) {
      await writeFile(join(cwd, '.env'), envFile);
    }
    const env = {...process.env};
    for (const key of Object.keys(valid)) {
      delete env[key];
    }
    return spawnSync(process.execPath, [entry], {
      cwd, env: {...env, ...environment}, encoding: 'utf8',
    });
  } finally {
    await rm(cwd, {recursive: true, force: true});
  }
}

test('application loads .env, honors environment priority and logs initialization', async () => {
  const result = await run({PORT: '4000'}, Object.entries(valid).map(([key, value]) => `${key}=${value}`).join('\n'));
  assert.equal(result.status, 0, result.stderr);
  const logs = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(logs.map(({msg}) => msg), ['Порт приложения: 4000', 'Приложение инициализировано']);
  assert.ok(!result.stdout.includes(valid.SALT));
  assert.ok(!result.stdout.includes(valid.DB_HOST));
});

test('application rejects missing and invalid configuration without leaking values', async () => {
  for (const key of Object.keys(valid)) {
    const env = {...valid};
    delete env[key];
    const result = await run(env);
    assert.equal(result.status, 1, `missing ${key}`);
  }
  for (const invalid of [{PORT: 'wrong'}, {PORT: '65536'}, {DB_HOST: 'localhost'}, {SALT: '  '}]) {
    const result = await run({...valid, ...invalid});
    assert.equal(result.status, 1, JSON.stringify(invalid));
    assert.ok(!result.stdout.includes('Приложение инициализировано'));
    assert.ok(!result.stdout.includes(valid.SALT));
  }
});
