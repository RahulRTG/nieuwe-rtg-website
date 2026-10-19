/* ============================================================================
   VOLTOOIPROEF: HET INKOOPDOSSIER VAN DE APP STORE (link:appdossier,
   /apps/appstore-dossier.html).

   De belofte van het scherm: een lid dat een app van een derde overweegt,
   leest wat die app nooit krijgt, waar de gegevens blijven, wie de leverancier
   is en wie hem toeliet, wat er precies draait (de versiehash) en wat dit
   dossier NIET kan zeggen -- en zonder app-sleutel het kanaaldossier dat voor
   elke app geldt. Het scherm roept daarvoor twee routes aan, /api/appstore/
   kanaal en /api/appstore/dossier, en schrijft zelf niets.

   DE KETEN WORDT ECHT GELOPEN. Een dossier over een verzonnen app bewijst
   niets; deze proef laat een zaakmens op naam een uitgeverij aanvragen en een
   bundel inzenden, laat een herleidbaar mens van het kantoor de uitgever
   toelaten en de versie publiceren, en pas daarna leest het lid. Voor de
   publicatie zegt het dossier eerlijk dat er niets te zeggen valt (409); na de
   publicatie draagt het de hash die de uitgever kreeg en de naam van wie
   aftekende. De toegankelijkheidsuitslag zet de proef zelf neer, zoals
   test/appstore-dossier.test.js: dit gaat over het dossier, niet over de
   keurloper.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');

const DOSSIER = '/api/appstore/dossier';
const KANAAL = '/api/appstore/kanaal';
const ORG = 'O-VOLTOOI-DOSSIER';
const SLEUTEL = 'voltooi-dossier';

const HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>V</title></head>' +
  '<body><p id="u">hoi</p><script src="app.js"></script></body></html>';
const BUNDEL = [{ pad: 'index.html', inhoud: HTML },
  { pad: 'app.js', inhoud: 'document.getElementById("u").textContent = "draait";' }];
const MANIFEST = { sleutel: SLEUTEL, naam: 'Voltooi Dossierapp', versie: '1.0.0',
  uitleg: 'Een app van een derde, om het inkoopdossier van begin tot eind te lopen.',
  categorie: 'leven', machtigingen: [{ id: 'opslag.eigen', doel: 'voortgang-onthouden' }] };

/* Een zaakmens OP NAAM: een eigen account, als manager aan de demozaak
   gekoppeld, met een werksessie. Zonder ledensleutel is vier-ogen niet vast te
   stellen (kern/appstore/vierogen.js) -- hetzelfde recept als test/helper.js. */
