/* RTG ECONOMIC CONTROL PLANE: vier werelden, en een firewall ertussen die
   standaard weigert.

   Deze toetsen gaan over de GRENS en niet over de rekensom -- die staat in
   test/kosten.test.js. Wat hier moet houden is de bewering waarop de hele
   opzet rust: kosten van de ene economie komen nooit bij een gebruiker van de
   andere, ook niet als iemand het beleid, de meting of de doorbelasting
   verkeerd zet.

   Elke toets hieronder is tegen een tijdelijk kapotgemaakte kern gezien zakken
   (LAT.md regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/economie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, kantoor;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let teller = 0;
async function versLid() {
  const t = Date.now() + '-' + (teller++);
  const r = await api('/api/auth/register', {
    name: 'Economie Toets', email: 'econ-' + t + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registratie gaf geen token: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

async function nu() {
  const r = await api('/api/office/kosten/overzicht', {}, kantoor);
  return r.body.periode;
}

test.before(async () => {
  srv = await startServer(); base = srv.base;
  kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier niets te toetsen');
  await api('/api/office/kosten/tarief/zet',
    { soort: 'verzoek', perEenheid: 100000, bron: 'Toetstarief, hostingcontract 2026' }, kantoor);
});
test.after(() => stop(srv));

/* MUTATIE: in werelden.js de dragers van 'rtfoundation' op ['lid'] gezet --
   deze toets zakt dan, want dan hoort een gezin bij de verkeerde economie en
   valt de hele scheiding weg. */
test('vier werelden, en een gebruiker hoort bij precies een', async () => {
  const r = await api('/api/office/economie/werelden', {}, kantoor);
  assert.equal(r.status, 200);
  const ids = r.body.werelden.map(w => w.wereld || w.id);
  assert.deepEqual(ids.slice().sort(), ['commercieel', 'consument', 'rtfoundation', 'rtg-intern']);
  const rtf = r.body.werelden.find(w => (w.id || w.wereld) === 'rtfoundation');
  assert.equal(rtf.factureerbaar, false, 'de RTFoundation stuurt haar gezinnen geen rekeningen');
  assert.deepEqual(rtf.dragers, ['gezin']);
  const intern = r.body.werelden.find(w => (w.id || w.wereld) === 'rtg-intern');
  assert.equal(intern.factureerbaar, false);

  /* EN ELKE DRAGERSOORT HOORT BIJ PRECIES EEN WERELD -- niet bij nul en niet bij
     twee. Dat is de invariant waar de hele firewall op rust: een soort zonder
     wereld valt er stil buiten. Hier stond eerst een terugval in de code die dat
     moest opvangen, en die bleek onbereikbaar en dus onbeproefbaar; deze
     bewering vervangt hem. */
  const { SOORTEN_DRAGER } = require('../server/kern/kosten/haak');
  const gedekt = [];
  for (const w of r.body.werelden) for (const d of w.dragers) gedekt.push(d);
  assert.deepEqual(gedekt.slice().sort(), SOORTEN_DRAGER.slice().sort(),
    'de werelden dekken niet exact de dragersoorten: een soort zonder wereld valt buiten de firewall');
  assert.equal(new Set(gedekt).size, gedekt.length, 'een dragersoort hoort bij twee werelden');
});

/* MUTATIE: in firewall.js de tak `if (!r)` weggehaald zodat een ontbrekende
   relatie doorlaat -- deze toets zakt dan op de eerste bewering. */
test('de firewall weigert standaard, en zegt hoe het wel kan', async () => {
  const r = await api('/api/office/economie/proef', { van: 'rtg-intern', naar: 'rtfoundation' }, kantoor);
  assert.equal(r.body.uitslag.ok, false);
  assert.equal(r.body.uitslag.code, 'geen-relatie');
  assert.match(r.body.uitslag.uitleg, /geen economische relatie/i);
  assert.match(r.body.uitslag.hoeWel, /grondslag/i, 'een weigering die niet zegt hoe het wel kan, wordt omzeild');

  // binnen dezelfde wereld hoeft er niets te worden afgesproken
  const eigen = await api('/api/office/economie/proef', { van: 'consument', naar: 'consument' }, kantoor);
  assert.equal(eigen.body.uitslag.ok, true);
  assert.equal(eigen.body.uitslag.code, 'eigen-wereld');
});

