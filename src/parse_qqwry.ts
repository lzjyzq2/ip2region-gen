import { readFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import iconv from 'iconv-lite';
import { isMainModule } from './util.js';
import { enableLogger, logger } from './logger.js';

function readUInt24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function ipToStr(ip: number): string {
  return [(ip >> 24) & 0xff, (ip >> 16) & 0xff, (ip >> 8) & 0xff, ip & 0xff].join('.') + '  ';
}

function parseRecord(dat: Buffer, recordOffset: number): string {
  let pos = recordOffset;
  const endIp = dat.readUInt32LE(pos);
  pos += 4;
  let res = ipToStr(endIp);

  let count = 0;
  let preOffset = 0;
  while (count < 2) {
    let mod = dat[pos];
    pos++;
    if (mod === 0x01 || mod === 0x02) {
      const offset = readUInt24LE(dat, pos);
      preOffset = pos + 3;
      pos = offset;
    } else {
      pos--;
      let end = pos;
      while (dat[end] !== 0 && end < dat.length) end++;
      res += iconv.decode(dat.slice(pos, end), 'gbk');
      pos = end + 1;
      count++;
      if (count === 1 && mod !== 0x01 && mod !== 0x02) {
        let end2 = pos;
        while (dat[end2] !== 0 && end2 < dat.length) end2++;
        res += iconv.decode(dat.slice(pos, end2), 'gbk');
        pos = end2 + 1;
        count++;
      }
    }
    if (mod === 0x02 && count === 1) {
      pos = preOffset;
    }
  }
  res += '\n';
  return res;
}

export async function parse_qqwry(datFile: string, outFile: string): Promise<void> {
  const dat = await readFile(datFile);
  const startIndexOffset = dat.readUInt32LE(0);
  const endIndexOffset = dat.readUInt32LE(4);
  const totalRecords = Math.floor((endIndexOffset - startIndexOffset) / 7);
  const out = createWriteStream(outFile, { flags: 'w', encoding: 'utf-8' });

  return new Promise<void>((resolve, reject) => {
    let i = 0;
    let offset = startIndexOffset;

    function writeNext() {
      let canWrite = true;
      while (i < totalRecords && canWrite) {
        try {
          const startIp = dat.readUInt32LE(offset);
          const recordOffset = readUInt24LE(dat, offset + 4);
          const line = ipToStr(startIp) + parseRecord(dat, recordOffset);
          canWrite = out.write(line);
          i++;
          offset += 7;
        } catch (e) {
          reject(e);
          out.end();
          return;
        }
      }
      if (i < totalRecords) {
        // 缓冲区满了，等待 drain 事件
        out.once('drain', writeNext);
      } else {
        out.end();
      }
    }

    out.on('finish', () => {
      logger.info(`解析完成，结果输出到: ${outFile}`);
      resolve();
    });
    out.on('error', (err) => {
      logger.error('解析出错:', err);
      reject(err);
    });

    writeNext();
  });
}

function print_help() {
  console.log(`${process.argv[1]} parse [command options]`);
  console.log('options:');
  console.log(' --src     string      source qqwry.dat file path');
  console.log(' --dst     string      destination text file path');
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let datFile: string | null = null;
  let outFile: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--src=')) datFile = arg.slice(6);
    else if (arg.startsWith('--dst=')) outFile = arg.slice(6);
    else if (!datFile) datFile = arg;
    else if (!outFile) outFile = arg;
  }
  if (!datFile) {
    print_help();
    process.exit(1);
  }
  return {
    datFile: datFile,
    outFile: outFile || './qqwry.txt',
  };
}

export async function main() {
  enableLogger(true);
  const { datFile, outFile } = parseArgs();
  await parse_qqwry(datFile, outFile);
}

if (isMainModule(import.meta.url)) {
  main();
}
