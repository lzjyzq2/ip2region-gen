import fs from 'fs';
import path from 'path';
import { gen_db } from '../src/db_gen';
import { newWithFileOnly, newWithVectorIndex, loadVectorIndexFromFile } from '../src/searcher';
import { describe, beforeEach, afterEach, test, expect} from 'vitest'

describe('db_gen.ts tests', () => {
    const testDataPath = path.join(__dirname, '..', 'data', 'ip.test.txt');
    const testDbPath = path.join(__dirname, 'test_ip2region.xdb');
    
    console.log(testDataPath, testDbPath)
    // 测试前清理
    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    // 测试后清理
    afterEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('should generate database file from ip test data', async () => {
        // 生成数据库文件
        await gen_db(testDataPath, testDbPath);
        
        // 检查数据库文件是否生成
        expect(fs.existsSync(testDbPath)).toBe(true);
        
        // 检查文件大小是否合理
        const stats = fs.statSync(testDbPath);
        expect(stats.size).toBeGreaterThan(0);
    });

    test('should generate database file with vector index policy', async () => {
        // 生成数据库文件
        await gen_db(testDataPath, testDbPath);
        
        // 检查数据库文件是否生成
        expect(fs.existsSync(testDbPath)).toBe(true);
        
        // 验证可以通过vector index方式搜索
        const searcher = newWithFileOnly(testDbPath);
        const result = await searcher.search('1.0.1.10');
        expect(result.region).toContain('中国');
        expect(result.region).toContain('福建省');
        expect(result.region).toContain('福州市');
    });

    test('should generate database file with btree index policy', async () => {
        // 生成数据库文件
        await gen_db(testDataPath, testDbPath, 1); // BTree_Index_Policy = 1
        
        // 检查数据库文件是否生成
        expect(fs.existsSync(testDbPath)).toBe(true);
        
        // 验证可以通过文件方式搜索
        const searcher = newWithFileOnly(testDbPath);
        const result = await searcher.search('1.0.4.5');
        expect(result.region).toContain('澳大利亚');
    });
});