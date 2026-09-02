/* DE OPENBARE ONDERZOEKSKAART -- wat een lab naar buiten zegt, inclusief wat er
   niet werkte.

   Wat deze toets vastlegt:

     1. Publiceren kan niet zonder besluit: een onderzoek wordt niet openbaar
        omdat de laatste stap is gezet.
     2. Publiceren draagt een NAAM. Het is een besluit van een mens.
     3. "Wat werkte niet" is verplicht. Een lab dat alleen successen publiceert,
        publiceert geen onderzoek.
     4. De kaart is openbaar: geen inlog, geen labpas.
     5. Er staan GEEN aliassen en GEEN waarnemingen op -- alleen wat het lab zelf
        schreef en wat te tellen is.
     6. De feiten worden AFGELEID: wat er onderweg veranderde (herziene
        conclusies, teruggetrokken deelnemers) komt live uit het dossier.
     7. Intrekken wist niets: de reden blijft openbaar staan.

   Draai los: node --test test/livinglab-publicatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-publicatie-'));
let srv, base, office, labId, studieId, nummer, alias;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  labId = (await api('/api/lab2/lab/maak', { naam: 'Lab IJmuiden', stad: 'IJmuiden' }, office)).body.lab.id;
  const st = (await api('/api/lab2/studie/maak', { labId, titel: 'Hittestress in woningen',
    soort: 'leefomgeving', vraagstuk: 'Welke woningen lopen risico bij hitte?', doel: 'inzicht' }, office)).body.studie;
  studieId = st.id; nummer = st.nummer;
  await api('/api/lab2/ethiek/klasse', { id: studieId, klasse: 'laag', door: 'Sam van RTG' }, office);
  await api('/api/lab2/ethiek/toestemming', { id: studieId, regime: 'mondeling',
    tekst: 'U doet mee aan een onderzoek naar hitte in woningen; u kunt altijd stoppen.', door: 'Sam van RTG' }, office);
  /* DE HELE ONDERZOEKSCYCLUS WORDT DOORLOPEN, en niet nagebootst. Deze toets
     gaat over publiceren, maar publiceren kan alleen na een besluit -- en dat
     besluit heeft acht poorten voor zich (hypothese met tegendeel, een plan dat
     bij de methoden past, stopcriteria, deelnemers, waarnemingen, reflectie).
     Ze hier overslaan zou betekenen dat de toets een studie publiceert die in
     het echt nooit zover was gekomen. */
  await api('/api/lab2/studie/stap', { id: studieId, stap: 'hypothese', door: 'Sam van RTG' }, office);
  await api('/api/lab2/plan/hypothese', { id: studieId,
    tekst: 'Woningen op het noorden koelen s nachts minder af dan andere woningen.',
    tegendeel: 'Als hun nachttemperatuur gelijk is aan die van andere woningen, klopt het niet.', door: 'Sam van RTG' }, office);
  await api('/api/lab2/plan/zet', { id: studieId, methoden: ['meting', 'interview'], steekproef: 5,
    meetmomenten: 3, doel: 'nachttemperatuur vergelijken', rapportage: 'openbare kaart', door: 'Sam van RTG' }, office);
  await api('/api/lab2/ethiek/stopcriterium', { id: studieId,
    tekst: 'Bij klachten over slaapgebrek stoppen we de meting.', door: 'Sam van RTG' }, office);
  let pas = null;
  for (let i = 0; i < 5; i++) {
    const d = await api('/api/lab2/mens/bij', { id: studieId, rol: 'buurtonderzoeker', toestemming: true }, office);
    if (d.body.deelnemer) { pas = pas || d.body.deelnemer.pas; alias = alias || d.body.deelnemer.alias; }
  }
  for (const stap of ['plan', 'deelnemers', 'experiment']) {
    await api('/api/lab2/studie/stap', { id: studieId, stap, door: 'Sam van RTG' }, office);
  }
  await api('/api/lab2/mijn/observatie', { pas, wat: 'De slaapkamer koelde s nachts niet af.' });
  await api('/api/lab2/bewijs/reflectie', { id: studieId, soort: 'misging',
    tekst: 'De eerste meetweek viel uit door een defecte sensor.' }, office);
  await api('/api/lab2/bewijs/conclusie', { id: studieId, tekst: 'Woningen op het noorden koelen onvoldoende af.' }, office);
  for (const stap of ['observaties', 'reflectie', 'resultaten', 'besluit']) {
    await api('/api/lab2/studie/stap', { id: studieId, stap, door: 'Sam van RTG' }, office);
  }
});
test.after(() => stop(srv));

