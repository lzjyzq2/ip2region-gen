#!/usr/bin/env node
import { main as db_gen_main, gen_db } from './db_gen.js';
import { main as parse_qqwry_main, parse_qqwry } from './parse_qqwry.js';
import { main as convert_region_main, convert_region } from './convert_region.js';
import { parseConvertArgs, printConvertHelp, parseSearchArgs, printSearchHelp, getConfigHandler } from './util.js';
import { newWithFileOnly } from './searcher.js';
import { enableLogger, logger } from './logger.js';

function print_help() {
  console.log('ip2region xdb nodejs maker');
  console.log(`${process.argv[1]} [command] [command options]`);
  console.log('Command: ');
  console.log('  gen          generate the binary db file');
  console.log('  parse        parse qqwry.bat as a text file');
  console.log('  trim         format the qqwry parsing file as an xdb prefile');
  console.log('  convert      convert from qqwry.bat to an xdb file');
  console.log('  search       search ip in xdb file');
}

async function main() {
  enableLogger(true)
  if (process.argv.length < 3) {
    print_help();
    return;
  }
  let cmd = process.argv[2].toLowerCase();
  if (cmd === 'gen') {
    db_gen_main();
  } else if (cmd === 'parse') {
    parse_qqwry_main();
  } else if (cmd === 'trim') {
    convert_region_main();
  } else if (cmd === 'convert') {
    const { datFile, xdbFile, qqwryTxtFile, ip2RegionTxtFile, handlePath } = await parseConvertArgs();
    if (!datFile || !xdbFile) {
      printConvertHelp();
      process.exit(1);
    }

    parse_qqwry(datFile, qqwryTxtFile)
      .then(async () => {
        const handler = await getConfigHandler(qqwryTxtFile, handlePath);
        return convert_region(qqwryTxtFile, ip2RegionTxtFile, handler);
      })
      .then(() => {
        return gen_db(ip2RegionTxtFile, xdbFile);
      })
      .then(() => {
        logger.info('xdb file generated done.');
      })
      .catch((err: any) => {
        logger.error('failed to generate xdb file, err:' + err);
        process.exit(1);
      });
  } else if (cmd === 'search') {
    const { xdbFile, ip } = parseSearchArgs();
    if (!xdbFile || !ip) {
      printSearchHelp();
      process.exit(1);
    }

    try {
      const searcher = newWithFileOnly(xdbFile);
      searcher
        .search(ip)
        .then((result) => {
          if (result.region) {
            logger.info(`IP: ${ip}`);
            logger.info(`Region: ${result.region}`);
            logger.info(`IO count: ${result.ioCount}`);
            logger.info(`Time cost: ${result.took} μs`);
          } else {
            logger.info(`IP: ${ip}`);
            logger.info('Region: Not found');
          }
        })
        .catch((err) => {
          logger.error('Search failed:', err.message);
          process.exit(1);
        });
    } catch (err: any) {
      logger.error('Failed to create searcher:', err.message);
      process.exit(1);
    }
  } else {
    print_help();
  }
}

main();
