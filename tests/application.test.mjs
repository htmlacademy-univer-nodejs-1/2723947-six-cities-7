import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createConnection} from 'mongoose';

const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const loopback = ['127', '0', '0', '1'].join('.');
const valid = {PORT: '3000', MONGODB_URI: `mongodb://${loopback}:27017/six-cities`, SALT: 'test-secret-salt'};

function environment(overrides) {
  const env = {...process.env};
  for (const key of Object.keys(valid)) {
    delete env[key];
  }
  return {...env, ...overrides};
}

test('application rejects missing and invalid configuration without leaking values', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'six-cities-config-'));
  try {
    const invalid = [
      ...Object.keys(valid).map((key) => ({[key]: undefined})),
      {PORT: 'wrong'}, {PORT: '65536'}, {MONGODB_URI: 'localhost'}, {SALT: '  '},
    ];
    for (const overrides of invalid) {
      const env = environment({...valid, ...overrides});
      for (const key of Object.keys(env)) {
        if (env[key] === undefined) {
          delete env[key];
        }
      }
      const result = spawnSync(process.execPath, [entry], {cwd, env, encoding: 'utf8', timeout: 5000});
      assert.equal(result.status, 1, JSON.stringify(overrides));
      assert.match(result.stdout, /Проверьте обязательные переменные/);
      assert.doesNotMatch(result.stdout, /Приложение инициализировано/);
      assert.ok(!result.stdout.includes(valid.SALT) && !result.stdout.includes(valid.MONGODB_URI));
    }
  } finally {
    await rm(cwd, {recursive: true, force: true});
  }
});