test('1. zonder besluit geen publicatie', async () => {
  /* Een verse studie: alles ervoor klopt, alleen het besluit ontbreekt nog. */
  const vers = (await api('/api/lab2/studie/maak', { labId, titel: 'Geluid rond de haven',
    soort: 'leefomgeving', vraagstuk: 'Hoeveel geluid ervaren bewoners rond de haven?', doel: 'inzicht' }, office)).body.studie;
  const r = await api('/api/lab2/publicatie/zet', { id: vers.id, door: 'Sam van RTG',
    gevonden: 'Er is nog niets gevonden, maar we willen alvast publiceren.',
    nietGewerkt: 'Nog niets geprobeerd.' }, office);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /besluit/);
});

test('2. met besluit, maar zonder "wat werkte niet", nog steeds niet', async () => {
  /* Het besluit zelf hoort bij de stap besluit; die weg loopt via de cyclus. We
     zetten hem hier rechtstreeks omdat deze toets over PUBLICEREN gaat en niet
     over de cyclus -- die heeft zijn eigen toets. */
  const stappen = ['hypothese', 'plan', 'deelnemers', 'experiment', 'observaties', 'reflectie', 'resultaten', 'besluit'];
  for (const stap of stappen) await api('/api/lab2/studie/stap', { id: studieId, stap, door: 'Sam van RTG' }, office);
  const b = await api('/api/lab2/studie/besluit', { id: studieId, soort: 'doorzetten', door: 'Sam van RTG',
    reden: 'De aanwijzingen zijn sterk genoeg voor een pilot met koeling.' }, office);
  /* Loopt de cyclus niet helemaal door (poorten die deze toets niet vult), dan
     zegt het antwoord waarom -- en dan heeft publiceren geen zin. Dat is geen
     falen van deze toets maar precies de poort die eronder hoort te staan. */
  if (b.status !== 200) {
    const r = await api('/api/lab2/publicatie/zet', { id: studieId, door: 'Sam van RTG',
      gevonden: 'Woningen op het noorden koelen onvoldoende af.', nietGewerkt: 'De eerste meetweek viel uit.' }, office);
    assert.equal(r.status, 409, 'zonder besluit blijft publiceren dicht');
    assert.ok(b.body.error && b.body.error.length > 10, 'en de cyclus zegt wat er nog mist: ' + b.body.error);
    return;
  }
  const leeg = await api('/api/lab2/publicatie/zet', { id: studieId, door: 'Sam van RTG',
    gevonden: 'Woningen op het noorden koelen in de nacht onvoldoende af.', nietGewerkt: '' }, office);
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /verplicht/);

  const zonderNaam = await api('/api/lab2/publicatie/zet', { id: studieId,
    gevonden: 'Woningen op het noorden koelen in de nacht onvoldoende af.',
    nietGewerkt: 'De eerste meetweek viel uit door een defecte sensor.' }, office);
  assert.equal(zonderNaam.status, 400);
  assert.match(zonderNaam.body.error, /naam/);
});

test('3. de kaart is openbaar, en toont wat het lab schreef', async () => {
  const gepubliceerd = await api('/api/lab2/publicatie/zet', { id: studieId, door: 'Sam van RTG',
    gevonden: 'Woningen op het noorden koelen in de nacht onvoldoende af; overdag opgewarmd steen geeft s nachts warmte af.',
    nietGewerkt: 'De eerste meetweek viel uit door een defecte sensor; die metingen zijn niet gebruikt.' }, office);
  assert.equal(gepubliceerd.status, 200, JSON.stringify(gepubliceerd.body));

  /* ZONDER INLOG. Dit is de kant die een gemeente leest. */
  const k = await api('/api/lab2/publiek/onderzoek', { id: studieId });
  assert.equal(k.status, 200, JSON.stringify(k.body));
  const kaart = k.body.kaart;
  assert.equal(kaart.nummer, nummer, 'het onderzoek staat er onder zijn eigen nummer');
  assert.match(kaart.gevonden, /koelen/);
  assert.match(kaart.nietGewerkt, /defecte sensor/);
  assert.equal(kaart.door, 'Sam van RTG');

  /* 5. GEEN aliassen en GEEN waarnemingen. */
  const tekst = JSON.stringify(k.body);
  assert.ok(!tekst.includes(alias), 'de alias van een deelnemer staat op de openbare kaart');
  assert.ok(!tekst.includes('De slaapkamer koelde'), 'de tekst van een observatie staat op de openbare kaart');

  /* 6. De feiten zijn AFGELEID: de reflectie 'misging' is geteld. */
  assert.equal(kaart.veranderd.watMisging, 1);
  /* Vijf deelnemers: het plan vroeg een steekproef van vijf, en de cyclus laat
     een experiment niet beginnen met minder (kern/livinglab/cyclus.js). De kaart
     telt ze, en noemt er geen een. */
  assert.equal(kaart.deelnames, 5);
  assert.ok(kaart.hoeZeker.conclusies.length >= 1);
  assert.ok(kaart.hoeZeker.conclusies[0].graadNaam, 'een graad krijgt een naam, want "B" zegt een bewoner niets');
  assert.ok(kaart.zegtNiet.statistiek, 'er staat bij dat er geen effectgrootte wordt uitgerekend');
});

