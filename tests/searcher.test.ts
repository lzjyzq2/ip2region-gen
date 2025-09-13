import fs from 'fs';
import path from 'path';
import { gen_db } from '../src/db_gen';
import {
  newWithFileOnly,
  newWithVectorIndex,
  newWithBuffer,
  loadVectorIndexFromFile,
  loadContentFromFile,
  isValidIp,
} from '../src/searcher';
import { describe, beforeAll, afterAll, test, expect } from 'vitest';

describe('searcher.ts tests', () => {
  const testDataPath = path.join(__dirname, '..', 'data', 'ip.test.txt');
  const testDbPath = path.join(__dirname, 'test_ip2region_searcher.xdb');

  // 在所有测试前生成数据库
  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    // 生成测试数据库
    await gen_db(testDataPath, testDbPath);
  }, 10000);

  // 测试后清理
  afterAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should search with file only mode', async () => {
    const searcher = newWithFileOnly(testDbPath);

    // 测试澳大利亚IP
    const result1 = await searcher.search('1.0.0.10');
    expect(result1.region).toContain('澳大利亚');
    expect(result1.ioCount).toBeGreaterThan(0);
    expect(result1.took).toBeGreaterThan(0);

    // 测试中国福建福州IP
    const result2 = await searcher.search('1.0.1.10');
    expect(result2.region).toContain('中国');
    expect(result2.region).toContain('福建省');
    expect(result2.region).toContain('福州市');
    expect(result2.region).toContain('电信');

    // 测试泰国IP
    const result3 = await searcher.search('1.0.129.100');
    expect(result3.region).toContain('泰国');
    expect(result3.region).toContain('曼谷');
  });

  test('should search with vector index mode', async () => {
    const vectorIndex = loadVectorIndexFromFile(testDbPath);
    const searcher = newWithVectorIndex(testDbPath, vectorIndex);

    // 测试日本IP
    const result1 = await searcher.search('1.0.16.10');
    expect(result1.region).toContain('日本');
    expect(result1.ioCount).toBeGreaterThan(0);
    expect(result1.took).toBeGreaterThan(0);

    // 测试中国广东广州IP
    const result2 = await searcher.search('1.0.8.100');
    expect(result2.region).toContain('中国');
    expect(result2.region).toContain('广东省');
    expect(result2.region).toContain('广州市');
    expect(result2.region).toContain('电信');
  });

  test('should search with buffer mode', async () => {
    const buffer = loadContentFromFile(testDbPath);
    const searcher = newWithBuffer(buffer);

    // 测试日本冈山县IP
    const result1 = await searcher.search('1.0.100.50');
    expect(result1.region).toContain('日本');
    expect(result1.ioCount).toBe(0);
    expect(result1.took).toBeGreaterThan(0);

    // 测试泰国IP
    const result2 = await searcher.search('1.0.171.100');
    expect(result2.region).toContain('泰国');
    expect(result2.region).toContain('攀牙府');
  });

  test('should validate IP addresses correctly', () => {
    // 有效IP
    expect(isValidIp('1.0.0.1')).toBe(true);
    expect(isValidIp('255.255.255.255')).toBe(true);
    expect(isValidIp('192.168.1.1')).toBe(true);

    // 无效IP
    expect(isValidIp('256.1.1.1')).toBe(false);
    expect(isValidIp('1.1.1')).toBe(false);
    expect(isValidIp('1.1.1.1.1')).toBe(false);
    expect(isValidIp('abc.def.ghi.jkl')).toBe(false);
    expect(isValidIp('')).toBe(false);
  });

  test('should throw error for invalid IP', async () => {
    const searcher = newWithFileOnly(testDbPath);

    await expect(searcher.search('256.1.1.1')).rejects.toThrow('IP: 256.1.1.1 is invalid');

    await expect(searcher.search('invalid-ip')).rejects.toThrow('IP: invalid-ip is invalid');
  });

  test('should work with callback style', async (done) => {
    const searcher = newWithFileOnly(testDbPath);

    await searcher.search('1.0.1.10', (result, err) => {
      console.log(result, err);
      expect(err).toBeUndefined();
      expect(result).toBeDefined();
      expect(result!.region).toContain('中国');
      expect(result!.ioCount).toBeGreaterThan(0);
      expect(result!.took).toBeGreaterThan(0);
    });
  });
});
