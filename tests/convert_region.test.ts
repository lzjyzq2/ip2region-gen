import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { convert_region } from '../src/convert_region';

describe('convert_region', () => {
  const testDataDir = path.join(__dirname, '..', 'data');
  const testOutputFile = path.join(testDataDir, 'test_output.txt');

  beforeAll(async () => {
    try {
      await fs.unlink(testOutputFile);
    } catch (error) {
      // 如果文件不存在，忽略错误
    }
  });

  // 清理测试生成的文件
  afterAll(async () => {
    try {
      await fs.unlink(testOutputFile);
    } catch (error) {
      // 如果文件不存在，忽略错误
    }
  });

  it('转换qqwry.txt', async () => {
    const qqwryPath = path.join(testDataDir, 'qqwry.txt');

    // 检查测试数据文件是否存在
    try {
      await fs.access(qqwryPath);
    } catch (error) {
      throw new Error(`测试数据文件不存在: ${qqwryPath}`);
    }

    // 执行转换
    await convert_region(qqwryPath, testOutputFile);

    // 验证输出文件是否存在
    await fs.access(testOutputFile);

    // 读取输出文件内容
    const content = await fs.readFile(testOutputFile, 'utf-8');
    expect(content).toBeTruthy();

    // 检查输出内容是否符合预期格式 (IP段|IP段|国家|省份|城市|ISP)
    const lines = content.trim().split('\n');
    expect(lines.length).toBeGreaterThan(0);

    // 验证第一行的格式
    const firstLine = lines[0];
    const parts = firstLine.split('|');
    expect(parts.length).toBe(6); // 应该有6个部分

    console.log('测试通过: 成功转换了qqwry.txt文件');
  }, 30000); // 增加超时时间，因为文件处理可能需要一些时间
});
