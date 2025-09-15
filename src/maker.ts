import fs, { createReadStream } from 'fs';
import { Vector_Index_Policy, VectorIndexBlock, Segment_Index_Block_Size } from './vector.js';
import { check_ip, splitN } from './util.js';
import { Segment } from './segment.js';
import { createInterface } from 'readline';
import { once } from 'events';
import { logger } from './logger.js';

export const Version_No = 2;
export const Header_Info_Length = 256;
export const Vector_Index_Rows = 256;
export const Vector_Index_Cols = 256;
export const Vector_Index_Size = 8;
export const Vector_Index_Length = Vector_Index_Rows * Vector_Index_Cols * Vector_Index_Size;
export const DataEncoding = 'utf-8';

class Header {
  version: number;
  index_policy: number;
  created_at: number;
  start_index_ptr: number;
  end_index_ptr: number;

  constructor(index_policy: number = Vector_Index_Policy) {
    this.version = Version_No;
    this.index_policy = index_policy;
    this.created_at = Math.floor(Date.now() / 1000);
    this.start_index_ptr = 0;
    this.end_index_ptr = 0;
  }

  toString(): string {
    return `{version: ${this.version}, index_policy: ${this.index_policy}, created_at: ${this.created_at}, start_index_ptr: ${this.start_index_ptr}, end_index_ptr: ${this.end_index_ptr}}`;
  }

  serialize(): Buffer {
    const buffer = Buffer.alloc(Header_Info_Length);
    buffer.writeUInt16LE(this.version, 0);
    buffer.writeUInt16LE(this.index_policy, 2);
    buffer.writeUInt32LE(this.created_at, 4);
    buffer.writeUInt32LE(this.start_index_ptr, 8);
    buffer.writeUInt32LE(this.end_index_ptr, 12);
    return buffer;
  }
}

class Maker {
  index_policy: number;
  src_file: string;
  dst_file: string;
  fdb: number;
  vector_index: VectorIndexBlock[][];
  segments: Segment[];
  region_pool: { [key: string]: { data_len: number; data_pos: number } };
  header: Header;

  constructor(index_policy: number = Vector_Index_Policy, src_file: string = '', dst_file: string = '') {
    this.index_policy = index_policy;
    this.src_file = src_file;
    this.dst_file = dst_file;
    this.fdb = 0;
    this.vector_index = Array.from({ length: Vector_Index_Rows }, () =>
      Array.from({ length: Vector_Index_Cols }, () => new VectorIndexBlock()),
    );
    this.segments = [];
    this.region_pool = {};
    this.header = new Header(index_policy);
  }

  async gen(): Promise<void> {
    this.writeHeader();
    await this.load_segments();
    await this.start().finally(() => {
      this.end();
    });
  }

  private writeHeader(): void {
    // 检查数据文件是否存在
    fs.accessSync(this.src_file, fs.constants.R_OK);
    // 创建或清空目标文件
    this.fdb = fs.openSync(this.dst_file, 'w');
    // 写入文件头，占位
    const headerBuf = this.header.serialize();
    fs.writeSync(this.fdb, headerBuf, 0, headerBuf.length, 0);
  }

  async load_segments(): Promise<void> {
    logger.info('try to load the segments ... ');
    let s_tm = Date.now();

    let last: Segment | null = null;
    const rl = createInterface({
      input: createReadStream(this.src_file, DataEncoding),
      crlfDelay: Infinity,
    });
    rl.on('line', (line: string) => {
      if (!line.trim()) return;
      let ps = splitN(line, '|', 2);
      if (ps.length !== 3) throw new Error(`invalid ip segment line \`${line}\``);

      let sip = check_ip(ps[0]);
      if (sip === -1) throw new Error(`invalid ip address \`${ps[0]}\` in line \`${line}\``);
      let eip = check_ip(ps[1]);
      if (eip === -1) throw new Error(`invalid ip address \`${ps[1]}\` in line \`${line}\``);

      if (sip > eip) throw new Error(`start ip(${ps[0]}) should not be greater than end ip(${ps[1]})`);
      if (ps[2].length < 1) throw new Error(`empty region info in segment line \`${line}\``);

      let region = ps.splice(2).join('|');
      if (last && last.end_ip + 1 === sip && last.region === region) {
        // 合并当前段到last段
        last.end_ip = eip;
      } else {
        // 推入新段
        if (last) this.segments.push(last);
        last = new Segment(sip, eip, region);
      }
    });

    await once(rl, 'close');
    // 处理最后一段
    if (last) this.segments.push(last);
    logger.info(
      `all segments loaded (after merge), length: ${this.segments.length}, elapsed: ${(Date.now() - s_tm) / 1000}`,
    );
  }

  private set_vector_index(ip: number, ptr: number): void {
    let row = (ip >> 24) & 0xff,
      col = (ip >> 16) & 0xff;
    let vi_block = this.vector_index[row][col];
    if (vi_block.first_ptr === 0) {
      vi_block.first_ptr = ptr;
      vi_block.last_ptr = ptr + Segment_Index_Block_Size;
    } else {
      vi_block.last_ptr = ptr + Segment_Index_Block_Size;
    }
    this.vector_index[row][col] = vi_block;
  }

  async start(): Promise<void> {
    if (this.segments.length < 1) throw new Error('empty segment list');
    let pos = Header_Info_Length + Vector_Index_Length;

    logger.info('try to write the data block ... ');
    for (const s of this.segments) {
      if (s.region in this.region_pool) {
        continue;
      }
      let region = Buffer.from(s.region, DataEncoding);
      if (region.length > 0xffff)
        throw new Error(`too long region info \`${s.region}\`: should be less than ${0xffff} bytes`);
      fs.writeSync(this.fdb, region, 0, region.length, pos);
      this.region_pool[s.region] = { data_len: region.length, data_pos: pos };
      pos += region.length;
    }

    let counter = 0,
      start_index_ptr = -1,
      end_index_ptr = -1;
    for (const sg of this.segments) {
      if (!(sg.region in this.region_pool)) throw new Error(`missing ptr cache for region \`${sg.region}\``);

      const { data_len, data_pos } = this.region_pool[sg.region];
      if (data_len < 1) throw new Error(`empty region info for segment '${sg.region}'`);

      let seg_list = sg.split();
      for (const s of seg_list) {
        fs.writeSync(this.fdb, s.encode(data_len, data_pos), 0, Segment_Index_Block_Size, pos);
        this.set_vector_index(s.start_ip, pos);
        if (start_index_ptr === -1) start_index_ptr = pos;
        end_index_ptr = pos;
        pos += Segment_Index_Block_Size;
        counter++;
      }
    }
    // 3. Write the vector index block
    let vi_pos = Header_Info_Length;
    for (let i = 0; i < this.vector_index.length; i++) {
      for (let j = 0; j < this.vector_index[i].length; j++) {
        let vi = this.vector_index[i][j];
        fs.writeSync(this.fdb, vi.encode(), 0, 8, vi_pos);
        vi_pos += 8;
      }
    }
    // 4. Write the segment index info
    let buff = Buffer.alloc(8);
    buff.writeUInt32LE(start_index_ptr, 0);
    buff.writeUInt32LE(end_index_ptr, 4);
    fs.writeSync(this.fdb, buff, 0, 8, 8);
  }

  end(): void {
    fs.closeSync(this.fdb);
  }
}

export function new_maker(
  index_policy: number = Vector_Index_Policy,
  src_file: string = '',
  dst_file: string = '',
): Maker {
  return new Maker(index_policy, src_file, dst_file);
}
