/*
 * Modified by lzjyzq2 on 2025-08-03.
 * Based on work by Wu Jian Ping (2022/07/22).
 * Original project: https://gitee.com/lionsoul/ip2region/blob/master/binding/nodejs/index.js
 */

import * as fs from 'fs';

const VectorIndexSize = 8;
const VectorIndexCols = 256;
const VectorIndexLength = 256 * 256 * (4 + 4);
const SegmentIndexSize = 14;
const IP_REGEX = /^((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.){3}(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/;

// 定义搜索结果的接口
export interface SearchResult {
  region: string | null;
  ioCount: number;
  took: number;
}

// 定义IO状态的接口
interface IoStatus {
  ioCount: number;
}

// 定义回调函数类型
export type SearchCallback = (result: SearchResult | null, err?: Error | null) => void;

export class Searcher {
  private _dbFile: string | null;
  private _vectorIndex: Buffer | null;
  private _buffer: Buffer | null;

  constructor(dbFile: string | null, vectorIndex: Buffer | null, buffer: Buffer | null) {
    this._dbFile = dbFile;
    this._vectorIndex = vectorIndex;
    this._buffer = buffer;

    if (this._buffer) {
      this._vectorIndex = this._buffer.subarray(256, 256 + VectorIndexLength);
    }
  }

  private async getStartEndPtr(
    idx: number,
    fd: number | null,
    ioStatus: IoStatus,
  ): Promise<{ sPtr: number; ePtr: number }> {
    if (this._vectorIndex) {
      const sPtr = this._vectorIndex.readUInt32LE(idx);
      const ePtr = this._vectorIndex.readUInt32LE(idx + 4);
      return { sPtr, ePtr };
    } else {
      const buf = await this.getBuffer(256 + idx, 8, fd, ioStatus);
      const sPtr = buf.readUInt32LE();
      const ePtr = buf.readUInt32LE(4);
      return { sPtr, ePtr };
    }
  }

  private async getBuffer(offset: number, length: number, fd: number | null, ioStatus: IoStatus): Promise<Buffer> {
    if (this._buffer) {
      return this._buffer.subarray(offset, offset + length);
    } else {
      const buf = Buffer.alloc(length);
      if (!fd) {
        throw new Error('File descriptor is null');
      }

      return new Promise((resolve, reject) => {
        ioStatus.ioCount += 1;
        fs.read(fd, buf, 0, length, offset, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(buf);
          }
        });
      });
    }
  }

  private openFilePromise(fileName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      fs.open(fileName, 'r', (err, fd) => {
        if (err) {
          reject(err);
        } else {
          resolve(fd);
        }
      });
    });
  }

  public search(ip: string, callback?: SearchCallback): Promise<SearchResult> {
    const promise = this.searchAsync(ip);
    if (callback) {
      promise
        .then((result) => {
          callback(result);
          return result;
        })
        .catch((err) => {
          callback(null, err);
          throw err;
        });
    }

    return promise;
  }

  private async searchAsync(ip: string): Promise<SearchResult> {
    const startTime = process.hrtime();
    const ioStatus: IoStatus = {
      ioCount: 0,
    };

    if (!isValidIp(ip)) {
      throw new Error(`IP: ${ip} is invalid`);
    }

    let fd: number | null = null;

    if (!this._buffer) {
      if (!this._dbFile) {
        throw new Error('Database file path is null');
      }
      fd = await this.openFilePromise(this._dbFile);
    }

    const ps = ip.split('.');
    const i0 = parseInt(ps[0]);
    const i1 = parseInt(ps[1]);
    const i2 = parseInt(ps[2]);
    const i3 = parseInt(ps[3]);

    const ipInt = i0 * 256 * 256 * 256 + i1 * 256 * 256 + i2 * 256 + i3;
    const idx = i0 * VectorIndexCols * VectorIndexSize + i1 * VectorIndexSize;
    const { sPtr, ePtr } = await this.getStartEndPtr(idx, fd, ioStatus);
    let l = 0;
    let h = (ePtr - sPtr) / SegmentIndexSize;
    let result: string | null = null;

    while (l <= h) {
      const m = (l + h) >> 1;

      const p = sPtr + m * SegmentIndexSize;

      const buff = await this.getBuffer(p, SegmentIndexSize, fd, ioStatus);

      const sip = buff.readUInt32LE(0);

      if (ipInt < sip) {
        h = m - 1;
      } else {
        const eip = buff.readUInt32LE(4);
        if (ipInt > eip) {
          l = m + 1;
        } else {
          const dataLen = buff.readUInt16LE(8);
          const dataPtr = buff.readUInt32LE(10);
          const data = await this.getBuffer(dataPtr, dataLen, fd, ioStatus);
          result = data.toString('utf-8');
          break;
        }
      }
    }

    if (fd) {
      fs.close(fd, () => {});
    }

    const diff = process.hrtime(startTime);
    const took = (diff[0] * 1e9 + diff[1]) / 1e3;

    return { region: result, ioCount: ioStatus.ioCount, took };
  }
}

const _checkFile = (dbPath: string): void => {
  try {
    fs.accessSync(dbPath, fs.constants.F_OK);
  } catch (err) {
    throw new Error(`${dbPath} ${err ? 'does not exist' : 'exists'}`);
  }

  try {
    fs.accessSync(dbPath, fs.constants.R_OK);
  } catch (err) {
    throw new Error(`${dbPath} ${err ? 'is not readable' : 'is readable'}`);
  }
};

export const isValidIp = (ip: string): boolean => {
  return IP_REGEX.test(ip);
};

export const newWithFileOnly = (dbPath: string): Searcher => {
  _checkFile(dbPath);
  return new Searcher(dbPath, null, null);
};

export const newWithVectorIndex = (dbPath: string, vectorIndex: Buffer): Searcher => {
  _checkFile(dbPath);

  if (!Buffer.isBuffer(vectorIndex)) {
    throw new Error('vectorIndex is invalid');
  }

  return new Searcher(dbPath, vectorIndex, null);
};

export const newWithBuffer = (buffer: Buffer): Searcher => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('buffer is invalid');
  }

  return new Searcher(null, null, buffer);
};

export const loadVectorIndexFromFile = (dbPath: string): Buffer => {
  const fd = fs.openSync(dbPath, 'r');
  const buffer = Buffer.alloc(VectorIndexLength);
  fs.readSync(fd, buffer, 0, VectorIndexLength, 256);
  fs.close(fd, () => {});
  return buffer;
};

export const loadContentFromFile = (dbPath: string): Buffer => {
  const stats = fs.statSync(dbPath);
  const buffer = Buffer.alloc(stats.size);
  const fd = fs.openSync(dbPath, 'r');
  fs.readSync(fd, buffer, 0, stats.size, 0);
  fs.close(fd, () => {});
  return buffer;
};
