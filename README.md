# ip2region-gen

ip2region-gen is an offline IP address location library and IP location data management framework for Node.js, based on [ip2region](https://ip2region.net). It can be used as both a library integrated into your project and as a command-line tool.

<p>
    <a target="_blank" href="https://github.com/semantic-release/semantic-release">
        <img src="https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release" alt="semantic-release" />
    </a>
    <a target="_blank" href="https://github.com/lzjyzq2/ip2region-gen/releases">
        <img alt="GitHub release (latest SemVer)" src="https://img.shields.io/github/v/release/lzjyzq2/ip2region-gen">
    </a>
    <a target="_blank" href="https://github.com/lzjyzq2/ip2region-gen/blob/dev/LICENSE">
        <img alt="GitHub License" src="https://img.shields.io/github/license/lzjyzq2/ip2region-gen">
    </a>
</p>

## Language: English | [中文](README_zh.md)

## Contents

- [ip2region-gen](#ip2region-gen)
  - [Language: English | 中文](#language-english--中文)
  - [Contents](#contents)
  - [Requirements](#requirements)
  - [Installation](#installation)
    - [Global Installation (CLI Tool)](#global-installation-cli-tool)
    - [Install as Project Dependency](#install-as-project-dependency)
  - [Usage](#usage)
    - [Command Line Usage](#command-line-usage)
    - [Usage as an npm Package](#usage-as-an-npm-package)
  - [Related](#related)
  - [Development Guide](#development-guide)
  - [Contributing Guide](#contributing-guide)

---

## Requirements

- Node.js >= 20.0.0

## Installation

### Global Installation (CLI Tool)

```bash
npm install -g ip2region-gen
```

### Install as Project Dependency

```bash
npm install ip2region-gen
```

## Usage

### Command Line Usage

```bash
ip2region-gen [command] [options]
```

**Available Commands:**

- `gen`: Generate binary database file  
  Example:

  ```bash
  ip2region-gen gen --src=./data/ip.test.txt --dst=./data/ip2region.xdb
  ```

- `search`: Query IP information in an xdb file  
  Example:

  ```bash
  ip2region-gen search --src=./data/ip2region.xdb --ip=1.0.63.255
  # >> IP: 1.0.63.255
  # >> Region: China|0|Guangdong Province|Guangzhou City|Telecom
  # >> IO count: 4
  # >> Time cost: 1024.7 μs
  ```

- `parse`: Parse `qqwry.dat` file to a text file  
  Example:

  ```bash
  ip2region-gen parse --src=./data/qqwry.dat --dst=./data/qqwry.txt
  ```

- `trim`: Format `qqwry.txt` to `xdb` data text file  
  Example:

  ```bash
  ip2region-gen trim --src=./data/qqwry.txt --dst=./data/ip2region.txt
  ```

  This command converts `qqwry.txt` to a `ip2region.txt` data text file in the required format.  
  The default handler only converts Chinese location data; foreign data will be converted to "unknown".
  For example:

  ```csv
  1.1.64.0  1.1.127.255  Japan–Tokyo I2Ts_Inc
  ```

  will be converted to:

  ```csv
  1.1.64.0|1.1.127.255|Overseas|Unknown|Unknown|Unknown
  ```

  You can specify a custom processing function for data conversion with the `--process` parameter.  
  For example:

  ```bash
  ip2region-gen trim --src=./data/qqwry.txt --dst=./data/ip2region.txt --process=./data/ip2region.config.js
  ```

  You can also create an `ip2region.config.(js|ts)` file in the current working directory or in the same directory as the source file. The command will automatically search for the config file in:

  - Current working directory
  - Source file directory

  The content of `ip2region.config.js` can be:

  ```js
  /**
   * @param {string} line - input line
   * @returns {string} processed line
   */
  export default function (line) {
    const combines = line.split('  ')
    if(combines.length < 2) {
        return false;
    }
    let str = combines.length > 2 ? combines[2] : ''
    const region = str.split('-')?.[0] ?? 'Unknown'
    return `${combines[0]}|${combines[1]}|${region}`;
  }
  ```

  This config file processes each line of data and returns the result.  
  The converted data will become:

  ```csv
  1.1.64.0|1.1.127.255|Japan–Tokyo I2Ts_Inc
  ```

- `convert`: Convert qqwry.dat to xdb file  
  This command directly converts qqwry.dat to an xdb file. The `--process` parameter is also supported. Example:

  ```bash
  ip2region-gen convert --dat=./data/qqwry.dat --xdb=./data/ip2region.xdb --process=./data/ip2region.config.js
  ```

---

### Usage as an npm Package

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
  // Custom processing function is supported
  await convert_region(testOutputFile, ip2RegionTxtFile, trimer);
}
async function gen_db() {
  const maker = new_maker(Vector_Index_Policy, ip2RegionTxtFile, ip2RegionDatPath);
  await maker.gen();
}

async function main() {
  console.log('Parsing qqwry.dat...');
  await parse();
  console.log('Converting to ip2region.txt...');
  await convert();
  console.log('Generating ip2region.xdb...');
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
      console.log(`Deleted temporary file: ${file}`);
    } catch (error) {
      console.error(`Failed to delete file: ${file}`, error);
    }
  }
}

main();
```

---

## Related

- [ip2region](https://github.com/lionsoul2014/ip2region)
- [纯真ip库（qqwry.dat）转ip2region.xdb](https://zhuanlan.zhihu.com/p/1916893794655254095)
- [qqwry.bat](https://github.com/metowolf/qqwry.dat)

## Development Guide

- The project is written in `TypeScript`, with source code in the `src` directory.
- Install dependencies:

    ```bash
    npm install
    ```

- Build the project:

    ```bash
    npm run build
    ```

---

## Contributing Guide

Any form of contribution is welcome! To participate, please follow these steps:

1. Fork this repository and clone it locally.
2. Create a new branch for your changes.
3. Commit your changes and push to your branch.
4. Create a Pull Request with a detailed description of your changes.

It is recommended to run relevant tests before submitting to ensure code quality.
If you have any questions or suggestions, feel free to open an Issue.
