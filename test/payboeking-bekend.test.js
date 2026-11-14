'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const maakBoeking = require('../server/kern/pay/boeking');
const { maakSleutel } = require('../server/db/economische-identiteit');
const vraag = { van: 'lid:oud', naar: 'partner:EIGEN', centen: 10000, soort: 'reisbetaling', ref: 'REIS-1',
  economischeSleutel: maakSleutel('pay-handeling', ['reisketen-inning', 'REIS-1', 'offer-1']) };
const boeking = { id: 'PAY-BESTAAND', van: vraag.van, naar: vraag.naar, centen: vraag.centen,
  soort: vraag.soort, ref: vraag.ref, oms: 'Bestaande reis', at: '2026-11-11T12:00:00Z' };

function opzet(extra = {}) {
  const staat = { saldi: {}, regels: [], saves: 0, nieuweBoekingen: 0, poort: 0 };
  const b = maakBoeking({
    saldi: () => staat.saldi, saldoVan: k => staat.saldi[k] || 0, grootboek: () => staat.regels,
    payBoekingenVoegToe: row => staat.regels.push(row), save: () => { staat.saves++; },
    id: () => { staat.nieuweBoekingen++; throw Error('Lezen mag geen nieuwe boeking maken'); },
    schoon: String, nu: () => '2026-11-11T12:00:00Z',
    waardePoort: () => { staat.poort++; return { status: 403, error: 'Gesloten voor nieuw werk' }; },
    betalingenUit: true, uitFout: () => ({ status: 503, error: 'Nieuwe betalingen uit' }),
    geldModus: 'schaduw', motorklant: {}, schaduw: { spiegel: () => { throw Error('Geen nieuwe schaduwboeking'); } },
    MIN_CENTEN: 1, MAX_CENTEN: 500000, ...extra });
  return { b, staat };
}

test('JS-lookup bewijst onbekend via de duurzame index en kan met zijn callback niets boeken', async () => {
  let opvraag, callback = 0;
  const h = opzet({ boekEenmaal: async (invoer, werk) => { opvraag = invoer; callback++; return werk(); } });
  const r = await h.b.boekBekend(vraag);
  assert.equal(r.status, 404);
  assert.equal(r.code, 'PAY_BOEKING_ONBEKEND');
  assert.equal(r.onbekend, true);
  assert.equal(callback, 1);
  assert.equal(opvraag.sleutel, vraag.economischeSleutel);
  assert.deepEqual(opvraag.identiteit, { domein: 'pay', van: vraag.van, naar: vraag.naar,
    centen: vraag.centen, soort: vraag.soort, ref: vraag.ref });
  assert.deepEqual(opvraag.collecties, ['paySaldi', 'payBoekingen']);
  assert.deepEqual(h.staat, { saldi: {}, regels: [], saves: 0, nieuweBoekingen: 0, poort: 0 });
});

test('bekende JS-boeking blijft leesbaar met betalen uit en passeert geen nieuwe-werkpoort', async () => {
  const h = opzet({ boekEenmaal: async () => ({ ok: true, boeking: { ...boeking }, herhaald: true }) });
  assert.deepEqual(await h.b.boekBekend(vraag), { ok: true, boeking, herhaald: true });
  assert.deepEqual(h.staat, { saldi: {}, regels: [], saves: 0, nieuweBoekingen: 0, poort: 0 });
});

test('JS-lookup behandelt conflict, projectiedrift, storing en ontbrekende index nooit als onbekend', async () => {
  for (const antwoord of [null, { status: 409, error: 'Sleutelconflict' },
    { status: 503, code: 'ECONOMISCHE_PROJECTIE_ONTBREEKT' }, { status: 404, onbekend: true },
    { ok: true, boeking: { ...boeking, ref: 'ANDER' } }, { ok: true, boeking: { ...boeking, id: {} } }]) {
    const h = opzet({ boekEenmaal: async () => antwoord });
    const r = await h.b.boekBekend(vraag);
    assert.equal(r.status, 503);
    assert.equal(r.onbekend, undefined);
    assert.equal(h.staat.saves, 0);
    assert.equal(h.staat.nieuweBoekingen, 0);
  }
  assert.equal((await opzet().b.boekBekend(vraag)).status, 503, 'geen vluchtige grootboekfallback');
  assert.equal((await opzet({ boekEenmaal: async () => { throw Error('opslag weg'); } }).b.boekBekend(vraag)).status, 503);
});

test('ongeldige lookup-identiteit wordt vóór iedere opslag- of motoroproep geweigerd', async () => {
  let gelezen = 0;
  const h = opzet({ boekEenmaal: async () => { gelezen++; throw Error('mag niet'); } });
  for (const extra of [{ economischeSleutel: '' }, { centen: '10000' }, { centen: 1.5 }, { centen: 0 },
    { van: '' }, { naar: vraag.van }, { soort: null }, { ref: '' }])
    assert.equal((await h.b.boekBekend({ ...vraag, ...extra })).status, 503);
  assert.equal(gelezen, 0);
});

