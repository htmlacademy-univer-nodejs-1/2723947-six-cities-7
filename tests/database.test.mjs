import 'reflect-metadata';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID, scryptSync} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {MongoDatabase} from '../dist/shared/database/mongo-database.js';
import {container} from '../dist/shared/di/container.js';
import {Component} from '../dist/shared/di/component.js';
import {readOffers} from '../dist/tsv-file-reader.js';

test('connection errors are logged without exposing the URI or credentials', async () => {
  const messages = [];
  const logger = {info: (message) => messages.push(message), error: (message) => messages.push(message)};
  const database = new MongoDatabase({openUri: async () => { throw new Error('mongodb://secret:password@host'); }}, logger);
  await assert.rejects(database.connect('mongodb://secret:password@host'), /Не удалось подключиться/);
  assert.equal(messages.length, 2);
  assert.ok(messages.every((message) => !/secret|password|host/.test(message)));
});

function cli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/cli.js', ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({code, stdout, stderr}));
  });
}

test('MongoDB services and CLI persist users, references and timestamps and close on errors', {
  skip: !process.env.MONGODB_TEST_URI,
  timeout: 60000,
}, async () => {
  const url = new URL(process.env.MONGODB_TEST_URI);
  url.pathname = `/six_cities_test_${randomUUID().replaceAll('-', '')}`;
  const uri = url.toString();
  const directory = await mkdtemp(join(tmpdir(), 'six-cities-db-'));
  const database = container.get(Component.Database);
  const connection = container.get(Component.MongoConnection);
  const users = container.get(Component.UserService);
  const offers = container.get(Component.OfferService);
  try {
    await database.connect(uri);
    const user = await users.create({name: 'Tester', email: 'tester@example.com', password: 'samplePass12', type: 'pro'});
    assert.equal((await users.findById(user.id)).email, user.email);
    assert.equal((await users.findByEmail(user.email)).passwordHash, undefined);
    assert.equal(await users.findByEmail('missing@example.com'), null);
    assert.equal(await users.findById('000000000000000000000000'), null);
    const rawUser = await connection.collection('users').findOne({_id: user._id});
    assert.equal(rawUser.password, undefined);
    const [salt, hash] = rawUser.passwordHash.split(':');
    assert.equal(scryptSync('samplePass12', salt, 64).toString('hex'), hash);
    assert.ok(rawUser.createdAt instanceof Date && rawUser.updatedAt instanceof Date);
    await assert.rejects(users.create({name: 'Duplicate', email: user.email, password: 'samplePass12', type: 'regular'}), {code: 11000});

    const iterator = readOffers('mocks/offers.tsv');
    const {value: {authorEmail: _email, ...data}} = await iterator.next();
    await iterator.return();
    const offer = await offers.create({...data, authorId: user.id});
    assert.equal((await offers.findById(offer._id.toString())).title, data.title);
    assert.equal(await offers.findById('000000000000000000000000'), null);
    assert.equal(offer.commentsCount, 0);
    assert.ok(offer.createdAt instanceof Date && offer.updatedAt instanceof Date);
    assert.deepEqual(offer.coordinates, data.coordinates);
    assert.equal(offer.author.email, user.email);

    const source = await readFile('mocks/offers.tsv', 'utf8');
    const rows = source.trimEnd().split('\n');
    const expectedCount = rows.length - 1;
    const uniqueEmails = new Set(rows.slice(1).map((row) => row.split('\t')[14]));
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await cli(['--import', 'mocks/offers.tsv', uri]);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, new RegExp(`Импортировано предложений: ${expectedCount}`));
      assert.match(result.stdout, /Соединение с MongoDB закрыто/);
      assert.ok(!result.stdout.includes(uri));
      assert.equal(await connection.collection('offers').countDocuments(), 1 + expectedCount * (attempt + 1));
      assert.equal(await connection.collection('users').countDocuments(), 1 + uniqueEmails.size);
    }
    const importedUser = await users.findByEmail([...uniqueEmails][0]);
    assert.equal(importedUser.type, 'regular');
    assert.ok(importedUser.avatarPath);
    const imported = await connection.collection('offers').findOne({author: importedUser._id});
    assert.ok(imported);
    assert.equal(imported.authorEmail, undefined);
    assert.equal(imported.commentsCount, 0);

    const invalidPath = join(directory, 'invalid.tsv');
    await writeFile(invalidPath, `${rows[0]}\n${rows[1]}\ninvalid\n`);
    const failure = await cli(['--import', invalidPath, uri]);
    assert.equal(failure.code, 1);
    assert.match(failure.stderr, /Строка 3/);
    assert.match(failure.stdout, /Сохранено предложений: 1/);
    assert.match(failure.stdout, /Соединение с MongoDB закрыто/);
    assert.equal(await connection.collection('offers').countDocuments(), 2 + expectedCount * 2);
    const missing = await cli(['--import', join(directory, 'missing.tsv'), uri]);
    assert.equal(missing.code, 1);
    assert.match(missing.stdout, /Соединение с MongoDB закрыто/);
  } finally {
    try {
      if (connection.readyState === 1) {
        await connection.dropDatabase();
      }
    } finally {
      await database.disconnect();
      await rm(directory, {recursive: true, force: true});
    }
  }
});
