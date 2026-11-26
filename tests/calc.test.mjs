import test from 'node:test';
import assert from 'node:assert/strict';
import C from './load-calc.mjs';

const W = (weekStart, prices) => ({ weekStart, ...prices });
const db = (o={}) => ({ priceDays: [], priceWeeks: [], seasonPrices: null, lockedWeeks: [], routes: [], ...o });

test('الأسبوع بيبدأ السبت (بتوقيت القاهرة)', () => {
  assert.equal(C.getWeekStart('2026-11-21'), '2026-11-21');
  assert.equal(C.getWeekStart('2026-11-27'), '2026-11-21');
  assert.equal(C.getWeekStart('2026-11-28'), '2026-11-28');
});
test('أسابيع قديمة متسجلة يوم جمعة بتتحول للسبت', () => {
  assert.equal(C.normalizeWeekStart('2026-11-20'), '2026-11-21');
  assert.equal(C.normalizeWeekStart('2026-11-21'), '2026-11-21');
});
test('مفيش أسعار افتراضية في الحساب: من غير تسعير العملية بدون سعر', () => {
  const ps = C.getPriceSetForDate(db(), '2026-11-23');
  assert.equal(ps.__source, 'none');
  const e = { date:'2026-11-23', kuz:100, unit:'كوز', itemType:'بلدي', price:'' };
  const t = C.calcJalabEntry(e, ps, null);
  assert.equal(t, 0);
  assert.equal(C.isMissingPrice(e, t), true);
});
test('أولوية الأسعار: يوم ← أسبوع ← آخر أسبوع قبله ← موسمي', () => {
  const d = db({ priceWeeks:[W('2026-11-07',{jalabPerKuz:3}), W('2026-11-21',{jalabPerKuz:5})], seasonPrices:{jalabPerKuz:9}, priceDays:[{day:'2026-11-24', jalabPerKuz:7}] });
  assert.equal(C.getPriceSetForDate(d,'2026-11-24').jalabPerKuz, 7);
  assert.equal(C.getPriceSetForDate(d,'2026-11-23').jalabPerKuz, 5);
  assert.equal(C.getPriceSetForDate(d,'2026-11-16').jalabPerKuz, 3);
  assert.equal(C.getPriceSetForDate(d,'2026-11-16').__source, 'carry');
  assert.equal(C.getPriceSetForDate(d,'2026-11-01').jalabPerKuz, 9);
});
test('الجلابة: سعر يدوي ← تسعير الجلاب (النوع ثم عام) ← العام، والطن', () => {
  const ps = C.getPriceSetForDate(db({priceWeeks:[W('2026-11-21',{jalabPerKuz:2, jalabPerTon:800})]}), '2026-11-23');
  const p = { weeklyPrices:[{weekStart:'2026-11-21', prices:{'بلدي':5,'عام':3,'طن':950}}] };
  const e = o => ({ date:'2026-11-23', kuz:10, unit:'كوز', itemType:'بلدي', price:'', ...o });
  assert.equal(C.calcJalabEntry(e({}), ps, p), 50);
  assert.equal(C.calcJalabEntry(e({itemType:'فرنساوي'}), ps, p), 30);
  assert.equal(C.calcJalabEntry(e({price:7}), ps, p), 70);
  assert.equal(C.calcJalabEntry(e({}), ps, null), 20);
  assert.equal(C.calcJalabEntry(e({unit:'طن', kuz:2}), ps, p), 1900);
  assert.equal(C.calcJalabEntry(e({unit:'طن', kuz:2}), ps, null), 1600);
});
test('تسعير الشخص مايتطبقش على أسابيع قبله', () => {
  const p = { weeklyPrices:[{weekStart:'2026-11-21', prices:{'بلدي':5}}] };
  assert.equal(C.getPersonWeeklyConfig(p, '2026-11-14'), null);
  assert.equal(C.getPersonWeeklyConfig(p, '2026-12-01').weekStart, '2026-11-21');
});
test('المبيعات: الدرجة والخصم والأخضر', () => {
  const ps = C.getPriceSetForDate(db({priceWeeks:[W('2026-11-21',{sales:{'قطع (أولى)':35,'قطع (ثانية)':25,'أخضر':2}})]}), '2026-11-23');
  const base = { date:'2026-11-23', kind:'مصنع', itemType:'قطع', grade:'درجة أولى', quantity:100, price:'', discount:'' };
  assert.equal(C.calcSalesEntry(base, ps, null), 3500);
  assert.equal(C.calcSalesEntry({...base, grade:'درجة ثانية'}, ps, null), 2500);
  assert.equal(C.calcSalesEntry({...base, discount:10}, ps, null), 3150);
  assert.equal(C.calcSalesEntry({...base, kind:'أخضر', itemType:'بلدي', quantity:1000}, ps, null), 2000);
  const p = { weeklyPrices:[{weekStart:'2026-11-21', prices:{'قطع (أولى)':40}, discount:5}] };
  assert.equal(C.calcSalesEntry(base, ps, p), 3800);
});
test('المشتريات ماتاخدش أسعار البيع', () => {
  const ps = C.getPriceSetForDate(db({priceWeeks:[W('2026-11-21',{sales:{'قطع (أولى)':35}})]}), '2026-11-23');
  const d = C.getEntryPricingDetails({ date:'2026-11-23', kind:'مصنع', itemType:'قطع', grade:'درجة أولى', quantity:100 }, ps, null, 'purchase');
  assert.equal(d.netTotal, 0);
  assert.equal(d.missingPrice, true);
});
test('النوالات والتخريط والأنفار', () => {
  const ps = C.getPriceSetForDate(db({priceWeeks:[W('2026-11-21',{niswan:{'هارت':{withPeel:140, withoutPeel:190}}, takhrit:{'قطع':100}, workerDailyWage:150})]}), '2026-11-23');
  assert.equal(C.calcSakinaEntry({itemType:'هارت', pieces:5000, tookPeel:false}, ps), 950);
  assert.equal(C.calcSakinaEntry({itemType:'هارت', pieces:5000, tookPeel:true}, ps), 700);
  assert.equal(C.calcTakhritEntry({barrelType:'قطع', barrels:3, price:''}, ps), 300);
  assert.equal(C.calcTakhritEntry({barrelType:'قطع', barrels:3, price:120}, ps), 360);
  assert.equal(C.calcWorkerEntry({present:true}, ps), 150);
  assert.equal(C.calcWorkerEntry({present:false}, ps), 0);
});
test('العربيات: المشوار الثابت بياخد سعره الحالي إلا لو له سعر خاص', () => {
  const routes = [{from_location:'النوالة', to_location:'مصنع', price:350}];
  const ps = C.getPriceSetForDate(db({routes}), '2026-11-23');
  assert.equal(C.calcTransportEntry({fromLocation:'النوالة', toLocation:'مصنع', price:300, priceManual:false}, ps), 350);
  assert.equal(C.calcTransportEntry({fromLocation:'النوالة', toLocation:'مصنع', price:500, priceManual:true}, ps), 500);
  assert.equal(C.calcTransportEntry({fromLocation:'النوالة', toLocation:'مكان', price:450, priceManual:true}, ps), 450);
});
test('الأرصدة: رصيد أول الموسم + المستحق − المدفوع، وفترة الكشف', () => {
  const ps = db({priceWeeks:[W('2026-11-14',{jalabPerKuz:2})]});
  const p = { openingBalance: 100, weeklyPrices:[], entries:[{date:'2026-11-16', kuz:100, unit:'كوز'}, {date:'2026-11-23', kuz:50, unit:'كوز'}], payments:[{date:'2026-11-23', amount:120}] };
  const t = C.personTotals(p, C.calcJalabEntry, ps);
  assert.deepEqual([t.earned, t.paid, t.opening, t.remaining], [300, 120, 100, 280]);
  const r = C.personTotals(p, C.calcJalabEntry, ps, {from:'2026-11-21'});
  assert.deepEqual([r.earned, r.paid, r.remaining], [100, 120, -20]);
});
test('ملخص الأسابيع برصيد تراكمي', () => {
  const ps = db({priceWeeks:[W('2026-11-14',{jalabPerKuz:2})]});
  const p = { openingBalance: 100, entries:[{date:'2026-11-16', kuz:100}, {date:'2026-11-23', kuz:50}], payments:[{date:'2026-11-23', amount:120}] };
  const w = C.weekSummaries(p, C.calcJalabEntry, ps);
  assert.deepEqual(JSON.parse(JSON.stringify(w.map(x=>[x.weekStart, x.earned, x.paid, x.balance]))), [['2026-11-14',200,0,300],['2026-11-21',100,120,280]]);
});
test('اتجاه الرصيد: ليه/ليك', () => {
  assert.equal(C.balanceInfo(500, 'payable').short, 'ليه');
  assert.equal(C.balanceInfo(-50, 'payable').short, 'ليك');
  assert.equal(C.balanceInfo(500, 'receivable').short, 'ليك');
  assert.equal(C.balanceInfo(-50, 'receivable').short, 'ليه');
  assert.equal(C.balanceInfo(0.001, 'payable').short, 'خالص');
});
test('قراءة بيانات قديمة: tons/price_per_ton وأخطاء إملائية', () => {
  const e = C.mapEntryFromServer({id:'1', entry_date:'2026-11-23', kind:'أحضر', item_type:'بلدي', tons:500, price_per_ton:3}, C.SECTION_FIELDS.factories);
  assert.equal(e.quantity, 500); assert.equal(e.price, 3); assert.equal(e.kind, 'أخضر');
  const j = C.mapEntryFromServer({id:'2', entry_date:'2026-11-23', kuz:10, item_type:'غيرذلك'}, C.SECTION_FIELDS.jalaba);
  assert.equal(j.unit, 'كوز'); assert.equal(j.itemType, 'غير ذلك');
});
test('الأرقام السالبة بتتعزل عشان علامة السالب تفضل قبل الرقم', () => {
  assert.equal(C.num(-1560), '⁦-1,560⁩');
});