test('motorlookup leest uitsluitend boekBekend en publiceert alleen de bevestigde actuele spiegel', async () => {
  const oproepen = [];
  const h = opzet({ geldModus: 'motor', motorklant: {
    boekBekend: async args => { oproepen.push(args); return { ok: true, herhaald: true, boeking,
      saldoVan: 20000, saldoNaar: 10000 }; },
    boekGuard: async () => { throw Error('Read-only herstel mag de schrijfdeur niet bellen'); }
  } });
  for (let i = 0; i < 2; i++) {
    const r = await h.b.boekBekend(vraag);
    assert.equal(r.ok, true);
    assert.equal(r.herhaald, true);
    assert.equal(r.boeking.id, boeking.id);
  }
  assert.equal(oproepen.length, 2);
  assert.deepEqual(oproepen[0], vraag);
  assert.deepEqual(h.staat.saldi, { 'lid:oud': 20000, 'partner:EIGEN': 10000 });
  assert.equal(h.staat.regels.length, 1);
  assert.equal(h.staat.nieuweBoekingen, 0);
  assert.equal(h.staat.poort, 0);
});

test('alleen motor-404 betekent onbekend; afwijking of ontbrekende saldi verandert geen spiegel', async () => {
  for (const antwoord of [null, { onbekend: true }, { onbekend: true, status: 409 },
    { onbekend: true, status: 503 }, { error: 'netwerk', status: 502 },
    { ok: true, boeking, herhaald: true },
    { ok: true, boeking: { ...boeking, centen: 1 }, saldoVan: 20000, saldoNaar: 10000 },
    { ok: true, boeking: { ...boeking, soort: 'teruggave' }, saldoVan: 20000, saldoNaar: 10000 }]) {
    const h = opzet({ geldModus: 'motor', motorklant: { boekBekend: async () => antwoord } });
    const r = await h.b.boekBekend(vraag);
    assert.equal(r.status, 503);
    assert.equal(r.onbekend, undefined);
    assert.deepEqual(h.staat, { saldi: {}, regels: [], saves: 0, nieuweBoekingen: 0, poort: 0 });
  }
  const onbekend = opzet({ geldModus: 'motor', motorklant: { boekBekend: async () => ({ onbekend: true, status: 404 }) } });
  assert.equal((await onbekend.b.boekBekend(vraag)).code, 'PAY_BOEKING_ONBEKEND');
});

test('echte SQLite-index: lookup boekt nooit, onbekend verschilt van sleutelconflict en projectiedrift', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pay-bekend-'));
  const code = String.raw`
    (async()=>{
      const {DatabaseSync}=require('node:sqlite'),path=require('node:path');
      const d=require('./server/db');d.load();
      d.db.data.paySaldi={'lid:oud':30000,'partner:EIGEN':0,extern:-30000};d.db.data.payBoekingen=[];d.save();
      let nieuwe=0;
      const p=require('./server/kern/pay/boeking')({saldi:()=>d.db.data.paySaldi,saldoVan:k=>d.db.data.paySaldi[k]||0,
        grootboek:()=>d.db.data.payBoekingen,payBoekingenVoegToe:r=>d.db.data.payBoekingen.push(r),save:d.save,
        id:()=> 'PAY-'+(++nieuwe),schoon:String,nu:()=> '2026-11-11T12:00:00Z',waardePoort:()=>null,
        betalingenUit:false,geldModus:'schaduw',motorklant:{},schaduw:{spiegel:()=>{}},
        boekEenmaal:d.economischeBoekingEenmaal,MIN_CENTEN:1,MAX_CENTEN:500000});
      const sleutel=require('./server/db/economische-identiteit').maakSleutel;
      const a={van:'lid:oud',naar:'partner:EIGEN',centen:10000,soort:'reisbetaling',ref:'REIS-1',
        economischeSleutel:sleutel('pay-handeling',['REIS-1'])};
      const sql=new DatabaseSync(path.join(process.env.RTG_DATA_DIR,'store.db'));
      const onbekend=await p.boekBekend(a);
      const aantalVoor=sql.prepare('SELECT count(*) AS n FROM economische_boekingen').get().n;
      const geboekt=await p.boekAsync(a);
      const bekend=await p.boekBekend(a);
      const conflict=await p.boekBekend({...a,centen:10001});
      const aantalNa=sql.prepare('SELECT count(*) AS n FROM economische_boekingen').get().n;
      sql.prepare('DELETE FROM economische_boekingen WHERE sleutel=?').run(a.economischeSleutel);
      const drift=await p.boekBekend(a);sql.close();
      console.log(JSON.stringify({onbekend,aantalVoor,geboekt,bekend,conflict,aantalNa,drift,nieuwe,
        saldi:d.db.data.paySaldi,regels:d.db.data.payBoekingen.length}));
    })().catch(e=>{console.error(e);process.exit(1)});`;
  try {
    const r = spawnSync(process.execPath, ['-e', code], { cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test', RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '',
        RTG_DATA_DIR: map, RTG_ENC_KEY: '', TX_LEDGER_SQLITE: '0' }, encoding: 'utf8', timeout: 20000 });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const u = JSON.parse(r.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
    assert.equal(u.onbekend.status, 404);
    assert.equal(u.onbekend.code, 'PAY_BOEKING_ONBEKEND');
    assert.equal(u.aantalVoor, 0, 'lookup reserveert geen economische sleutel');
    assert.equal(u.geboekt.ok, true);
    assert.equal(u.bekend.ok, true);
    assert.equal(u.bekend.boeking.id, u.geboekt.boeking.id);
    assert.equal(u.conflict.status, 503);
    assert.equal(u.drift.status, 503, 'bestaande regel zonder sleutel is geen toestemming om opnieuw te boeken');
    assert.equal(u.aantalNa, 1);
    assert.equal(u.nieuwe, 1);
    assert.equal(u.regels, 1);
    assert.deepEqual(u.saldi, { 'lid:oud': 20000, 'partner:EIGEN': 10000, extern: -30000 });
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});