/* MUTATIE: in relaties.js de grondslag-eis weggehaald -- deze toets zakt dan
   op de eerste helft; en de plafond-eis weggehaald laat de tweede zakken. */
test('een relatie zonder grondslag of zonder plafond bestaat niet', async () => {
  const zonderGrond = await api('/api/office/economie/relatie/zet',
    { van: 'rtg-intern', naar: 'commercieel', plafondCenten: 100000 }, kantoor);
  assert.equal(zonderGrond.status, 400);
  assert.match(zonderGrond.body.error, /grondslag/i);

  const zonderPlafond = await api('/api/office/economie/relatie/zet',
    { van: 'rtg-intern', naar: 'commercieel', grondslag: 'Leverancierscontract artikel 7' }, kantoor);
  assert.equal(zonderPlafond.status, 400);
  assert.match(zonderPlafond.body.error, /plafond|open kraan/i);

  const goed = await api('/api/office/economie/relatie/zet',
    { van: 'rtg-intern', naar: 'commercieel', grondslag: 'Leverancierscontract artikel 7', plafondCenten: 500000 }, kantoor);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.relatie.plafondCenten, 500000);
  assert.match(goed.body.relatie.grondslag, /artikel 7/);

  const j = await api('/api/office/economie/journaal', {}, kantoor);
  assert.ok(j.body.journaal.some(x => x.wat === 'geopend' && x.naar === 'commercieel'),
    'het openen van een relatie hoort in het journaal te staan');
});

/* MUTATIE: in relaties.js de reden-eis bij relatieWeg weggehaald -- deze toets
   zakt dan op de eerste helft. En het journaal niet schrijven laat de laatste
   bewering zakken. */
test('een relatie sluiten vraagt een reden, en blijft na te lezen', async () => {
  await api('/api/office/economie/relatie/zet',
    { van: 'rtg-intern', naar: 'rtfoundation', grondslag: 'Toets: dienstverleningsovereenkomst RTG-RTF', plafondCenten: 250000 }, kantoor);
  const open = await api('/api/office/economie/proef', { van: 'rtg-intern', naar: 'rtfoundation' }, kantoor);
  assert.equal(open.body.uitslag.ok, true, 'de relatie ging niet open');

  const zonderReden = await api('/api/office/economie/relatie/weg', { van: 'rtg-intern', naar: 'rtfoundation' }, kantoor);
  assert.equal(zonderReden.status, 400);
  assert.match(zonderReden.body.error, /reden/i);

  const weg = await api('/api/office/economie/relatie/weg',
    { van: 'rtg-intern', naar: 'rtfoundation', reden: 'Toets: overeenkomst afgelopen per einde maand' }, kantoor);
  assert.equal(weg.status, 200);

  const dicht = await api('/api/office/economie/proef', { van: 'rtg-intern', naar: 'rtfoundation' }, kantoor);
  assert.equal(dicht.body.uitslag.ok, false, 'na sluiten hoort de weg weer dicht te zijn');

  /* EN HIJ IS NA TE LEZEN. Er kunnen facturen op deze relatie zijn gebaseerd;
     een grondslag die zonder spoor verdwijnt, maakt die onverklaarbaar. */
  const j = await api('/api/office/economie/journaal', {}, kantoor);
  const regel = j.body.journaal.find(x => x.wat === 'gesloten' && x.naar === 'rtfoundation');
  assert.ok(regel, 'het sluiten staat niet in het journaal');
  assert.match(regel.reden, /overeenkomst afgelopen/);
  assert.match(regel.vorige.grondslag, /dienstverleningsovereenkomst/);
});

