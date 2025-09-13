# ip2region-gen

ip2region-gen是离线IP地址定位库和IP定位数据管理框架[ip2region](https://ip2region.net)在`Nodejs`下的一个离线IP地址定位库和命令行工具。既可以集成到项目中，也可以作为命令行工具使用。

## Language: 中文 | [English](README.md)

## 目录

- [ip2region-gen](#ip2region-gen)
  - [Language: 中文 | English](#language-中文--english)
  - [目录](#目录)
  - [环境需求](#环境需求)
  - [安装](#安装)
    - [命令行工具全局安装](#命令行工具全局安装)
    - [作为项目依赖安装](#作为项目依赖安装)
  - [使用方式](#使用方式)
    - [命令行用法](#命令行用法)
    - [作为 npm 包使用](#作为-npm-包使用)
  - [相关链接](#相关链接)
  - [开发说明](#开发说明)
  - [贡献指南](#贡献指南)

---

## 环境需求

- Node.js >= 20.0.0

## 安装

### 命令行工具全局安装

```bash
npm install -g ip2region-gen
```

### 作为项目依赖安装

```bash
npm install ip2region-gen
```

## 使用方式

### 命令行用法

```bash
ip2region-gen [command] [options]
```

**可用命令：**

- `gen`：生成二进制数据库文件
  示例：

  ```bash
  ip2region-gen gen --src=./data/ip.test.txt --dst=./data/ip2region.xdb
  ```

- `search`：查询 xdb 文件中的ip信息
  
  示例：

  ```bash
  ip2region-gen search --src=./data/ip2region.xdb --ip=1.0.63.255
  # >> IP: 1.0.63.255
  # >> Region: 中国|0|广东省|广州市|电信
  # >> IO count: 4
  # >> Time cost: 1024.7 μs
  ```

- `parse`：解析`qqwry.dat`文件为文本文件
  
  示例:

  ```bash
  ip2region-gen parse --src=./data/qqwry.dat --dst=./data/qqwry.txt
  ```

- `trim`：格式化`qqwry.txt`为`xdb`数据文本文件
  
  示例：

  ```bash
  ip2region-gen trim --src=./data/qqwry.txt --dst=./data/ip2region.txt
  ```

  该命令用于将`qqwry.txt`转换为指定格式的`ip2region.txt`数据文本文件文件。默认的处理函数仅转换中国定位数据，以外数据将会转换为未知。
  比如：

  ```csv
  1.1.64.0  1.1.127.255  日本–东京都I2Ts_Inc
  ```

  将会被转换为：

  ```csv
  1.1.64.0|1.1.127.255|海外|未知|未知|未知
  ```

  所以可以为当前命令指定自定义处理数据转换的方法，通过 `--process` 参数指定处理配置文件。例如：

  ```bash
  ip2region-gen trim --src=./data/qqwry.txt --dst=./data/ip2region.txt --process=./data/ip2region.config.js
  ```

  此外也可以在当前工作目录或源文件同目录下建立`ip2region.config.(js|ts)`文件，命令执行时将自动查找配置文件。将在如下文件夹中查找：

  - 当前工作目录
  - 指定源文件同目录
  
  配置文件`ip2region.config.js`的内容为：

  ```js
  /**
   * @param {string} line - 输入行
   * @returns {string} 处理后的行
   */
  export default function (line) {
    const combines = line.split('  ')
    if(combines.length < 2) {
        return false;
    }
    let str = combines.length > 2 ? combines[2] : ''
    const region = str.split('-')?.[0] ?? '未知'
    return `${combines[0]}|${combines[1]}|${region}`;
  }
  ```

  该配置文件将会处理输入的每一行数据，并返回处理后的结果。此时转换的数据将会变为：

  ```csv
  1.1.64.0|1.1.127.255|日本–东京都I2Ts_Inc
  ```

- `convert`：将 qqwry.dat 转换为 xdb 文件
  此命令会直接将qqwry.dat转换为xdb文件，同样也支持`--process`参数。实例如下：

  ```bash
  ip2region-gen convert --dat=./data/qqwry.dat --xdb=./data/ip2region.xdb --process=./data/ip2region.config.js
  ```

---

### 作为 npm 包使用

```javascript
import { convert_region, parse_qqwry, new_maker, newWithFileOnly, Vector_Index_Policy } from 'ip2region-gen';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import trimer from './ip2region.config';

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
  // 支持传入自定义处理函数
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
```

---

## 相关链接

- [ip2region](https://github.com/lionsoul2014/ip2region)
- [纯真ip库（qqwry.dat）转ip2region.xdb](https://zhuanlan.zhihu.com/p/1916893794655254095)
- [qqwry.bat](https://github.com/metowolf/qqwry.dat)

## 开发说明

- 项目使用 `TypeScript` 编写，源代码位于 `src` 目录。
- 安装依赖：

    ```bash
    npm install
    ```

- 构建项目：

    ```bash
    npm run build
    ```

---

## 贡献指南

欢迎任何形式的贡献！如需参与，请遵循以下流程：

1. Fork 本仓库并克隆到本地。
2. 创建新分支进行您的更改。
3. 提交更改并推送到您的分支。
4. 创建 Pull Request，并详细描述您的改动内容。

建议在提交前运行相关测试，确保代码质量。
如有问题或建议，欢迎通过 Issue 反馈。

---
