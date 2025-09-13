import { long2ip } from './util.js';

export class Segment {
  start_ip: number;
  end_ip: number;
  region: string;

  constructor(sip = 0, eip = 0, reg = '') {
    this.start_ip = sip;
    this.end_ip = eip;
    this.region = reg;
  }

  toString() {
    return `${long2ip(this.start_ip)}|${long2ip(this.end_ip)}|${this.region}`;
  }

  split() {
    // 1. Split by the first byte
    let t_list_1 = [];
    let s_byte_1 = (this.start_ip >> 24) & 0xff;
    let e_byte_1 = (this.end_ip >> 24) & 0xff;
    let n_sip = this.start_ip;
    for (let i = s_byte_1; i <= e_byte_1; i++) {
      let sip = ((i << 24) | (n_sip & 0xffffff)) >>> 0;
      let eip = ((i << 24) | 0xffffff) >>> 0;
      if (eip < this.end_ip) {
        n_sip = (i + 1) << 24;
      } else {
        eip = this.end_ip;
      }
      t_list_1.push(new Segment(sip, eip));
    }

    // 2. Split by the second byte
    let t_list_2 = [];
    for (const s of t_list_1) {
      let base = s.start_ip & 0xff000000;
      let n_sip = s.start_ip;
      let s_byte_2 = (s.start_ip >> 16) & 0xff;
      let e_byte_2 = (s.end_ip >> 16) & 0xff;
      for (let i = s_byte_2; i <= e_byte_2; i++) {
        let sip = (base | (i << 16) | (n_sip & 0xffff)) >>> 0;
        let eip = (base | (i << 16) | 0xffff) >>> 0;
        if (eip < this.end_ip) {
          n_sip = 0;
        } else {
          eip = this.end_ip;
        }
        t_list_2.push(new Segment(sip, eip, this.region));
      }
    }
    return t_list_2;
  }

  encode(data_len: number, data_pos: number) {
    const buffer = Buffer.alloc(14);
    buffer.writeUInt32LE(this.start_ip, 0);
    buffer.writeUInt32LE(this.end_ip, 4);
    buffer.writeUInt16LE(data_len, 8);
    buffer.writeUInt32LE(data_pos, 10);
    return buffer;
  }
}
