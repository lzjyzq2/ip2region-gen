import trimer from './ip2region.config';
import { convert_region, parse_qqwry, new_maker, newWithFileOnly, Vector_Index_Policy } from '../src/index';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDataDir = path.join(__dirname, '..', 'data');
const qqwryDatPath = path.join(testDataDir, 'qqwry.dat');
const testOutputFile = path.join(testDataDir, 'qqwry_output.txt');
const ip2RegionTxtFile = path.join(testDataDir, 'ip2region.test.txt');
const ip2RegionDatPath = path.join(testDataDir, 'ip2region.xdb');

async function parse() {
  await parse_qqwry(qqwryDatPath, testOutputFile);
}

async function convert() {
  await convert_region(testOutputFile, ip2RegionTxtFile, trimer);
}
async function gen_db() {
  const maker = new_maker(Vector_Index_Policy, ip2RegionTxtFile, ip2RegionDatPath);
  await maker.gen();
}

async function main() {
  console.log('开始解析qqwry.dat...');
  await parse();
  console.log('开始转换ip2region.txt...');
  await convert();
  console.log('开始生成ip2region.xdb...');
  await gen_db();

  // test search
  const ip1 = '1.1.1.1';
  const ip2 = '1.1.14.210';
  const searcher = newWithFileOnly(ip2RegionDatPath);
  await searcher.search(ip1, (region, err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`${ip1} -> ${region?.region}`);
    }
  });
  const region = await searcher.search(ip2);
  console.log(`${ip2} -> ${region?.region}`);

  const files = [testOutputFile, ip2RegionTxtFile, ip2RegionDatPath];
  for (const file of files) {
    try {
      if(fs.existsSync(file)){
        fs.unlinkSync(file);
      }
      console.log(`已删除临时文件: ${file}`);
    } catch (error) {
      console.error(`删除文件失败: ${file}`, error);
    }
  }
}

main();
