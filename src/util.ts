import path from 'path';
import os from 'os';
import { pathToFileURL } from 'url';
import fs from 'fs/promises';
import { logger } from './logger.js';

const _SHIFT_INDEX = [24, 16, 8, 0];

export function splitN(str: string, sep: string, maxsplit: number): string[] {
  const result: string[] = [];
  let lastIndex = 0;
  let cnt = 0;
  let idx;
  while (cnt < maxsplit && (idx = str.indexOf(sep, lastIndex)) !== -1) {
    result.push(str.slice(lastIndex, idx));
    lastIndex = idx + sep.length;
    cnt += 1;
  }
  result.push(str.slice(lastIndex));
  return result;
}

export function check_ip(ip: string): number {
  if (!is_ipv4(ip)) return -1;
  const ps = ip.split('.');
  let val = 0;
  for (let i = 0; i < ps.length; i++) {
    let d = parseInt(ps[i]);
    val = (val | (d << _SHIFT_INDEX[i])) >>> 0; // 强制无符号32位
  }
  return val;
}

export function long2ip(num: number): string {
  if (num < 0 || num > 0xffffffff) return '';
  return [(num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff].join('.');
}

export function is_ipv4(ip: string): boolean {
  const ps = ip.split('.');
  if (ps.length !== 4) return false;
  for (const p of ps) {
    if (!/^\d+$/.test(p) || p.length > 3 || parseInt(p) < 0 || parseInt(p) > 255) {
      return false;
    }
  }
  return true;
}

/**
 * 判断当前模块是否为主模块（即直接通过node运行）
 * 仅支持 Node.js 20 及以上的 ESM 模块
 * @param importUrl
 * @returns boolean
 */
export function isMainModule(importUrl: string): boolean {
  // process.argv[1] 是入口文件的路径
  // import.meta.url 是当前文件的 file URL
  // 需要将 process.argv[1] 转为 file URL 进行对比
  const mainModule = `file://${process.argv[1].startsWith('/') ? '' : '/'}${process.argv[1]}`;
  // 比较两个路径是否相同
  return path.resolve(importUrl) === path.resolve(mainModule);
}

export type ProcessChunkHandler = (line: string) => string;

export async function getConfigHandler(inTxtPath: string, ip2regionConfigPath: string | null) {
  let handler: ProcessChunkHandler | undefined;
  let inputDir = path.dirname(inTxtPath);
  inputDir = path.isAbsolute(inputDir) ? inputDir : path.join(process.cwd(), inputDir);
  // 如果指定了处理配置文件，则加载它
  const configPaths = (ip2regionConfigPath ? [path.resolve(ip2regionConfigPath ?? '')] : []).concat([
    path.join(process.cwd(), 'ip2region.config.js'),
    path.join(process.cwd(), 'ip2region.config.ts'),
    path.join(inputDir, 'ip2region.config.js'),
    path.join(inputDir, 'ip2region.config.ts'),
  ]);
  const configPath = await Promise.all(
    configPaths.map(
      (path) =>
        new Promise<string>((resolve, _) => {
          try {
            fs.access(path)
              .then(() => resolve(path))
              .catch(() => resolve(''));
          } catch (e: any) {
            resolve('');
          }
        }),
    ),
  ).then((paths) => paths.find((p) => p));
  if (configPath) {
    try {
      const importUrl = pathToFileURL(configPath).href;
      const configModule = await import(importUrl);
      handler = configModule.default || configModule.handler;
    } catch (err) {
      logger.error(`无法加载处理配置文件: ${ip2regionConfigPath}`, err);
      process.exit(1);
    }
  }
  return handler;
}

export async function parseConvertArgs() {
  const argv = process.argv.slice(2);
  let datFile: string | null = null;
  let xdbFile: string | null = null;
  let handlePath: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--src=')) datFile = arg.slice(6);
    else if (arg.startsWith('--dst=')) xdbFile = arg.slice(6);
    else if (arg.startsWith('--process=')) handlePath = arg.slice(6);
  }
  const time = Date.now();
  const tempDir = os.tmpdir();
  const qqwryTxtFile = path.join(tempDir, `qqwry_${time}.txt`);
  const ip2RegionTxtFile = path.join(tempDir, `ip2region_${time}.txt`);
  return {
    datFile: datFile,
    xdbFile: xdbFile || './ip2region.xdb',
    qqwryTxtFile,
    ip2RegionTxtFile,
    handlePath,
  };
}

export function printConvertHelp() {
  console.log(`${process.argv[1]} convert [command options]`);
  console.log('options:');
  console.log(' --src string      source qqwry.dat file path');
  console.log(' --dst string      destination binary xdb file path');
  console.log(' --process string  custom trim qqwry.txt file js file');
}

export function parseSearchArgs() {
  const argv = process.argv.slice(2);
  let xdbFile: string | null = null;
  let ip: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--src=')) xdbFile = arg.slice(6);
    else if (arg.startsWith('--ip=')) ip = arg.slice(5);
  }
  return {
    xdbFile,
    ip,
  };
}

export function printSearchHelp() {
  console.log(`${process.argv[1]} search [command options]`);
  console.log('options:');
  console.log(' --src string    binary xdb file path');
  console.log(' --ip string     ip address to search');
}
