import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import os from 'os';
import { defaultConvertRegionHandler } from './defaultConvertRegionHandler.js';
import { isMainModule, getConfigHandler, ProcessChunkHandler } from './util.js';
import { enableLogger, logger } from './logger.js';

/**
 * 将大文件按行分割为多个小块，每块包含指定行数，方便并发处理。
 * @param inputPath - 输入文件路径
 * @param linesPerChunk - 每个文件块包含的最大行数
 * @returns 各块文件的路径
 */
async function splitFileByLines(inputPath: string, linesPerChunk: number = 10000): Promise<string[]> {
  const chunks: string[] = [];
  const tempDir = os.tmpdir();

  // 读取utf-8格式文本
  const readStream = createReadStream(inputPath, { encoding: 'utf-8' });
  let currentLines: string[] = [];
  let chunkIdx = 0;
  let lineBuffer = '';

  for await (const chunk of readStream) {
    lineBuffer += chunk;
    let lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() || '';

    for (const line of lines) {
      currentLines.push(line);
      if (currentLines.length >= linesPerChunk) {
        const chunkPath = path.join(tempDir, `ip2region_chunk_${chunkIdx}.txt`);
        await fs.writeFile(chunkPath, currentLines.join('\n'), 'utf-8');
        chunks.push(chunkPath);
        chunkIdx++;
        currentLines = [];
      }
    }
  }
  // 写入剩余行
  if (currentLines.length > 0) {
    const chunkPath = path.join(tempDir, `ip2region_chunk_${chunkIdx}.txt`);
    await fs.writeFile(chunkPath, currentLines.join('\n'), 'utf-8');
    chunks.push(chunkPath);
  }
  return chunks;
}

/**
 * 处理单个分块文件，应用和ISP映射，仅格式转换。
 * @param chunkPath - 输入分块路径
 * @param handler - 自定义处理函数，如果没有提供则使用默认处理函数
 * @returns 处理后输出文件路径
 */
async function processChunk(chunkPath: string, handler?: ProcessChunkHandler): Promise<string> {
  const outputPath = chunkPath.replace(/\.txt$/, '_out.txt');
  const lines = (await fs.readFile(chunkPath, 'utf-8')).split('\n');
  const result: string[] = [];

  // 如果没有提供自定义处理函数，则使用默认处理函数
  const processHandler = handler || defaultConvertRegionHandler;

  for (const line of lines) {
    if (!line.trim()) continue;
    const processedLine = processHandler(line);
    if (processedLine && typeof processedLine === 'string') {
      result.push(processedLine);
    }
  }

  await fs.writeFile(outputPath, result.join('\n') + '\n', 'utf-8');
  return outputPath;
}

/**
 * 合并所有分块处理后的输出为最终文件
 * @param outputPath - 最终输出文件路径
 * @param chunkOutputs - 各分块输出文件路径
 */
async function mergeFiles(outputPath: string, chunkOutputs: string[]): Promise<void> {
  const writeStream = createWriteStream(outputPath, { encoding: 'utf-8' });
  for (const chunkOutput of chunkOutputs) {
    const data = await fs.readFile(chunkOutput, 'utf-8');
    writeStream.write(data);
  }
  writeStream.end();
}

/**
 * 转换qqwry文本文件为ip2region.txt
 * @param inTxtPath - 原始输入文件路径（utf-8编码）
 * @param resultPath - 输出文件路径
 * @param handler - 自定义处理函数
 */
export async function convert_region(
  inTxtPath: string,
  resultPath: string = 'ip2region.txt',
  handler?: ProcessChunkHandler,
): Promise<void> {
  // 1. 按行分块
  const chunkPaths = await splitFileByLines(inTxtPath, 10000);

  // 2. 并发处理每个分块
  const concurrency = Math.max(2, os.cpus().length - 1);
  let idx = 0;
  const results: string[] = [];

  async function runBatch(): Promise<void> {
    const batch: Promise<string>[] = [];
    for (let i = 0; i < concurrency && idx < chunkPaths.length; i++, idx++) {
      batch.push(processChunk(chunkPaths[idx], handler));
    }
    if (batch.length === 0) return;
    results.push(...(await Promise.all(batch)));
    await runBatch();
  }
  await runBatch();

  // 3. 合并输出文件
  await mergeFiles(resultPath, results);

  // 4. 清理临时文件
  await Promise.all([...chunkPaths, ...results].map((f) => fs.unlink(f)));

  logger.info('转换完成，输出文件:', resultPath);
}

function print_help(): void {
  console.log(`${process.argv[1]} trim [command options]`);
  console.log('options:');
  console.log(' --src       string      source qqwry.txt file path');
  console.log(' --dst       string      format the qqwry parsing file as an xdb prefile');
  console.log(' --process   string      custom process config file path');
}

export async function main(): Promise<void> {
  enableLogger(true);
  const argv = process.argv.slice(2);
  let inTxtPath: string | null = null;
  let resultPath: string | null = null;
  let ip2regionConfigPath: string | null = null;

  // 解析命令行参数
  for (const arg of argv) {
    if (arg.startsWith('--src=')) inTxtPath = arg.slice(6);
    else if (arg.startsWith('--dst=')) resultPath = arg.slice(6);
    else if (arg.startsWith('--process=')) ip2regionConfigPath = arg.slice(10);
    else if (!inTxtPath) inTxtPath = arg;
    else if (!resultPath) resultPath = arg;
  }

  resultPath = resultPath || 'ip2region.txt';
  if (!inTxtPath) {
    print_help();
    process.exit(1);
  }

  const handler = await getConfigHandler(inTxtPath, ip2regionConfigPath);
  await convert_region(inTxtPath, resultPath, handler);
}

// 检查当前模块是否为主模块
if (isMainModule(import.meta.url)) {
  main();
}
