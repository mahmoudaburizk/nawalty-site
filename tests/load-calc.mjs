// بيطلع كود الحسابات من src/nawalty.html (بين CALC-START و CALC-END) ويشغله في Node
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../src/nawalty.html', import.meta.url), 'utf8');
const start = html.indexOf('/* CALC-START'), end = html.indexOf('/* CALC-END */');
if(start < 0 || end < 0) throw new Error('CALC markers not found');
const code = html.slice(start, end);
const names = ['localDateStr','todayStr','num','fmtNum','money','getWeekStart','normalizeWeekStart','normalizeWeeklyPrices','fixLegacy','isGreenKind','toNum',
  'getPriceSetForDate','isWeekLocked','getPersonWeeklyConfig','calcJalabEntry','calcSakinaEntry','calcTakhritEntry','calcWorkerEntry','calcTransportEntry',
  'getEntryPricingDetails','calcSalesEntry','calcRaseefEntry','entryQty','isMissingPrice','SECTION_FIELDS','mapEntryFromServer','mapEntryToServer',
  'mapPersonFromServer','personTotals','weekSummaries','balanceInfo','flowForWeek','DEFAULT_PRICES','EMPTY_PRICES'];
const ctx = vm.createContext({ console });
vm.runInContext(code + '\n;globalThis.__calc = {' + names.join(',') + '};', ctx);
export default ctx.__calc;
