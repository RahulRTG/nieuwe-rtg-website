/* Fluister, de persoonlijke assistent met geheugen: onthoudt wat je hem
   vertelt, leert van je schermgebruik (alleen tellers), is volledig
   transparant ("wat weet je over mij") en wisbaar. Voor leden en voor het
   personeel, elk met een eigen, gescheiden geheugen. Draai los:
   node --experimental-sqlite --test test/fluister.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let lid, pda;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fluister-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json()).token;
  const roster = await api('supplier/roster', { code: 'HOSHI' });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  pda = (await (await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'HOSHI', staffId: m.id, pin: '1234' })
  })).json()).token;
  assert.ok(lid && pda);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('onthouden, opvragen en wissen: het geheugen is van de gebruiker', async () => {
  assert.equal((await api('fluister', { q: '' }, lid)).status, 400, 'zonder vraag geen antwoord');
  const r1 = await api('fluister', { q: 'onthoud dat ik cava drink, nooit rode wijn' }, lid);
  assert.equal(r1.status, 200);
  assert.ok(/Onthouden/i.test(r1.body.antwoord));
  await api('fluister', { q: 'onthoud dat mijn verjaardag op 3 augustus valt' }, lid);
  const prof = (await api('fluister/profiel', {}, lid)).body;
  assert.equal(prof.weetjes.length, 2);
  assert.ok(prof.weetjes.some(w => /cava/.test(w.tekst)));
  // volledige transparantie: hij vertelt precies wat hij weet
  const wat = (await api('fluister', { q: 'wat weet je over mij?' }, lid)).body;
  assert.ok(/cava/.test(wat.antwoord) && /augustus/.test(wat.antwoord));
  // wissen per stuk en in een keer
  assert.equal((await api('fluister/vergeet', { wat: 0 }, lid)).body.weetjes.length, 1);
  const alles = await api('fluister', { q: 'vergeet alles' }, lid);
  assert.ok(/schone lei/i.test(alles.body.antwoord));
  assert.equal((await api('fluister/profiel', {}, lid)).body.weetjes.length, 0);
});

test('Fluister fluistert zelf: seintjes uit datums in weetjes en uit de agenda', async () => {
  // een verjaardag over vijf dagen, gewoon in het Nederlands verteld
  const NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const d = new Date(Date.now() + 5 * 86400000);
  await api('fluister', { q: 'onthoud dat mijn verjaardag op ' + d.getUTCDate() + ' ' + NL[d.getUTCMonth()] + ' valt' }, lid);
  const prof = (await api('fluister/profiel', {}, lid)).body;
  const jarig = (prof.seintjes || []).find(s => s.icoon === '🎂');
  assert.ok(jarig, 'de verjaardag uit het weetje wordt een seintje');
  assert.ok(/over 5 dagen/.test(jarig.tekst));
  // een reservering voor morgen fluistert vanzelf mee
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const r = await api('reserveer', { supplierCode: 'KIKUNOI', datum: morgen, tijd: '20:00', personen: 2 }, lid);
  assert.equal(r.status, 200);
  const prof2 = (await api('fluister/profiel', {}, lid)).body;
  assert.ok(prof2.seintjes.some(s => /morgen 20:00 gereserveerd/.test(s.tekst)));
  // en de seintjes reizen mee in een gewoon antwoord
  const antw = (await api('fluister', { q: 'goedemorgen, iets voor mij?' }, lid)).body;
  assert.ok(/gereserveerd|seintje/i.test(antw.antwoord));
  await api('reservering/annuleer', { id: r.body.reservering.id }, lid);
  await api('fluister', { q: 'vergeet alles' }, lid);
});

test('een nieuw seintje wordt een melding op het toestel, en piept precies een keer', async () => {
  const NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const d = new Date(Date.now() + 3 * 86400000);
  await api('fluister', { q: 'onthoud dat ons jubileum op ' + d.getUTCDate() + ' ' + NL[d.getUTCMonth()] + ' valt' }, lid);
  await api('fluister/profiel', {}, lid); // het profiel ophalen zet de push in gang
  const tel = async () => ((await api('notifications', {}, lid)).body.notifications || [])
    .filter(n => n.title === 'Uw Butler' && /jubileum/.test(n.body)).length;
  assert.equal(await tel(), 1, 'het seintje hangt als melding in de bel');
  await api('fluister/profiel', {}, lid);
  assert.equal(await tel(), 1, 'dedupe: hetzelfde seintje piept nooit twee keer');
  await api('fluister', { q: 'vergeet alles' }, lid);
});

test('Fluister doet het ook echt: reserveren en het 24-uursblok plannen, in gewone taal', async () => {
  // een tafel, gewoon gezegd zoals je het zou zeggen
  const r = await api('fluister', { q: 'Reserveer bij Sal de Mar morgen om 19:30 met 4 personen' }, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.gedaan, 'hij heeft het uitgevoerd, niet alleen beantwoord');
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const mijn = (await api('reserveringen/mijn', {}, lid)).body.reserveringen || [];
  const res = mijn.find(x => x.datum === morgen && x.tijd === '19:30' && x.supplierName === 'Sal de Mar');
  assert.ok(res, 'de reservering staat echt in het systeem');
  await api('reservering/annuleer', { id: res.id }, lid);
  // het 24-uursblok claimt een dag van het gedeelde object: eerst een voorstel
  const ov = (await api('assets', {}, lid)).body;
  await api('asset/koop', { assetId: ov.assets[0].id, smaak: 'access', aantal: 1 }, lid);
  const j = new Date().getUTCFullYear() + 1;
  const blok = await api('fluister', { q: 'zet mijn 24 uur op ' + j + '-01-20' }, lid);
  assert.ok(blok.body.voorstel && !blok.body.gedaan, 'boven de drempel: eerst een voorstel');
  assert.ok(/even checken/i.test(blok.body.antwoord));
  const ja = await api('fluister', { q: 'ja' }, lid);
  assert.ok(ja.body.gedaan, 'na "ja" is het blok echt geboekt');
  assert.ok(ja.body.antwoord.includes(j + '-01-20'));
  // een dag die al vergeven is, blijft na bevestiging eerlijk een nee
  await api('fluister', { q: 'zet mijn 24 uur op ' + j + '-01-20' }, lid);
  const dubbel = await api('fluister', { q: 'ja' }, lid);
  assert.ok(!dubbel.body.gedaan && /lukt niet/i.test(dubbel.body.antwoord));
  await api('fluister', { q: 'vergeet alles' }, lid);
});

test('geld gaat nooit zonder bevestiging de deur uit, en "nee" blaast af', async () => {
  // "nee" haalt een voorstel van tafel; er gebeurt niets
  await api('fluister', { q: 'stuur 12,50 euro naar Noordelijke Ster' }, lid);
  const nee = await api('fluister', { q: 'nee' }, lid);
  assert.ok(/niet door/i.test(nee.body.antwoord));
  // en "ja" zonder openstaand voorstel voert nooit zomaar iets uit
  const los = await api('fluister', { q: 'ja' }, lid);
  assert.ok(!los.body.gedaan && /niets open/i.test(los.body.antwoord));
  // met bevestiging gaat de Tik wel: voorstel, ja, geld onderweg
  const tik = await api('fluister', { q: 'stuur 12,50 euro naar Noordelijke Ster' }, lid);
  assert.ok(tik.body.voorstel && /12,50/.test(tik.body.antwoord));
  const ja = await api('fluister', { q: 'ja' }, lid);
  assert.ok(ja.body.gedaan, 'na "ja" is de Tik gestuurd');
  assert.ok(/12,50/.test(ja.body.antwoord) && /Noordelijke Ster/.test(ja.body.antwoord));
  await api('fluister', { q: 'vergeet alles' }, lid);
});

test('de Butler zoekt door het hele aanbod van alle partners', async () => {
  const r = await api('fluister', { q: 'zoek lamsrack' }, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.pakte, 'zoeken is werk voor de Butler zelf');
  assert.ok(/lamsrack/i.test(r.body.antwoord) && /Sal de Mar/.test(r.body.antwoord), 'hij vindt het gerecht en zegt bij welke zaak');
  const niks = await api('fluister', { q: 'zoek iets-dat-niet-bestaat-xyz' }, lid);
  assert.ok(/vond niets/i.test(niks.body.antwoord), 'geen hit blijft eerlijk geen hit');
});

test('betaalverzoeken: de Butler maakt ze, toont ze en betaalt ze pas na "ja"', async () => {
  // het rtg-lid (Amberen Vos) vraagt 10 euro aan het business-lid
  const r = await api('fluister', { q: 'vraag 10 euro aan Noordelijke Ster' }, lid);
  assert.ok(r.body.gedaan, 'een verzoek maken mag direct: er verlaat geen geld de rekening');
  assert.ok(/10,00/.test(r.body.antwoord) && /Klompje/i.test(r.body.antwoord));
  // het business-lid vraagt wat er openstaat en betaalt met een "ja"
  const lid2 = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'business' }) })).json()).token;
  const open = await api('fluister', { q: 'wat moet ik nog betalen?' }, lid2);
  assert.ok(open.body.voorstel, 'betalen is geld: eerst een voorstel');
  assert.ok(/10,00/.test(open.body.antwoord) && /Amberen Vos/.test(open.body.antwoord));
  const ja = await api('fluister', { q: 'ja' }, lid2);
  assert.ok(ja.body.gedaan && /betaald/i.test(ja.body.antwoord));
  const leeg = await api('fluister', { q: 'staat er nog iets open?' }, lid2);
  assert.ok(/geen betaalverzoeken/i.test(leeg.body.antwoord));
});

test('de Butler bestelt en rekent af: voorstel, "ja", ophaalcode en een echte order', async () => {
  const r = await api('fluister', { q: 'bestel 2 sangria en 1 bravas bij Sunset Ibiza' }, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.voorstel && !r.body.gedaan, 'bestellen is geld: eerst een voorstel');
  assert.ok(/2x Sangria blanca/.test(r.body.antwoord) && /1x Patatas bravas/.test(r.body.antwoord));
  assert.ok(/38,00/.test(r.body.antwoord), 'het totaal staat er eerlijk bij');
  const ja = await api('fluister', { q: 'ja' }, lid);
  assert.ok(ja.body.gedaan, 'besteld en betaald');
  assert.ok(/ophaalcode/i.test(ja.body.antwoord));
  const mijn = (await api('orders/mine', {}, lid)).body.orders || [];
  const o = mijn.find(x => x.supplierCode === 'PONTO' && x.paid);
  assert.ok(o, 'de bestelling staat echt in het systeem en is betaald');
  assert.equal(o.items.reduce((a, i) => a + i.qty, 0), 3);
  assert.equal(o.total, 38);
  // en een onbekende zaak of lege kaartmatch blijft een nette vraag terug
  const mis = await api('fluister', { q: 'bestel kaviaar bij Sunset Ibiza' }, lid);
  assert.ok(!mis.body.voorstel && /op de kaart/i.test(mis.body.antwoord));
});

test('tickets boeken in gewone taal: voorstel, "ja", entreecode', async () => {
  const r = await api('fluister', { q: 'boek 2 tickets voor de sunset cruise morgen om 19:30' }, lid);
  assert.ok(r.body.voorstel, 'tickets zijn geld: eerst een voorstel');
  assert.ok(/Sunset cruise/i.test(r.body.antwoord) && /158,00/.test(r.body.antwoord), 'activiteit en totaal (2 x 79) staan er eerlijk bij');
  const ja = await api('fluister', { q: 'ja' }, lid);
  assert.ok(ja.body.gedaan && /entreecode/i.test(ja.body.antwoord));
  const mijn = (await api('tickets/mijn', {}, lid)).body.tickets || [];
  const t = mijn.find(x => x.supplierName === 'Es Vedra Cruises' && x.personen === 2);
  assert.ok(t, 'het ticket staat echt in het systeem, betaald');
});

test('een rit regelen: voorstel, "ja", offerte en chauffeurtoewijzing', async () => {
  const r = await api('fluister', { q: 'regel een taxi naar Sal de Mar met 2 personen' }, lid);
  assert.ok(r.body.voorstel && /Ibiza Executive Cars/.test(r.body.antwoord));
  const ja = await api('fluister', { q: 'ja' }, lid);
  assert.ok(ja.body.gedaan, 'de rit is aangevraagd');
  assert.ok(/Ibiza Executive Cars/.test(ja.body.antwoord) && /€/.test(ja.body.antwoord), 'vervoerder en offerte in het antwoord');
});

test('"plan mijn dag": een echt programma uit het echte aanbod', async () => {
  const r = await api('fluister', { q: 'plan mijn dag' }, lid);
  assert.ok(r.body.pakte);
  assert.ok(/13:00/.test(r.body.antwoord) && /20:00/.test(r.body.antwoord), 'het plan heeft echte tijden');
  assert.ok(/Sal de Mar/.test(r.body.antwoord), 'met echte zaken uit het aanbod');
  assert.ok(/Sunset cruise|Snorkeltocht|museum/i.test(r.body.antwoord), 'en een echte activiteit');
});

test('saldo opvragen en een reservering annuleren, gewoon in het gesprek', async () => {
  const saldo = await api('fluister', { q: 'wat is mijn saldo?' }, lid);
  assert.ok(saldo.body.pakte && /saldo/i.test(saldo.body.antwoord) && /€/.test(saldo.body.antwoord));
  // een reservering die er echt staat, gaat er met een zin ook weer af
  const over = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await api('reserveer', { supplierCode: 'KIKUNOI', datum: over, tijd: '21:00', personen: 2 }, lid);
  const weg = await api('fluister', { q: 'annuleer mijn reservering bij Sal de Mar' }, lid);
  assert.ok(weg.body.gedaan && /Geannuleerd/i.test(weg.body.antwoord));
  const nogEen = await api('fluister', { q: 'annuleer mijn reservering bij Sal de Mar' }, lid);
  assert.ok(/geen lopende reservering/i.test(nogEen.body.antwoord), 'weg is echt weg');
});

test('"wat kun je": de Butler somt eerlijk zijn hele kunnen op', async () => {
  const r = await api('fluister', { q: 'wat kun je allemaal?' }, lid);
  assert.ok(r.body.pakte);
  for (const stuk of ['zoeken', 'reserveren', 'bestel', '24-uursblok', 'Tik', 'betaalverzoek'])
    assert.ok(r.body.antwoord.includes(stuk), 'het overzicht noemt: ' + stuk);
});

test('de zaak-AI heeft hetzelfde geheugen gekregen: onthouden, opvragen, wissen', async () => {
  const r = await api('supplier/ai', { q: 'onthoud dat de fustwissel op dinsdag is' }, pda);
  assert.equal(r.status, 200);
  assert.ok(/Onthouden/i.test(r.body.reply));
  const wat = await api('supplier/ai', { q: 'wat weet je over mij?' }, pda);
  assert.ok(/fustwissel/.test(wat.body.reply));
  await api('supplier/ai', { q: 'vergeet alles' }, pda);
  const naWis = await api('supplier/ai', { q: 'wat weet je over mij?' }, pda);
  assert.ok(!/fustwissel/.test(naWis.body.reply), 'wissen is echt wissen');
});

test('pakt de Butler een gesprek niet, dan zegt hij dat eerlijk (pakte=false)', async () => {
  // een vers lid zonder stand, weetjes of seintjes: een gewone vraag is
  // dan voor de gesprekslaag van de app, niet voor de motor
  const lid3 = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'lifestyle' }) })).json()).token;
  await api('fluister', { q: 'vergeet alles' }, lid3);
  const r = await api('fluister', { q: 'hoe laat gaat de zon onder?' }, lid3);
  assert.equal(r.body.pakte, false);
  assert.ok(r.body.antwoord && r.body.antwoord.length > 10, 'maar hij laat u nooit met lege handen staan');
});

test('hij onthoudt het gesprek (kort) en wist het net zo makkelijk', async () => {
  await api('fluister', { q: 'vergeet alles' }, lid);
  assert.equal((await api('fluister/profiel', {}, lid)).body.gesprek, 0, 'na "vergeet alles" is ook het gesprek weg');
  await api('fluister', { q: 'goedemorgen' }, lid);
  await api('fluister', { q: 'en hoe laat is het ontbijt?' }, lid);
  assert.equal((await api('fluister/profiel', {}, lid)).body.gesprek, 2, 'de laatste beurten blijven hangen');
  await api('fluister', { q: 'vergeet alles' }, lid);
  assert.equal((await api('fluister/profiel', {}, lid)).body.gesprek, 0);
});

test('hij leert van je schermgebruik: alleen tellers, en hij benoemt de top', async () => {
  assert.equal((await api('fluister/focus', { scores: { Tafelplanning: 14, Betalen: 3, Kamers: 8 } }, lid)).status, 200);
  const prof = (await api('fluister/profiel', {}, lid)).body;
  assert.equal(prof.top[0], 'Tafelplanning', 'de meest gebruikte kaart staat bovenaan');
  const wat = (await api('fluister', { q: 'wat weet je over mij?' }, lid)).body;
  assert.ok(/Tafelplanning/.test(wat.antwoord), 'hij vertelt eerlijk waar hij dat van weet');
});

test('de rem: na 60 berichten in een minuut zegt de motor vriendelijk stop', async () => {
  // een eigen gast-sessie, zodat de rem van dit geweld geen andere test raakt
  const gast = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'guest' }) })).json()).token;
  let laatste = null;
  for (let i = 0; i < 61; i++) laatste = await api('fluister', { q: 'help' }, gast);
  assert.equal(laatste.status, 429, 'de 61e binnen een minuut is er een te veel');
  assert.ok(/rustig|adem/i.test(laatste.body.error));
});

test('het personeel heeft een eigen Fluister, gescheiden van het lid en de zaak', async () => {
  const r = await api('staff/fluister', { q: 'onthoud dat ik op dinsdag altijd de late dienst draai' }, pda);
  assert.equal(r.status, 200);
  const profPda = (await api('staff/fluister/profiel', {}, pda)).body;
  assert.equal(profPda.weetjes.length, 1);
  assert.ok(/late dienst/.test(profPda.weetjes[0].tekst));
  // het geheugen van het lid is en blijft leeg: strikt gescheiden werelden
  assert.equal((await api('fluister/profiel', {}, lid)).body.weetjes.length, 0);
  // en de actuele stand reist mee in een gewoon gesprek
  const antw = (await api('staff/fluister', { q: 'goedemorgen, wat is de stand?' }, pda)).body;
  assert.ok(antw.antwoord && antw.antwoord.length > 10);
});
