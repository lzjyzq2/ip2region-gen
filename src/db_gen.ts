import { new_maker } from './maker.js';
import { Vector_Index_Policy, index_policy_from_string } from './vector.js';
import { isMainModule } from './util.js';

export async function gen_db(src_file: string = '', dst_file: string = '', index_policy: number = Vector_Index_Policy) {
  let start_time = Date.now();
  let maker = new_maker(index_policy, src_file, dst_file);
  await maker.gen();

  let elapsed = Date.now() - start_time;
  console.log(`Done, elapsed: ${Math.floor(elapsed / 60000)}m${Math.floor((elapsed % 60000) / 1000)}s`);
}

export async function main() {
  let src_file = '',
    dst_file = '';
  let index_policy = Vector_Index_Policy;
  // Check input parameters
  for (let i = 3; i < process.argv.length; i++) {
    let r = process.argv[i];
    if (r.length < 5) continue;
    if (!r.startsWith('--')) continue;
    let s_idx = r.indexOf('=');
    if (s_idx < 0) {
      console.log(`missing = for args pair '${r}'`);
      return;
    }

    if (r.slice(2, s_idx) === 'src') {
      src_file = r.slice(s_idx + 1);
    } else if (r.slice(2, s_idx) === 'dst') {
      dst_file = r.slice(s_idx + 1);
    } else if (r.slice(2, s_idx) === 'index') {
      index_policy = index_policy_from_string(r.slice(s_idx + 1));
    } else {
      console.log(`undefined option \`${r}\``);
      return;
    }
  }
  if (!src_file || !dst_file) {
    console.log(`${process.argv[1]} gen [command options]`);
    console.log('options:');
    console.log(' --src string    source ip text file path');
    console.log(' --dst string    destination binary xdb file path');
    return;
  }

  gen_db(src_file, dst_file, index_policy);
}

if (isMainModule(import.meta.url)) {
  main();
}