async function zaakMens(w) {
  const roster = (await w.post('/api/supplier/roster', { code: 'KIKUNOI' })).data || {};
  const chef = (roster.staff || []).find((x) => x.role === 'manager');
  if (!chef) throw new Error('de demozaak heeft geen manager');
  const m = await w.post('/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' });
  const lid = await nieuwLid(w, 'zaak');
  const n = await w.post('/api/supplier/staff/add', { name: 'Zaakmens Voltooi', role: 'manager', func: 'Uitgeverij' }, m.data && m.data.token);
  if (!n.data || !n.data.staff) throw new Error('de zaakmens toevoegen lukte niet (' + n.status + ')');
  await w.post('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId: n.data.staff.id, pin: n.data.pin }, lid.token);
  const s = await w.post('/api/account/start', { rol: 'personeel', code: 'KIKUNOI', staffId: n.data.staff.id }, lid.token);
  if (!s.data || !s.data.token) throw new Error('de werksessie van de zaakmens lukte niet (' + s.status + ')');
  return s.data.token;
}

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'dos');
  let T = lid.token, versie = null, Z = null, K = null, KT = null, office = null;
  const lees = (tok) => w.post(DOSSIER, { sleutel: SLEUTEL }, tok || T);
  const kern = (d) => d && d.ok ? JSON.stringify({ hash: d.watErDraait.hash, versie: d.watErDraait.versie, door: d.leverancier.toegelatenDoor,
    afgetekend: d.watDePoortVond.afgetekendDoor, mag: d.watHetMag.machtigingen.map((m) => m.id || m.label) }) : null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'zonder app-sleutel leest het lid het kanaaldossier: eerst wat geen app kan vragen, dan wat wel, elk met "nooit"', async () => {
    const k = await w.post(KANAAL, {}, T);
    const niet = Object.keys((k.data && k.data.nietGebouwd) || {});
    const m = (k.data && k.data.machtigingen) || [];
    return { klopt: k.status === 200 && niet.length > 0 && m.length > 0 && m.every((x) => x.id && x.geeft && x.nooit) && !!k.data.let,
      ziet: k.status + ', ' + niet.length + ' niet te vragen, ' + m.length + ' machtigingen' };
  });

  await stap('voltooibaar', 'een app die niet bestaat krijgt geen verzonnen dossier maar een melding in woorden', async () => {
    const r = await w.post(DOSSIER, { sleutel: 'bestaat-niet-' + Date.now() }, T);
    return { klopt: r.status === 404 && /bestaat niet/.test((r.data && r.data.error) || ''), ziet: r.status + ' -- ' + (r.data && r.data.error) };
  });

  await stap('voltooibaar', 'een zaakmens op naam zendt een app in; zolang geen mens hem publiceerde, zegt het dossier dat er niets te zeggen valt', async () => {
    const tech = (await w.post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).data || {};
    await w.post('/api/techniek/tenant', { org: ORG, naam: 'Voltooi Uitgeverij' }, tech.token);
    await w.post('/api/techniek/tenant/bind', { org: ORG, soort: 'zaak', code: 'KIKUNOI' }, tech.token);
    Z = await zaakMens(w);
    await w.post('/api/appstore/uitgever/aanvraag', { naam: 'Voltooi Uitgeverij', contact: 'dev@voltooi.nl' }, Z);
    K = await eigenaarSessie(w);
    KT = ((await w.post('/api/account/start', { rol: 'kantoor' }, K)).data || {}).token;
    const t = await w.post('/api/appstore/kantoor/uitgever', { org: ORG, besluit: 'toegelaten', door: 'Sam van RTG' }, KT);
    const i = await w.post('/api/appstore/uitgever/inzenden', { manifest: MANIFEST, bestanden: BUNDEL }, Z);
    versie = i.data && i.data.versie;
    const d = await lees();
    return { klopt: !!tech.token && t.status === 200 && i.status === 200 && !!versie && !!versie.hash && d.status === 409 && /niet live/.test((d.data && d.data.error) || ''),
      ziet: 'uitgever toegelaten ' + t.status + ', inzending ' + i.status + ', dossier vooraf ' + d.status + ' (' + (d.data && d.data.error) + ')' };
  });

  await stap('voltooibaar', 'de uitgever kan zijn eigen app niet publiceren: dat besluit is van een mens van RTG', async () => {
    const b = await w.post('/api/appstore/kantoor/besluit', { versieId: versie.id, besluit: 'gepubliceerd', door: 'Zaakmens Voltooi' }, Z);
    const d = await lees();
    return { klopt: (b.status === 401 || b.status === 403) && d.status === 409,
      ziet: 'besluit door de uitgever ' + b.status + ' (' + ((b.data && b.data.error) || '').slice(0, 60) + '), dossier nog ' + d.status };
  });

  await stap('voltooibaar', 'een herleidbaar mens van het kantoor publiceert; het lid leest de hash van de inzending en de naam van wie aftekende', async () => {
    office = ((await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE })).data || {}).token;
    const a = await w.post('/api/appstore/kantoor/toegankelijk', { versieId: versie.id, stand: 'in-orde', fouten: 0 }, office);
    const b = await w.post('/api/appstore/kantoor/besluit', { versieId: versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, KT);
    const d = await lees();
    const x = d.data || {};
    return { klopt: a.status === 200 && b.status === 200 && d.status === 200 && x.watErDraait.hash === versie.hash &&
      !!x.leverancier.toegelatenDoor && !!x.watDePoortVond.afgetekendDoor && x.leverancier.organisatie === ORG &&
      x.watHetMag.machtigingen.length === 1 && Object.keys(x.nietGebouwd || {}).length > 0,
      ziet: 'keuring ' + a.status + ', publicatie ' + b.status + ', dossier ' + d.status + ': hash ' + String(x.watErDraait && x.watErDraait.hash).slice(0, 12) +
        ', afgetekend door ' + (x.watDePoortVond && x.watDePoortVond.afgetekendDoor) };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie geen dossier en geen kanaaldossier (401)', async () => {
    const a = await w.post(DOSSIER, { sleutel: SLEUTEL });
    const b = await w.post(KANAAL, {});
    return { klopt: a.status === 401 && b.status === 401, ziet: 'dossier ' + a.status + ', kanaal ' + b.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een lid kan het dossier lezen maar geen app publiceren of intrekken', async () => {
    const b = await w.post('/api/appstore/kantoor/besluit', { versieId: versie.id, besluit: 'afgewezen', reden: 'proef' }, T);
    const x = await w.post('/api/appstore/kantoor/intrekken', { sleutel: SLEUTEL, reden: 'proef' }, T);
    const d = await lees();
    return { klopt: (b.status === 401 || b.status === 403) && (x.status === 401 || x.status === 403) && d.status === 200 && d.data.watErDraait.hash === versie.hash,
      ziet: 'besluit ' + b.status + ', intrekken ' + x.status + ', dossier ' + d.status };
  });

  await stap('voltooibaar', 'bevoegdheid: de gedeelde kantoorcode is geen mens en kan geen app aftekenen', async () => {
    const tweede = await w.post('/api/appstore/uitgever/inzenden', { manifest: Object.assign({}, MANIFEST, { versie: '1.0.1' }), bestanden: BUNDEL.concat([{ pad: 'leeg.txt', inhoud: 'v101' }]) }, Z);
    await w.post('/api/appstore/kantoor/toegankelijk', { versieId: tweede.data && tweede.data.versie && tweede.data.versie.id, stand: 'in-orde', fouten: 0 }, office);
    const v2 = tweede.data && tweede.data.versie;
    const b = v2 ? await w.post('/api/appstore/kantoor/besluit', { versieId: v2.id, besluit: 'gepubliceerd', door: 'Iemand van RTG' }, office) : tweede;
    const d = await lees();
    return { klopt: !!v2 && b.status >= 400 && b.status < 500 && d.data.watErDraait.versie === '1.0.0',
      ziet: 'tweede inzending ' + tweede.status + ', besluit met de kantoorcode ' + b.status + ' (' + ((b.data && b.data.error) || '').slice(0, 60) + '), live nog ' + (d.data && d.data.watErDraait.versie) };
  });

  /* ---------------- persistent ---------------- */
  const voor = kern((await lees()).data);
  await w.herstart();

  await stap('persistent', 'na een nette herstart draagt het dossier dezelfde hash, versie, machtigingen en dezelfde aftekenaar', async () => {
    const na = kern((await lees()).data);
    return { klopt: !!voor && na === voor, ziet: na === voor ? 'gelijk: ' + na.slice(0, 90) : 'ANDERS: ' + na };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) leest hetzelfde dossier', async () => {
    T = await inloggen(w, lid);
    const na = kern((await lees(T)).data);
    return { klopt: na === voor, ziet: na === voor ? 'nieuwe sessie leest hetzelfde' : 'ANDERS: ' + na };
  });

  await stap('persistent', 'de gepubliceerde versie en het besluit staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag(versie.hash);
    const besluit = w.vindInOpslag(versie.id);
    return { klopt: plek.length >= 1 && besluit.length >= 1,
      ziet: 'hash in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; versie-id in ' + besluit.length + ' plek(ken)' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op het dossier geeft twee keer hetzelfde dossier en verandert niets', async () => {
    const [a, b] = await w.dubbel(DOSSIER, { sleutel: SLEUTEL }, T);
    return { klopt: a.status === 200 && b.status === 200 && kern(a.data) === voor && kern(b.data) === voor,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + (kern(a.data) === kern(b.data) ? 'gelijk' : 'ANDERS') };
  });

  await stap('herstelbaar', 'een dubbele tik op het publicatiebesluit maakt een live versie en geen tweede journaalbesluit', async () => {
    const v = (await w.post('/api/appstore/uitgever/inzenden', { manifest: Object.assign({}, MANIFEST, { versie: '1.1.0' }), bestanden: BUNDEL.concat([{ pad: 'leeg.txt', inhoud: 'v110' }]) }, Z)).data;
    const v2 = v && v.versie;
    await w.post('/api/appstore/kantoor/toegankelijk', { versieId: v2 && v2.id, stand: 'in-orde', fouten: 0 }, office);
    const [a, b] = await w.dubbel('/api/appstore/kantoor/besluit', { versieId: v2 && v2.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, KT);
    const j = ((await w.post('/api/appstore/kantoor/journaal', { n: 200 }, KT)).data || {}).journaal || [];
    const keer = j.filter((r) => r.wat === 'versie-gepubliceerd' && r.hash === (v2 && v2.hash)).length;
    const d = await lees();
    return { klopt: !!v2 && (a.status === 200 || b.status === 200) && a.status < 500 && b.status < 500 && d.data.watErDraait.versie === '1.1.0' && keer === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', live ' + (d.data && d.data.watErDraait.versie) + ', ' + keer + ' publicatieregel in het journaal' };
  });

  await stap('herstelbaar', 'een afgebroken verzoek, daarna opnieuw: het dossier is heel en ongewijzigd', async () => {
    const voorNu = kern((await lees()).data);
    const half = await w.afgebroken(DOSSIER, { sleutel: SLEUTEL }, T);
    const r = await lees();
    return { klopt: r.status === 200 && kern(r.data) === voorNu,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + r.status };
  });

  await stap('herstelbaar', 'een crash direct na de publicatie: de nieuwe versie staat er na de herstart, met zijn eigen hash', async () => {
    const voorNu = kern((await lees()).data);
    await w.crash();
    const r = await lees();
    return { klopt: r.status === 200 && kern(r.data) === voorNu && r.data.watErDraait.versie === '1.1.0',
      ziet: 'na SIGKILL ' + r.status + ', versie ' + (r.data && r.data.watErDraait.versie) + ', ' + (kern(r.data) === voorNu ? 'gelijk' : 'ANDERS') };
  });
}

module.exports = {
  functie: 'link:appdossier',
  ingang: '/apps/appstore-dossier.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid leest over een app van een derde wie de leverancier is en wie hem toeliet, wat er precies draait, wat hij nooit krijgt en wat het dossier niet kan zeggen -- en dat dossier verschijnt pas nadat een mens van RTG publiceerde, en blijft gelijk na een herstart, een dubbeltik en een crash',
  grens: 'De proef loopt de twee routes van het scherm, niet het scherm zelf. De toegankelijkheidsuitslag zet de proef zelf neer (de keurloper draait hier niet), en de bundel is een minimale app. Het besluit neemt het eigenaarsaccount van de testomgeving als kantoormens; de gedeelde kantoorcode wordt voor aftekenen geweigerd en dat is een schakel. Geen Redis of PostgreSQL.',
  loop
};