/* MUTATIE: in firewall.js de plafondtoets (`bedrag > r.plafondCenten`)
   weggehaald -- deze toets zakt dan, want dan buigt het plafond mee met het
   bedrag en is het geen plafond. */
test('het plafond van een relatie slaat af op het bedrag', async () => {
  await api('/api/office/economie/relatie/zet',
    { van: 'rtg-intern', naar: 'commercieel', grondslag: 'Leverancierscontract artikel 7', plafondCenten: 1000 }, kantoor);
  const onder = await api('/api/office/economie/proef', { van: 'rtg-intern', naar: 'commercieel', centen: 999 }, kantoor);
  assert.equal(onder.body.uitslag.ok, true);
  const boven = await api('/api/office/economie/proef', { van: 'rtg-intern', naar: 'commercieel', centen: 1001 }, kantoor);
  assert.equal(boven.body.uitslag.ok, false);
  assert.equal(boven.body.uitslag.code, 'boven-plafond');
  assert.equal(boven.body.uitslag.plafondCenten, 1000);
});

/* MUTATIE: in toerekening.js de tweede verdeelstap over de dragers van EEN
   wereld vervangen door een verdeling over alle dragers -- deze toets zakt dan,
   want dan betaalt een lid mee aan het deel van de gezinnen. */
test('de nota gaat eerst over de werelden en daarna pas over de gebruikers', async () => {
  const p = await nu();
  const lid = await versLid();
  for (let i = 0; i < 4; i++) await api('/api/kosten/mij', {}, lid);
  const gezin = await api('/api/foundation/gezin/maak',
    { gezinsnaam: 'Wereldtoets', naam: 'Ouder', pin: '1234' });
  const code = gezin.body.code;
  assert.ok(code, 'geen gezin gemaakt');
  for (let i = 0; i < 4; i++) await api('/api/foundation/gezin/inloggen', { code });

  await api('/api/office/kosten/nota/zet',
    { periode: p, soort: 'stroom', centen: 20000, bron: 'Nota energieleverancier' }, kantoor);

  /* De laatste lezing VAN HET LID staat hier, en niet verderop, en dat is geen
     ordening maar een noodzaak. Elk verzoek van een lid telt zelf als verbruik,
     dus een lezing tussen twee metingen door verschuift de verdeelsleutel waar
     de toets net iets over beweerde. Vanaf hier alleen nog kantoorroutes: die
     lopen niet langs de ledenpoort en tellen dus niet mee.

     Dit is dezelfde valkuil als in test/kosten.test.js, en hij kostte daar een
     ronde: de eerste versie van deze toets zakte op 12000 tegen 11111, en dat
     verschil was precies dit ene verzoek. */
  const mij = await api('/api/kosten/mij', {}, lid);
  const eigen = mij.body.overzicht.toegerekend.filter(x => x.soort === 'stroom');
  assert.equal(eigen.length, 1,
    'een gebruiker hoort precies EEN stroomregel te krijgen, uit zijn eigen wereld; ' +
    eigen.length + ' betekent dat hij ook meedeelt in het deel van een andere economie');
  assert.equal(eigen[0].wereld, 'consument');

  const w = await api('/api/office/economie/werelden', { periode: p }, kantoor);
  const posten = w.body.wereldposten.filter(x => x.soort === 'stroom');
  assert.ok(posten.length >= 2, 'de nota is niet over de werelden verdeeld');
  assert.equal(posten.reduce((a, x) => a + x.centen, 0), 20000, 'de werelddelen tellen niet op tot de nota');

  const rtf = posten.find(x => x.wereld === 'rtfoundation');
  assert.ok(rtf && rtf.centen > 0, 'de RTFoundation heeft verbruik maar geen werelddeel');
  /* En dat deel is NIET doorbelast, want er is geen relatie naar de stichting.
     Het blijft dus bij RTG, en dat staat er met zoveel woorden. */
  assert.equal(rtf.doorbelastbaar, false);
  assert.equal(rtf.betaaldDoor, 'rtg-intern');
  assert.match(rtf.firewall.uitleg, /geen economische relatie/i);

  const consument = posten.find(x => x.wereld === 'consument');
  assert.ok(consument && consument.centen > 0 && consument.centen < 20000,
    'de consumentenwereld hoort een deel te dragen en niet alles; anders is er niet per wereld verdeeld');

  /* EN DE OPTELLING KLOPT PER WERELD. Dit is de bewering waar alles op rust:
     wat de gebruikers van een wereld samen dragen is exact het werelddeel van
     die wereld -- geen cent uit een andere economie erbij, en geen cent van
     henzelf naar een andere toe. Zonder deze som is de scheiding een label op
     een regel in plaats van een verdeling. */
  const alle = await api('/api/office/kosten/overzicht', { periode: p }, kantoor);
  const perWereld = {};
  for (const g of alle.body.gebruikers) {
    const beeld = await api('/api/office/kosten/gebruiker', { periode: p, drager: g.drager }, kantoor);
    for (const r of beeld.body.overzicht.toegerekend.filter(x => x.soort === 'stroom')) {
      perWereld[r.wereld] = (perWereld[r.wereld] || 0) + r.centen;
    }
  }
  for (const post of posten) {
    assert.equal(perWereld[post.wereld] || 0, post.centen,
      'de gebruikers van ' + post.wereld + ' dragen samen niet precies het werelddeel van die wereld');
  }
  assert.equal(Object.values(perWereld).reduce((a, c) => a + c, 0), 20000,
    'alle gebruikers samen dragen niet precies de nota');
});