test('Express implements the offer, favorite and user routes against MongoDB', {
  skip: !process.env.MONGODB_TEST_URI,
  timeout: 30000,
}, async () => {
  const uri = new URL(process.env.MONGODB_TEST_URI);
  uri.pathname = `/six_cities_http_${randomUUID().replaceAll('-', '')}`;
  const cwd = await mkdtemp(join(tmpdir(), 'six-cities-http-'));
  let child;
  let exited;
  let output = '';
  try {
    await writeFile(join(cwd, '.env'), `PORT=65535\nMONGODB_URI=${uri}\nSALT=${valid.SALT}\n`);
    child = spawn(process.execPath, [entry], {cwd, env: environment({PORT: '0'}), stdio: ['ignore', 'pipe', 'pipe']});
    exited = once(child, 'exit');
    child.stderr.on('data', (data) => { output += data; });
    const lines = createInterface({input: child.stdout});
    const port = await Promise.race([
      (async () => {
        for await (const line of lines) {
          output += `${line}\n`;
          const match = /Порт приложения: (\d+)/.exec(line);
          if (match) {
            return Number(match[1]);
          }
        }
        throw new Error(`Сервер не запустился: ${output}`);
      })(),
      exited.then(([code]) => { throw new Error(`Сервер завершился с кодом ${code}: ${output}`); }),
    ]);
    assert.ok(port > 0 && port !== 65535);

    const base = `http://${loopback}:${port}`;
    async function request(path, status, {method = 'GET', token, data, form} = {}) {
      const headers = token ? {Authorization: `Bearer ${token}`} : {};
      if (data !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      const response = await fetch(base + path, {method, headers, body: form ?? (data === undefined ? undefined : JSON.stringify(data))});
      assert.equal(response.status, status, `${method} ${path}`);
      if (status === 401) {
        assert.equal(response.headers.get('WWW-Authenticate'), 'Bearer');
      }
      return status === 204 ? response.text() : response.json();
    }

    function registration(email, withAvatar = false) {
      const form = new FormData();
      for (const [name, value] of Object.entries({name: 'Test User', email, password: 'test1234', type: 'regular'})) {
        form.set(name, value);
      }
      if (withAvatar) {
        const file = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrLsAAAAASUVORK5CYII=', 'base64');
        form.set('avatar', new Blob([file], {type: 'image/png'}), 'avatar.png');
      }
      return form;
    }

    const email = 'host@example.com';
    const host = await request('/users', 201, {method: 'POST', form: registration(email)});
    assert.deepEqual(Object.keys(host).sort(), ['avatarPath', 'email', 'id', 'name', 'type']);
    const defaultImage = await fetch(host.avatarPath);
    assert.equal(defaultImage.headers.get('Content-Type'), 'image/jpeg');
    assert.ok((await defaultImage.arrayBuffer()).byteLength > 0);
    await request('/users', 409, {method: 'POST', form: registration(email)});
    const guest = await request('/users', 201, {method: 'POST', form: registration('guest@example.com', true)});
    const uploaded = await fetch(guest.avatarPath);
    assert.equal(uploaded.headers.get('Content-Type'), 'image/png');
    assert.ok((await uploaded.arrayBuffer()).byteLength > 0);

    const login = (address, status = 200, password = 'test1234') =>
      request('/users/login', status, {method: 'POST', data: {email: address, password}});
    await login(email, 401, 'incorrect');
    const {token} = await login(email);
    const {token: guestToken} = await login(guest.email);
    assert.equal((await request('/users/login', 200, {token})).id, host.id);
    await request('/users', 403, {method: 'POST', token, form: registration('extra@example.com')});
    await request('/offers', 401, {token: 'invalid'});
    await request('/offers/favorites', 401);
    assert.deepEqual(await request('/offers', 200), []);

    const offer = await request('/offers', 201, {method: 'POST', token, data: {
      title: 'Sunny apartment near the Louvre',
      description: 'Bright apartment with a kitchen and a quiet bedroom.',
      publicationDate: '2026-10-01T12:00:00.000Z',
      city: 'Paris',
      previewImage: 'https://example.com/preview.jpg',
      images: Array.from({length: 6}, (_, i) => `https://example.com/photo-${i}.jpg`),
      isPremium: true,
      housingType: 'apartment',
      bedrooms: 2,
      maxAdults: 4,
      price: 1000,
      amenities: ['Washer'],
      coordinates: {latitude: 48.85, longitude: 2.35},
      authorId: guest.id,
      rating: 5,
    }});
    assert.equal(offer.author.id, host.id);
    assert.equal(offer.rating, 1);
    assert.equal(offer._id, undefined);
    assert.equal(offer.createdAt, undefined);
    const path = `/offers/${offer.id}`;
    assert.deepEqual(await request(path, 200), offer);
    assert.equal((await request('/offers?limit=1', 200))[0].author, undefined);
    assert.equal((await request('/offers/premium?city=Paris', 200))[0].id, offer.id);
    await request('/offers/invalid-id', 400);
    await request('/offers/000000000000000000000000', 404);
    await request(path, 403, {method: 'PATCH', token: guestToken, data: {price: 2000}});
    assert.equal((await request(path, 200, {method: 'PATCH', token, data: {price: 1100}})).price, 1100);

    assert.equal((await request(`${path}/favorite`, 200, {method: 'PUT', token: guestToken})).isFavorite, true);
    assert.equal((await request('/offers/favorites', 200, {token: guestToken}))[0].id, offer.id);
    assert.equal((await request(path, 200, {token})).isFavorite, false);
    assert.equal((await request(`${path}/favorite`, 200, {method: 'DELETE', token: guestToken})).isFavorite, false);
    await request(`${path}/comments`, 404);
    await request(path, 403, {method: 'DELETE', token: guestToken});
    assert.equal(await request(path, 204, {method: 'DELETE', token}), '');
    assert.equal(await request('/users/login', 204, {method: 'DELETE', token}), '');
    await request('/users/login', 401, {token});

    const malformed = await fetch(base + '/users/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{'});
    assert.equal(malformed.status, 400);
    assert.equal(typeof (await malformed.json()).message, 'string');
    assert.ok(!output.includes(valid.SALT) && !output.includes(uri.toString()));
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill();
      await exited;
    }
    try {
      const connection = await createConnection(uri.toString(), {serverSelectionTimeoutMS: 5000}).asPromise();
      try {
        await connection.dropDatabase();
      } finally {
        await connection.close();
      }
    } finally {
      await rm(cwd, {recursive: true, force: true});
    }
  }
});