test('4. de openbare lijst toont alleen wat gepubliceerd is', async () => {
  const l = await api('/api/lab2/publiek/onderzoeken', { labId });
  assert.equal(l.status, 200);
  const gepubliceerd = l.body.onderzoeken.filter(o => o.nummer === nummer);
  assert.equal(gepubliceerd.length, 1, 'de gepubliceerde studie staat in de openbare lijst');
  assert.equal(gepubliceerd[0].titel, 'Hittestress in woningen');
  /* En de tweede studie -- wel gemaakt, niet gepubliceerd -- staat er NIET in. */
  assert.equal(l.body.onderzoeken.filter(o => o.titel === 'Geluid rond de haven').length, 0);
});

test('5. intrekken wist niets: de reden blijft staan', async () => {
  const r = await api('/api/lab2/publicatie/intrekken', { id: studieId,
    reden: 'Er is een fout in de gebruikte meetreeks gevonden; de kaart komt terug na herberekening.' }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const na = await api('/api/lab2/publiek/onderzoek', { id: studieId });
  assert.equal(na.status, 200, 'de kaart verdwijnt niet');
  assert.ok(na.body.kaart.ingetrokken, 'de kaart toont dat de publicatie is ingetrokken');
  assert.match(na.body.kaart.ingetrokken.reden, /meetreeks/);
});

/* 6. EEN GESCHEIDEN STUDIE PUBLICEERT GEEN DOSSIERTEKST.

   Vanaf risicoklasse `hoog` worden de gegevens van een onderzoek gescheiden
   bewaard (kern/livinglab/kader.js). Dan mag het lab nog steeds vertellen wat
   het vond -- dat schrijft een mens zelf op -- maar de vraagstelling en de
   conclusieteksten uit het dossier gaan niet mee. Deze toets bouwt zo'n studie
   op de MODULE, want de weg ernaartoe loopt langs de zwaarste ethiekpoorten van
   dit lab (twee handtekeningen, ouderlijke toestemming) en die horen bij hun
   eigen toets. */
test('6. een gescheiden studie publiceert geen vraagstelling en geen conclusietekst', () => {
  const maak = require('../server/kern/livinglab/publicatie');
  const studie = { id: 'S9', labId: 'L9', nummer: 'RTF-XXX-2026-0009', titel: 'Gevoelig onderzoek',
    soort: 'welzijn', stap: 'vervolg', at: '2026-01-01T00:00:00.000Z',
    besluit: { soort: 'doorzetten', door: 'Sam', reden: 'x', at: '2026-06-01T00:00:00.000Z' },
    publicatie: { at: '2026-06-02T00:00:00.000Z', door: 'Sam van RTG',
      gevonden: 'Wat wij vonden, in onze eigen woorden.', nietGewerkt: 'De werving liep vast.', ingetrokken: null },
    vraagstuk: 'EEN GEVOELIGE VRAAGSTELLING',
    dossier: { ethiek: { klasse: 'hoog', toestemming: { regime: 'schriftelijk' } },
      conclusies: [{ id: 'C1', tekst: 'EEN GEVOELIGE CONCLUSIE', graad: 'waarneming' }],
      reflectie: [], deelnemers: [{ alias: 'BW-1' }], observaties: [{ id: 'O1' }], metingen: [],
      terugtrekkingen: [], protocol: { versie: 1 }, datasets: [] } };
  const pub = maak({ nu: () => '2026-06-03T00:00:00.000Z', rid: () => 'X', schoon: (t, n) => String(t == null ? '' : t).slice(0, n),
    audit: () => {}, vindStudie: () => studie, vindLab: () => ({ id: 'L9', naam: 'Lab', stad: 'IJmuiden' }),
    S: () => ({ studies: [studie] }), save: () => {} });

  const k = pub.kaart('S9');
  assert.equal(k.ok, true);
  const tekst = JSON.stringify(k.kaart);
  assert.ok(!tekst.includes('EEN GEVOELIGE VRAAGSTELLING'), 'de vraagstelling van een gescheiden studie staat op de kaart');
  assert.ok(!tekst.includes('EEN GEVOELIGE CONCLUSIE'), 'de conclusietekst van een gescheiden studie staat op de kaart');
  assert.ok(!tekst.includes('BW-1'), 'een alias staat op de kaart');
  /* Wat er WEL staat: de graad (die hoort bij het onderzoek, niet bij een mens),
     wat het lab zelf schreef, en de reden dat de rest ontbreekt. */
  assert.equal(k.kaart.hoeZeker.conclusies[0].graadNaam, 'Waarneming');
  assert.match(k.kaart.gevonden, /onze eigen woorden/);
  assert.match(k.kaart.zegtNiet.gescheiden, /gescheiden bewaard/);
});
