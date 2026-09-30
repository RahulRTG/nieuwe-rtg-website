/* De concierge-lus tegen een echte server (CONCIERGE.md). Een lid vertelt een
   wens in een zin; het kantoor zoekt, de gewone route weigert, een manager biedt
   iets anders aan dat twaalf minuten wordt vastgehouden, het lid beslist alleen
   buiten zijn mandaat, de boot loopt uit, het restaurant valt om en wordt
   vervangen, en de zaak sluit met een uitkomst.

   Wat hier bewezen wordt, en waarom juist dit:
     de intake     een zin wordt een case zonder formulier, met de verrassing aan
     de overgang   een weigering van de gewone route maakt de case bijzonder
     het mandaat   binnen de grens en de tijd zet het kantoor vast, erbuiten
                   beslist het lid
     het verval    staat in test/conciergelus-kern.test.js, met een verschoven klok
     de zaak       ziet zijn eigen onderdeel en niets over de gast of de andere zaak
     de vertraging zet berichten klaar en verstuurt pas als ze allemaal gezien zijn
     het herstel   is een stand in dezelfde case en geen nieuwe case
     het sluiten   "geregeld" kan alleen als het waar is, en draagt de uitkomst

   Draai los: node --test test/conciergelus.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-conciergelus-'));

const roep = async (pad, body, token) => {
  const r = await fetch(BASE + '/api' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { status: r.status, d };
};

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const officeTok = async () => (await roep('/office/login', { code: 'RTG-OFFICE' })).d.token;
async function lifestyleLid() {
  const t = Date.now() + '' + Math.floor(Math.random() * 1e4);
  const r = await roep('/auth/register', { name: 'Lid ' + t, email: 'cl' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' });
  await elevateTier(BASE, r.d.token, 'lifestyle', await officeTok());
  return r.d.token;
}
async function zaakTok(code) {
  const ro = await roep('/supplier/roster', { code });
  const man = ((ro.d && ro.d.staff) || []).find(x => x.role === 'manager') || ((ro.d && ro.d.staff) || [])[0];
  const r = await roep('/supplier/login', { code, staffId: man && man.id, pin: '1234' });
  return r.d && r.d.token;
}

test('de hele lus: van een zin tot een gesloten case met uitkomst', async () => {
  const lid = await lifestyleLid();
  const kant = await officeTok();

  // de intake: een zin, geen formulier
  const i = await roep('/member/bureau/lus/intake', { zin: 'Mijn vrouw is morgen jarig. We zijn in Amsterdam, ze weet van niets. Diner om 20 uur, geen noten.', speelruimteMin: 60, sleutel: 'sleutel-conciergelus-1-0123456789' }, lid);
  assert.equal(i.status, 200, JSON.stringify(i.d));
  const id = i.d.zaak.id;
  assert.equal(i.d.zaak.status, 'in voorbereiding', 'het kantoor mag meteen beginnen');
  assert.equal(i.d.zaak.verrassing, true);
  assert.equal(i.d.zaak.personen, 2);

  const desk = await roep('/office/bureau', {}, kant);
  const rij = desk.d.zaken.find(z => z.id === id);
  assert.ok(rij && rij.lus, 'de case staat op het bureau als lus-case');
  const key = rij.key;
  const k = (pad, b) => roep('/office/bureau/lus' + pad, Object.assign({ key, id }, b || {}), kant);

  // het bureau kan hem niet om de lus heen op "geregeld" zetten
  assert.equal((await roep('/office/bureau/voortgang', { key, id, status: 'in uitvoering' }, kant)).status, 409);
  assert.equal((await roep('/office/bureau/voortgang', { key, id, status: 'geregeld' }, kant)).status, 409);

  // wie het oppakt: met de gedeelde kantoorcode is er geen naam, dus ziet het lid een rol (CON-11)
  const neem = await k('/neem');
  assert.equal(neem.status, 200);
  assert.equal(neem.d.eigenaar.naam, null);
  assert.equal((await roep('/member/bureau/lus/zaak', { id }, lid)).d.eigenaar.rol, 'Lead Rechterhand');
  // de verrassing is een stand die het lid zelf kan zetten
  assert.equal((await roep('/member/bureau/lus/verrassing', { id, aan: true }, lid)).status, 200);

  // de gewone route weigert: de case wordt bijzonder, met de reden in de tijdlijn
  const w = await k('/weigering', { reden: 'Het restaurant is vol.' });
  assert.equal(w.d.soort, 'bijzonder');

  // de boot: binnen de tijd, maar het mandaat staat standaard op voorbereiden -> het lid beslist
  const boot = await k('/aanbod', { wat: 'Privéboot', zaak: 'ESVEDRA', van: '19:00', duurMin: 90, bedragCenten: 45000, geldigMin: 60 });
  assert.equal(boot.d.aanbod.stand, 'vastgehouden');
  const kb = await k('/kies', { aanbod: boot.d.aanbod.id });
  assert.equal(kb.d.wachtOpLid, true, 'standaard mag het kantoor niets zelf vastzetten');
  const zie = await roep('/member/bureau/lus/zaak', { id }, lid);
  assert.equal(zie.d.voorstel.wat, 'Privéboot');
  assert.equal((await roep('/member/bureau/lus/beslis', { id, akkoord: true }, lid)).d.vastgezet, true);

  // het lid geeft ons ruimte: gelegenheden op uitvoeren tot EUR 1.500
  assert.equal((await roep('/member/bureau/delegatie/zet', { domein: 'gelegenheden', niveau: 3, grensCenten: 150000 }, lid)).status, 200);

  // een aanbod dat al verlopen is, wordt niet gekozen
  const oud = await k('/aanbod', { wat: 'Tafel om 20:00', zaak: 'RIJK', van: '20:00', duurMin: 120, bedragCenten: 30000, geldigMin: -5 });
  assert.equal(oud.d.aanbod.stand, 'zonder-termijn', 'een negatieve termijn is geen termijn');

  // de manager biedt 21:15 aan; dat is 75 minuten van 20:00 en valt buiten de 60 minuten speelruimte
  const laat = await k('/aanbod', { wat: 'Diner 21:15 (manager)', bron: 'beslisser', zaak: 'KIKUNOI', van: '21:15', duurMin: 105, bedragCenten: 32000, geldigMin: 12 });
  const kl = await k('/kies', { aanbod: laat.d.aanbod.id });
  assert.equal(kl.d.wachtOpLid, true, 'buiten de speelruimte in tijd beslist het lid');
  assert.ok(kl.d.reden.includes('60 minuten'));
  assert.equal((await roep('/member/bureau/lus/beslis', { id, akkoord: true }, lid)).d.vastgezet, true);

  // een chauffeur binnen grens en tijd: het kantoor zet hem zelf vast
  const rit = await k('/aanbod', { wat: 'Chauffeur', zaak: 'TRANSIT', van: '20:40', duurMin: 20, bedragCenten: 9000, geldigMin: 30 });
  const kr = await k('/kies', { aanbod: rit.d.aanbod.id });
  assert.equal(kr.d.vastgezet, true, 'binnen mandaat vraagt het kantoor niets');

  // de zaak ziet alleen zijn eigen onderdeel en niets over de gast
  const kiku = await zaakTok('KIKUNOI');
  const z = await roep('/supplier/concierge/opdrachten', {}, kiku);
  assert.equal(z.status, 200);
  const mijn = z.d.opdrachten.filter(o => o.caseRef === id);
  assert.equal(mijn.length, 1);
  assert.equal(mijn[0].wat, 'Diner 21:15 (manager)');
  assert.equal(mijn[0].discreet, true);
  const tekst = JSON.stringify(z.d);
  for (const lek of ['Privéboot', 'Chauffeur', 'ESVEDRA', 'Mijn vrouw', key]) assert.ok(!tekst.includes(lek), 'de zaak ziet ' + lek);
  assert.equal((await roep('/supplier/concierge/opdrachten', {}, null)).status, 401);

  // de boot loopt 25 minuten uit: berichten klaar, niets verstuurd
  const kz = await k('');
  const bootOnd = kz.d.zaak.onderdelen.find(o => o.wat === 'Privéboot');
  const v = await k('/vertraging', { onderdeel: bootOnd.id, minuten: 25 });
  const ids = v.d.klaar.berichten.map(m => m.id);
  assert.ok(ids.length >= 2, 'boot en chauffeur schuiven');
  assert.equal((await k('/verstuur', { klaar: v.d.klaar.id, gezien: ids.slice(1) })).status, 409, 'niet alles gezien, niets verstuurd');
  const vs = await k('/verstuur', { klaar: v.d.klaar.id, gezien: ids });
  assert.equal(vs.status, 200);
  assert.ok(vs.d.uitslag.every(u => u.bezorgd), JSON.stringify(vs.d.uitslag));

  // het restaurant valt om: herstel in DEZELFDE case
  const na = await k('');
  const diner = na.d.zaak.onderdelen.find(o => o.wat === 'Diner 21:15 (manager)');
  assert.equal((await k('/kapot', { onderdeel: diner.id, reden: 'keukenprobleem' })).status, 200);
  assert.equal((await k('')).d.zaak.status, 'in herstel');
  assert.equal((await roep('/member/bureau/lus/toelichting', { id, tekst: 'Liefst in de buurt.' }, lid)).status, 200);
  assert.equal((await roep('/office/bureau/voortgang', { key, id, status: 'geregeld' }, kant)).status, 409, 'met een omgevallen diner is niets geregeld');
  const alt = await k('/aanbod', { wat: 'Diner elders', bron: 'alternatief', zaak: 'RIJK', van: '21:30', duurMin: 90, bedragCenten: 28000, geldigMin: 20, vervangt: diner.id });
  const ka = await k('/kies', { aanbod: alt.d.aanbod.id });
  assert.equal(ka.d.wachtOpLid, true, '21:30 ligt 90 minuten van de gevraagde 20:00: ook in herstel beslist het lid');
  assert.equal((await k('')).d.zaak.status, 'wacht op uw akkoord');
  assert.equal((await roep('/member/bureau/lus/beslis', { id, akkoord: true }, lid)).d.vastgezet, true);

  const lidZiet = await roep('/member/bureau/lus/zaak', { id }, lid);
  assert.equal(lidZiet.d.status, 'in uitvoering');
  assert.equal(lidZiet.d.bericht.tekst, 'Wij hebben het programma iets aangepast. Alles is geregeld.');

  // een los onderdeel dat het kantoor buiten een aanbod om regelt, moet eerst bevestigd zijn
  const bl = await k('/onderdeel', { wat: 'Bloemen op de kamer', van: '17:45', duurMin: 5 });
  assert.equal((await roep('/office/bureau/voortgang', { key, id, status: 'geregeld' }, kant)).status, 409, 'bloemen staan nog op gepland');
  assert.equal((await k('/bevestig', { onderdeel: bl.d.onderdeel.id })).status, 200);

  // sluiten, met de uitkomst erbij
  assert.equal((await roep('/office/bureau/voortgang', { key, id, status: 'geregeld', notitie: 'Een avond op het water en een diner.' }, kant)).status, 200);
  const dicht = (await roep('/member/bureau/zaken', {}, lid)).d.zaken.find(x => x.id === id);
  assert.equal(dicht.status, 'geregeld');
  assert.equal(dicht.uitkomst.herstelmomenten, 1);
  assert.equal(dicht.uitkomst.opnieuwVerteld, 1);
  assert.deepEqual(dicht.uitkomst.beloften, { totaal: 4, nagekomen: 4, open: 0 });
});

test('de lus is dicht voor een RTG Pass en voor wie geen kantoor is', async () => {
  const t = Date.now() + '';
  const r = await roep('/auth/register', { name: 'P ' + t, email: 'p' + t + '@v.test', phone: '06' + t.slice(-8),
    password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' });
  assert.equal((await roep('/member/bureau/lus/intake', { zin: 'Een tafel morgen.', sleutel: 'sleutel-conciergelus-2-0123456789' }, r.d.token)).status, 403);
  assert.equal((await roep('/office/bureau/lus/aanbod', { key: 'x', id: 'y', wat: 'x' }, r.d.token)).status, 401);
  // een gewone zaak kan zich niet via /zaak/open in de lus zetten
  const lid = await lifestyleLid();
  const o = await roep('/member/bureau/zaak/open', { titel: 'Test', werkwijze: 'voorstel' }, lid);
  assert.notEqual(o.d.zaak.status, 'in voorbereiding');
  assert.equal(o.d.zaak.werkwijze, undefined);
});