/* MUTATIE: in factuurregel.js de magDragerBelasten-poort weggehaald -- deze
   toets zakt dan, want dan kan een gezin alsnog een factuurregel krijgen. */
test('een gezin krijgt nooit een factuurregel, ook niet als het beleid het zou willen', async () => {
  const p = await nu();
  const gezin = await api('/api/foundation/gezin/maak',
    { gezinsnaam: 'Poorttoets', naam: 'Ouder', pin: '1234' });
  const code = gezin.body.code;
  for (let i = 0; i < 3; i++) await api('/api/foundation/gezin/inloggen', { code });

  /* De stand van een gezin is niet te verzetten (kern/kosten/beleidkaart.js), en
     dat is de eerste grendel. Deze toets gaat over de TWEEDE: ook als die eerste
     ooit zou wegvallen, hoort de poort voor de factuurregel het tegen te houden.
     Vandaar dat we hem hier rechtstreeks bevragen. */
  const verzet = await api('/api/office/kosten/beleid/zet',
    { pas: 'gezin', stand: 'doorbelasten', reden: 'Toets: mag dit uberhaupt' }, kantoor);
  assert.equal(verzet.status, 403);

  const v = await api('/api/office/kosten/voorstel', { periode: p }, kantoor);
  const rij = v.body.rijen.find(r => r.drager === 'gezin:' + code);
  assert.ok(rij, 'het gezin staat niet in het voorstel');
  assert.equal(rij.factureren, false);
  assert.equal(rij.wereld, 'rtfoundation');

  const vrij = await api('/api/office/kosten/vrijgeven', { periode: p }, kantoor);
  assert.ok(vrij.status === 200 || vrij.status === 409);
  const geboekt = (vrij.body.regels || []).concat(vrij.body.mislukt || []);
  assert.ok(!geboekt.some(x => String(x.drager || '').startsWith('gezin:')),
    'er is een factuurregel voor een gezin geboekt');
});

/* DE TWEEDE GRENDEL, RECHTSTREEKS BEVRAAGD.

   De toets hierboven bewijst dat een gezin geen factuurregel krijgt. Hij bewijst
   NIET dat de poort in kern/kosten/factuurregel.js daaraan meedoet: het beleid
   houdt een gezin al tegen voordat er ooit geboekt wordt, dus die tweede grendel
   wordt over de routes nooit geraakt. Dat bleek toen ik hem weghaalde en alles
   groen bleef -- een controle waarvan je de zakkende kant nooit hebt gezien, is
   geen controle (LAT.md regel 2).

   Vandaar deze toets op een MINIMALE kern, zoals test/waardegraaf.test.js dat
   doet met het grootboek. Hij roept de boeking rechtstreeks aan met de gevallen
   die over de voordeur niet te maken zijn, en die juist daarom in code moeten
   staan: de dag dat de eerste grendel wegvalt, is dit wat er tussen een
   softwarefout en de rekening van een gezin staat.

   MUTATIE: in factuurregel.js de magDragerBelasten-poort weggehaald -- deze
   toets zakt dan op alle drie de weigeringen. */
