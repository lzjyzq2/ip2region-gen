export default function (line) {
    const combines = line.split('  ')
    if(combines.length < 2) {
        return false;
    }
    let str = combines.length > 2 ? combines[2] : ''
    const region = str.split('-')?.[0] ?? '未知'
    return `${combines[0]}|${combines[1]}|${region}`;
}