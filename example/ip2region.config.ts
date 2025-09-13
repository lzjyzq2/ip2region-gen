import { regionsData } from '../src/regions_data';

export function checkCountry(searchStr: string): string {
  if (searchStr == '中国') {
    return '中国';
  } else {
    return '海外';
  }
}

/**
 *
 * @param searchStr
 * @returns
 */
export function searchProvince(searchStr: string): [string, string] {
  const provinceMappings = regionsData['00'];
  if (searchStr == '海外') return ['0', '海外'];
  if (provinceMappings) {
    for (let [provinceId, province] of Object.entries(provinceMappings)) {
      if (searchStr.includes(province.key)) {
        return [provinceId, province.name];
      }
    }
  }

  return ['0', '未知'];
}

export function searchCity(citySearchStr: string, provinceId: string): [string, string] {
  if (citySearchStr == '海外') return ['0', '海外'];
  const province = regionsData[provinceId];
  if (province) {
    for (let [cityId, city] of Object.entries(province)) {
      if (citySearchStr.includes(city.key)) {
        return [cityId, city.name];
      }
    }
  }
  return ['0', '未知'];
}

export type ProcessChunkHandler = (line: string) => string;

/**
 * 默认的处理函数
 * @param line - 输入行
 * @returns 处理后的行
 */
export default function (line: string): string {
  const line2 = line.split('  ');
  let country: string | null = null;
  let province: string[] | null = null;
  let city: string[] | null = null;

  if (line.includes('保留地址')) {
    country = '未知';
    province = ['0', '未知'];
    city = ['0', '未知'];
  } else {
    // area 数据清洗
    let area = (line2[2] || '').replace('\n', '').replace('CZ88.NET', '').split('–');
    let countryO = (area[0] || '').trim();
    // 国家白名单过滤
    country = checkCountry(countryO);

    let provinceO = area.length >= 2 ? area[1].trim() : countryO;
    province = searchProvince(provinceO);

    // 将area剩余值拼接起来
    const areaSearchStr = area.slice(2).join('');
    // 由于area的层级不确定性，可能存在县、区等，直接在内部进行搜索
    let areaO = area.length >= 3 ? areaSearchStr : provinceO;
    city = searchCity(areaO, province[0]);
  }

  return `${line2[0]}|${line2[1]}|${country}|${province[1]}|${city[1]}`;
}
