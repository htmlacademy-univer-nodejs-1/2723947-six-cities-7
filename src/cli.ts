#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import chalk from 'chalk';
import {Readable, Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {readOffers} from './tsv-file-reader.js';
import {generateOffers} from './offer-generator.js';

const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');

function printHelp(): void {
  console.log(chalk.cyan('Программа для подготовки данных для REST API сервера.'));
  console.log(chalk.dim('Использование: npm run cli -- --<command> [аргументы]'));
  console.log(`${chalk.green('--help')}                         показать справку`);
  console.log(`${chalk.green('--version')}                      показать версию из package.json`);
  console.log(`${chalk.green('--import <path>')}                прочитать TSV и вывести предложения`);
  console.log(`${chalk.green('--generate <n> <path> <url>')}     сгенерировать TSV из данных JSON-сервера`);
}

async function importOffers(path: string): Promise<void> {
  let count = 0;
  async function* results(): AsyncGenerator<string> {
    for await (const offer of readOffers(path)) {
      yield `${chalk.green(`Предложение ${++count}:`)}\n${JSON.stringify(offer)}\n`;
    }
    yield `${chalk.cyan(`Импортировано предложений: ${count}`)}\n`;
  }
  await pipeline(Readable.from(results()), new Writable({
    write(chunk, encoding, callback) {
      process.stdout.write(chunk, encoding, callback);
    },
  }));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case undefined:
    case '--help':
      printHelp();
      return;
    case '--version': {
      const {version} = JSON.parse(readFileSync(packagePath, 'utf8')) as {version: string};
      console.log(chalk.green(version));
      return;
    }
    case '--import': {
      if (args.length !== 1) {
        throw new Error('Укажите путь к TSV-файлу: --import <path>');
      }
      await importOffers(args[0]);
      return;
    }
    case '--generate': {
      const count = Number(args[0]);
      if (args.length !== 3 || !/^\d+$/.test(args[0]) || !Number.isSafeInteger(count) || count < 1) {
        throw new Error('Укажите положительное целое число, путь и URL: --generate <n> <path> <url>');
      }
      await generateOffers(count, args[1], args[2]);
      console.log(chalk.cyan(`Сгенерировано предложений: ${count}. Файл: ${args[1]}`));
      return;
    }
    default:
      throw new Error(`Неизвестная команда: ${command}. Используйте --help.`);
  }
}

main().catch((error: Error) => {
  console.error(chalk.red(`Ошибка: ${error.message}`));
  process.exitCode = 1;
});
