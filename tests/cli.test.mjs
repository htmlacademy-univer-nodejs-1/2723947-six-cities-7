import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {generateOffers} from '../dist/offer-generator.js';
import {readOffers} from '../dist/tsv-file-reader.js';
import {COLUMNS, serializeOffer} from '../dist/tsv.js';

const {offers: templates} = JSON.parse(await readFile(new URL('../mocks/mock-server-data.json', import.meta.url), 'utf8'));

async function withDirectory(run) {
  const path = await mkdtemp(join(tmpdir(), 'six-cities-test-'));
  try {
    await run(path);
  } finally {
    await rm(path, {recursive: true, force: true});
  }
}

async function withServer(data, run) {
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(data));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}/offers`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function collect(path) {
  const offers = [];
  for await (const offer of readOffers(path)) {
    offers.push(offer);
  }
  return offers;
}

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

test('generation produces the requested number of valid offers and preserves city coordinates', async () => {
  await withDirectory(async (directory) => {
    await withServer(templates, async (url) => {
      const path = join(directory, 'offers.tsv');
      await generateOffers(100, path, url);
      const offers = await collect(path);
      assert.equal(offers.length, 100);
      for (const offer of offers) {
        const template = templates.find((item) => item.title === offer.title);
        assert.equal(offer.city, template.city);
        assert.deepEqual(offer.coordinates, template.coordinates);
        assert.equal(offer.isFavorite, false);
      }
      const before = await readFile(path);
      await assert.rejects(generateOffers(1, path, url), {code: 'EEXIST'});
      assert.deepEqual(await readFile(path), before);
      const result = await cli(['--import', path]);
      assert.equal(result.code, 0);
      assert.match(result.stdout, /Импортировано предложений: 100/);
    });
  });
});

test('invalid remote templates do not create an output file', async () => {
  await withDirectory(async (directory) => {
    for (const data of [[], {}, [{...templates[0], title: 'Bad\tTitle'}], [{...templates[0], images: []}]]) {
      await withServer(data, async (url) => {
        const path = join(directory, 'invalid.tsv');
        await assert.rejects(generateOffers(1, path, url));
        await assert.rejects(readFile(path), {code: 'ENOENT'});
      });
    }
  });
});

test('reader handles CRLF, BOM, UTF-8 across chunks and final line without a newline', async () => {
  await withDirectory(async (directory) => {
    const [offer] = await collect('mocks/offers.tsv');
    offer.title = 'Уютная квартира в центре';
    const row = serializeOffer(offer);
    const path = join(directory, 'utf8.tsv');
    const content = `\uFEFF${COLUMNS.join('\t')}\r\n\r\n${Array(200).fill(row).join('\r\n')}`;
    await writeFile(path, content);
    const offers = await collect(path);
    assert.equal(offers.length, 200);
    assert.equal(offers.at(-1).title, offer.title);
    await writeFile(path, `${COLUMNS.join('\t')}\ninvalid`);
    await assert.rejects(collect(path), /Строка 2/);
    await writeFile(path, 'x'.repeat(128 * 1024));
    await assert.rejects(collect(path), /предел 64 КиБ/);
    await assert.rejects(collect(join(directory, 'missing.tsv')), {code: 'ENOENT'});
  });
});

test('CLI reports argument and file errors with a nonzero exit code', async () => {
  for (const args of [['--generate'], ['--generate', '0', 'x.tsv', 'http://localhost'], ['--generate', '1.5', 'x.tsv', 'http://localhost'], ['--generate', '-1', 'x.tsv', 'http://localhost'], ['--import', '/missing-six-cities.tsv']]) {
    const result = await cli(args);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Ошибка:/);
  }
  assert.match((await cli([])).stdout, /--generate/);
  assert.match((await cli(['--version'])).stdout, /4\.0\.0/);
});
