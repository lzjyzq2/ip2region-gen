import fs from 'fs';
import path from 'path';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { parse_qqwry } from '../src/parse_qqwry';

describe('parse_qqwry.ts tests', () => {
    const testDataPath = path.join(__dirname, '..', 'data', 'qqwry.dat');
    const testOutputPath = path.join(__dirname, '..', 'data', 'test_qqwry_output.txt');
    
    // 测试前清理
    beforeAll(() => {
        if (fs.existsSync(testOutputPath)) {
            fs.unlinkSync(testOutputPath);
        }
    });

    // 测试后清理
    afterAll(() => {
        if (fs.existsSync(testOutputPath)) {
            fs.unlinkSync(testOutputPath);
        }
    });

    test('should parse qqwry.dat file to text format', async () => {
        // 确保输入文件存在
        expect(fs.existsSync(testDataPath)).toBe(true);
        
        // 执行解析
        await parse_qqwry(testDataPath, testOutputPath);
        
        // 检查输出文件是否生成
        expect(fs.existsSync(testOutputPath)).toBe(true);
        
        // 检查文件大小是否合理
        const stats = fs.statSync(testOutputPath);
        expect(stats.size).toBeGreaterThan(0);
        
        // 读取部分内容检查格式
        const content = fs.readFileSync(testOutputPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        
        // 至少应该有一些行数据
        expect(lines.length).toBeGreaterThan(0);
        
        // 检查第一行是否符合格式 (IP范围 + 地区信息)
        if (lines.length > 0) {
            const firstLine = lines[0].trim();
            // 应该包含IP地址格式
            expect(firstLine).toMatch(/\d+\.\d+\.\d+\.\d+\s+\d+\.\d+\.\d+\.\d+\s+ \S+/);
        }
    }, 30000); // 增加超时时间，因为处理大文件可能需要较长时间
});