test('de poort voor de factuurregel weigert een andere wereld, ook buiten de routes om', () => {
  const db = { data: {} };
  const save = () => {};
  const economie = require('../server/kern/economie')({ db, save }).economie;
  const accounts = { getMemberState: () => ({ invoices: [] }), saveMemberState: () => {} };
  const { boekDoorbelasting } = require('../server/kern/kosten/factuurregel')({ db, save, accounts, economie });

  // een gezin: zijn wereld factureert haar gebruikers niet
  const gezin = boekDoorbelasting({ drager: 'gezin:ABC123', periode: '2026-08', centen: 5000, wereld: 'rtfoundation' });
  assert.ok(gezin.error, 'een gezin kreeg een factuurregel');
  assert.equal(gezin.code, 'wereld-factureert-niet');

  // het huis: verbruik zonder eigenaar sturen we niemand
  const huis = boekDoorbelasting({ drager: 'huis', periode: '2026-08', centen: 5000, wereld: 'rtg-intern' });
  assert.ok(huis.error, 'het huis kreeg een factuurregel');
  assert.equal(huis.code, 'wereld-factureert-niet');

  /* EN DE VERWISSELING ZELF: een lid, met kosten die uit de wereld van de
     stichting komen. Dit is het geval waar de hele firewall voor bestaat, en
     het is precies wat een programmeerfout oplevert. */
  const kruis = boekDoorbelasting({ drager: 'lid:user-9', periode: '2026-08', centen: 5000, wereld: 'rtfoundation' });
  assert.ok(kruis.error, 'kosten uit de RTFoundation landden op de rekening van een lid');
  assert.equal(kruis.code, 'andere-wereld');
  assert.match(kruis.error, /nooit de kosten van een andere wereld/i);

  // en de gewone weg doet het gewoon, anders toetst het bovenstaande een dichte deur
  const goed = boekDoorbelasting({ drager: 'lid:user-9', periode: '2026-08', centen: 5000, wereld: 'consument' });
  assert.ok(!goed.error, 'de gewone doorbelasting werd ook geweigerd: ' + goed.error);
  assert.match(goed.id, /VERBRUIK/);
});

/* MUTATIE: in kern/kosten/index.js de constructiecontrole weggehaald -- deze
   toets zakt dan, want dan bouwt de kostprijslaag zonder firewall en draait een
   opzet die hem vergeet gewoon door.

   Waarom dit een toets waard is: hier stonden DRIE takken die elk netjes
   afhandelden wat er moet gebeuren als de economielaag ontbreekt (in de
   verdeling, in de doorbelasting, in de factuurregel). Alle drie verdedigbaar,
   en samen een gat -- want dan is er geen enkel moment waarop iemand het merkt.
   Nu is het een fout bij het opbouwen, en die valt niet te missen. */
test('de kostprijslaag komt niet tot stand zonder firewall', () => {
  const db = { data: {} };
  const maakKosten = require('../server/kern/kosten');
  assert.throws(() => maakKosten({ db, save: () => {}, accounts: {} }),
    /economielaag ontbreekt/i,
    'de kostprijslaag liet zich bouwen zonder economielaag; dan is de firewall optioneel');

  // en met de laag erbij bouwt hij gewoon, anders toetst het bovenstaande niets
  const economie = require('../server/kern/economie')({ db, save: () => {} }).economie;
  const k = maakKosten({ db, save: () => {}, accounts: {}, economie });
  assert.ok(k.kosten && typeof k.kosten.voorstel === 'function');
});
