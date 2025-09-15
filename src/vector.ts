import { logger } from './logger.js';

export const Vector_Index_Policy = 1;
export const BTree_Index_Policy = 2;

export function index_policy_from_string(s: string): number {
  const sl = s.toLowerCase();
  if (sl === 'vector') {
    return Vector_Index_Policy;
  } else if (sl === 'btree') {
    return BTree_Index_Policy;
  } else {
    logger.info(`invalid policy \`${s}\`, used default vector index`);
    return Vector_Index_Policy;
  }
}

export class VectorIndexBlock {
  first_ptr: number;
  last_ptr: number;

  constructor(fp: number = 0, lp: number = 0) {
    this.first_ptr = fp;
    this.last_ptr = lp;
  }

  toString(): string {
    return `FirstPtr: ${this.first_ptr}, LastPrt: ${this.last_ptr}`;
  }

  encode(): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32LE(this.first_ptr, 0);
    buffer.writeUInt32LE(this.last_ptr, 4);
    return buffer;
  }
}

export const Segment_Index_Block_Size = 14;

export class SegmentIndexBlock {
  start_ip: number;
  end_ip: number;
  data_len: number;
  data_ptr: number;

  constructor(sip: number, eip: number, dl: number, dp: number) {
    this.start_ip = sip;
    this.end_ip = eip;
    this.data_len = dl;
    this.data_ptr = dp;
  }

  toString(): string {
    return `{sip: ${this.start_ip}, eip: ${this.end_ip}, len: ${this.data_len}, ptr: ${this.data_ptr}}`;
  }

  encode(): Buffer {
    const buffer = Buffer.alloc(14);
    buffer.writeUInt32LE(this.start_ip, 0);
    buffer.writeUInt32LE(this.end_ip, 4);
    buffer.writeUInt32LE(this.data_len, 8);
    buffer.writeUInt32LE(this.data_ptr, 10);
    return buffer;
  }
}

export * from './maker.js';
