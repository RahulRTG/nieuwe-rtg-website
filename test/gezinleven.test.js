/* ============================================================================
   HET GEZINSLEVEN: DE OCHTEND EN HET FEEST.

   WAT DEZE TWEE MODULES GEMEEN HEBBEN

   Ze coderen allebei een OPVOEDKUNDIGE keuze, en in allebei is die keuze met
   een half regeltje om te draaien zonder dat er iets kapot lijkt te gaan.

   HET OCHTENDRITME staat er uitdrukkelijk zonder reeks. De kop van de module
   zegt waarom: "een ketting die je kunt breken is druk, en druk hoort niet bij
   een kinderochtend". Er wordt alleen zacht geteld hoeveel ochtenden er deze
   week rond waren, en een gemiste dag maakt niets stuk. Dat is dezelfde regel
   als in CLAUDE.md ("geen verslavende engagement-patronen"), alleen dan in
   code. Een reeksteller erbij bouwen is twee regels werk en voelt als een
   verbetering -- daarom hoort de afwezigheid ervan vast te liggen, en niet
   alleen in een commentaarregel die bij de volgende ronde meeverhuist.

   DE VERJAARDAGEN dragen een verrassings-slot: wie een wens reserveert
   voorkomt een dubbel cadeau, en de JARIGE ziet dat zelf niet. Hij ziet ook het
   cadeaupotje niet. Dat is de stilste faalvorm die er is: draai het om en de
   app blijft precies zo werken, alleen weet de jarige nu wat hij krijgt. Er
   komt geen foutmelding, geen rood scherm, niets -- alleen een verjaardag
   zonder verrassing.

   Draai los: node --test test/gezinleven.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinleven-'));
let child, BASE;

const post = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const haal = (pad, token) => fetch(BASE + '/api/foundation' + pad, {
  headers: { Authorization: 'Bearer ' + token }
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({
    env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health'
  }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Een gezin met een moeder (beheerder), een vader, twee kinderen en een oppas.
   Vijf mensen, want de verrassingsregel vraagt drie verschillende gezichtspunten
   tegelijk: de jarige, degene die reserveert, en iemand die alleen meekijkt. */
async function gezin(naam) {
  const g = (await post('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Moeder ' + naam, pin: '1234' })).body;
  assert.ok(g.code && g.token, 'het gezin bestaat: ' + JSON.stringify(g).slice(0, 160));
  const maak = async (pnaam, rol) => {
    const r = await post('/gezin/profiel/maak', { code: g.code, token: g.token, naam: pnaam, rol });
    assert.equal(r.status, 200, pnaam + ' is aangemaakt: ' + JSON.stringify(r.body).slice(0, 140));
    const kies = await post('/gezin/profiel/kies', { code: g.code, profielId: r.body.profiel.id });
    assert.ok(kies.body.token, pnaam + ' heeft een token');
    return { id: r.body.profiel.id, token: kies.body.token, naam: pnaam };
  };
  const mij = await haal('/gezin/' + g.code + '/ochtend', g.token);
  return {
    code: g.code,
    moeder: { id: mij.body.mijnId, token: g.token, naam: 'Moeder ' + naam },
    vader: await maak('Vader ' + naam, 'ouder'),
    kind: await maak('Kind ' + naam, 'kind'),
    zus: await maak('Zus ' + naam, 'kind'),
    oppas: await maak('Oppas ' + naam, 'gast')
  };
}

/* ============================================================================
   1 -- HET OCHTENDRITME: DE OUDER ZET KLAAR, HET KIND VINKT AF
   ========================================================================== */
test('het ochtendritme: een ouder zet het klaar, maar afvinken doet het kind zelf', async () => {
  const f = await gezin('Ochtend');

  /* ---- DE OUDER ZET HET RITME VAN HET KIND KLAAR. Dat is het hele punt: een
     kind van zes stelt zijn eigen lijstje niet samen. ---- */
  for (const stap of ['Tanden poetsen', 'Aankleden', 'Tas inpakken']) {
    const r = await post('/gezin/ochtend/stap', { code: f.code, token: f.moeder.token, voor: f.kind.id, tekst: stap });
    assert.equal(r.status, 200, 'de moeder zet "' + stap + '" klaar: ' + JSON.stringify(r.body).slice(0, 140));
  }

  /* Dezelfde stap twee keer levert geen dubbele regel op -- een ochtendlijstje
     met twee keer "tanden poetsen" is geen lijstje maar een fout. */
  await post('/gezin/ochtend/stap', { code: f.code, token: f.moeder.token, voor: f.kind.id, tekst: 'tanden poetsen' });
  const mijn = (await haal('/gezin/' + f.code + '/ochtend', f.kind.token)).body.mijn;
  assert.equal(mijn.stappen.length, 3, 'het ritme heeft drie stappen, niet vier: ' +
    JSON.stringify(mijn.stappen.map(s => s.tekst)));

  const leeg = await post('/gezin/ochtend/stap', { code: f.code, token: f.moeder.token, voor: f.kind.id, tekst: '  ' });
  assert.equal(leeg.status, 400, 'een lege stap kan niet');

  /* ---- EEN KIND ZET HET RITME VAN ZIJN OUDER NIET KLAAR. Zelfde grens als bij
     de gezondheidskaart, en die hoort overal in deze app hetzelfde te zijn. ---- */
  const andersom = await post('/gezin/ochtend/stap',
    { code: f.code, token: f.kind.token, voor: f.moeder.id, tekst: 'Koffie zetten' });
  assert.equal(andersom.status, 403, 'het kind zet niets klaar bij zijn moeder: ' +
    JSON.stringify(andersom.body).slice(0, 180));

  /* En het ene kind ook niet bij het andere -- broer en zus zijn geen ouders. */
  const bijZus = await post('/gezin/ochtend/stap',
    { code: f.code, token: f.kind.token, voor: f.zus.id, tekst: 'Kamer opruimen' });
  assert.equal(bijZus.status, 403, 'en niet bij zijn zus');

  /* Een gast heeft geen ochtendritme. */
  const bijOppas = await post('/gezin/ochtend/stap',
    { code: f.code, token: f.moeder.token, voor: f.oppas.id, tekst: 'Jas ophangen' });
  assert.equal(bijOppas.status, 400, 'een gast heeft geen ochtendritme: ' +
    JSON.stringify(bijOppas.body).slice(0, 160));
  const oppasZelf = await post('/gezin/ochtend/stap', { code: f.code, token: f.oppas.token, tekst: 'Iets' });
  assert.equal(oppasZelf.status, 403, 'en de oppas komt sowieso niet bij de prive-zaken');

  /* ---- AFVINKEN DOET HET KIND ZELF. De moeder kan wel klaarzetten, maar niet
     namens haar kind afvinken -- anders is het lijstje van haar en niet van hem,
     en dan werkt het als opvoedmiddel precies averechts. ---- */
  const stappen = (await haal('/gezin/' + f.code + '/ochtend', f.kind.token)).body.mijn.stappen;

  /* En ze kan er ook niet omheen door het kind AAN TE WIJZEN. Dit is de vorm
     waar het op aankomt: elke andere route in deze module kent een "voor", dus
     de aanname dat deze hem ook heeft is een kleine stap. Hij hoort hem niet te
     hebben -- vinken gaat altijd over je eigen lijstje, wat er ook in de body
     staat. */
  const metVoor = await post('/gezin/ochtend/vink',
    { code: f.code, token: f.moeder.token, voor: f.kind.id, stapId: stappen[0].id, aan: true });
  assert.equal(metVoor.status, 404, 'ook niet door haar kind aan te wijzen: ' +
    JSON.stringify(metVoor.body).slice(0, 160));

  const doorMoeder = await post('/gezin/ochtend/vink',
    { code: f.code, token: f.moeder.token, stapId: stappen[0].id, aan: true });
  assert.equal(doorMoeder.status, 404, 'de moeder vinkt niet af in het lijstje van haar kind: ' +
    JSON.stringify(doorMoeder.body).slice(0, 160));

  /* En het lijstje van het kind is ook echt onaangeroerd gebleven. Een 404 zegt
     alleen iets over het antwoord, niet over wat er onderweg is gebeurd. */
  const naPoging = (await haal('/gezin/' + f.code + '/ochtend', f.kind.token)).body.mijn;
  assert.deepEqual(naPoging.stappen.map(s => s.af), [false, false, false],
    'er staat nog niets afgevinkt bij het kind: ' + JSON.stringify(naPoging.stappen));

  const eerste = await post('/gezin/ochtend/vink', { code: f.code, token: f.kind.token, stapId: stappen[0].id, aan: true });
  assert.equal(eerste.status, 200, 'het kind vinkt zelf af: ' + JSON.stringify(eerste.body).slice(0, 160));
  assert.equal(eerste.body.klaar, false, 'nog niet alles is af');
  assert.equal(eerste.body.week, 0, 'en er is deze week nog geen ochtend rond');

  await post('/gezin/ochtend/vink', { code: f.code, token: f.kind.token, stapId: stappen[1].id, aan: true });
  const laatste = await post('/gezin/ochtend/vink', { code: f.code, token: f.kind.token, stapId: stappen[2].id, aan: true });
  assert.equal(laatste.body.klaar, true, 'nu is de ochtend rond');
  assert.equal(laatste.body.netKlaar, true, 'en dat is net gebeurd');
  assert.equal(laatste.body.week, 1, 'een ochtend deze week rond');
});

/* ============================================================================
   2 -- GEEN KETTING, GEEN RANGLIJST

   Dit is de toets die er is omdat de code een KEUZE maakt die je niet ziet:
   wat er NIET wordt bijgehouden.
   ========================================================================== */
test('het ochtendritme kent geen reeks en geen ranglijst -- af is af, en dat blijft zo', async () => {
  const f = await gezin('Zacht');
  for (const stap of ['Aankleden', 'Ontbijten']) {
    await post('/gezin/ochtend/stap', { code: f.code, token: f.kind.token, tekst: stap });
  }
  const stappen = (await haal('/gezin/' + f.code + '/ochtend', f.kind.token)).body.mijn.stappen;
  for (const s of stappen) await post('/gezin/ochtend/vink', { code: f.code, token: f.kind.token, stapId: s.id, aan: true });

  const rond = (await haal('/gezin/' + f.code + '/ochtend', f.kind.token)).body.mijn;
  assert.equal(rond.klaar, true, 'de ochtend is rond');
  assert.equal(rond.week, 1, 'en telt mee voor deze week');

  /* ---- "AF IS AF". Een stap weer uitvinken maakt de ochtend van vandaag niet
     ongedaan. Dat is bewust vergevingsgezind: wie per ongeluk iets aantikt,
     verliest zijn ochtend niet. Een strengere versie zou "correcter" lijken en
     precies de druk toevoegen die deze module wil vermijden. ---- */
  const uit = await post('/gezin/ochtend/vink', { code: f.code, token: f.kind.token, stapId: stappen[0].id, aan: false });
  assert.equal(uit.body.klaar, false, 'het lijstje is niet meer compleet');
  assert.equal(uit.body.week, 1, 'maar de ochtend van vandaag telt gewoon nog mee: ' + uit.body.week);

  /* ---- GEEN REEKS. Er wordt geteld over een VENSTER van zeven dagen, niet als
     ketting. Het verschil is precies het verschil tussen "vier van de zeven" en
     "je reeks is verbroken" -- en het eerste is wat dit huis belooft. ---- */
  const velden = Object.keys(rond).join(',');
  assert.ok(!/reeks|streak|record|langste/i.test(velden),
    'er is geen reeks-, record- of streak-teller: ' + velden);
  assert.ok(!/reeks|streak|record/i.test(JSON.stringify((await haal('/gezin/' + f.code + '/ochtend', f.kind.token)).body)),
    'ook niet ergens anders in het antwoord');

  /* ---- GEEN RANGLIJST. Het gezinsbord staat op NAAM, niet op wie het beste
     scoort. Op prestatie sorteren is een regel code en maakt van een bord om
     elkaar te zien een wedstrijd tussen broers en zussen. ---- */
  await post('/gezin/ochtend/stap', { code: f.code, token: f.zus.token, tekst: 'Haren doen' });
  const bord = (await haal('/gezin/' + f.code + '/ochtend', f.kind.token)).body.bord;
  assert.ok(bord.length >= 4, 'het bord toont het hele gezin: ' + JSON.stringify(bord.map(b => b.naam)));
  assert.ok(!bord.some(b => /Oppas/.test(b.naam)), 'behalve de oppas');
  const namen = bord.map(b => b.naam);
  assert.deepEqual(namen, namen.slice().sort((a, b) => a.localeCompare(b)),
    'en staat op naam, niet op prestatie: ' + namen.join(', '));

  /* Het bord toont wel hoe ver iemand is -- zien hoe het met elkaar gaat is iets
     anders dan een ranglijst. */
  const hetKind = bord.find(b => b.pid === f.kind.id);
  assert.equal(hetKind.totaal, 2, 'het kind heeft twee stappen');
  assert.equal(hetKind.gedaan, 1, 'waarvan er nu een af is');
  assert.equal(hetKind.heeftRitme, true, 'en het heeft een ritme');
  const deMoeder = bord.find(b => b.pid === f.moeder.id);
  assert.equal(deMoeder.heeftRitme, false, 'de moeder heeft er geen, en dat is geen tekortkoming');
});

/* ============================================================================
   3 -- DE VERRASSING: DE JARIGE ZIET HET NIET
   ========================================================================== */
test('verjaardagen: wie reserveert voorkomt een dubbel cadeau, en de jarige ziet er niets van', async () => {
  const f = await gezin('Feest');

  /* Het kind is de jarige, en is aan zijn profiel GEKOPPELD -- dat is wat de
     app in staat stelt om te weten dat hij niets mag zien. */
  const jarig = await post('/gezin/verjaardag/persoon',
    { code: f.code, token: f.moeder.token, naam: f.kind.naam, dag: 14, maand: 3, jaar: 2016, pid: f.kind.id });
  assert.equal(jarig.status, 200, 'het kind staat in het boek: ' + JSON.stringify(jarig.body).slice(0, 160));
  const kindId = jarig.body.persoon.id;

  const nogmaals = await post('/gezin/verjaardag/persoon',
    { code: f.code, token: f.moeder.token, naam: f.kind.naam, dag: 14, maand: 3, pid: f.kind.id });
  assert.equal(nogmaals.status, 400, 'een gezinslid staat maar een keer in het boek');

  const raar = await post('/gezin/verjaardag/persoon',
    { code: f.code, token: f.moeder.token, naam: 'Oom Ted', dag: 45, maand: 3 });
  assert.equal(raar.status, 400, 'en 45 maart bestaat niet');

  /* Twee wensen. De moeder zet ze erop; wie ze erop zet doet er niet toe. */
  for (const wens of ['Een echte voetbal', 'Een boek over ruimtevaart']) {
    const r = await post('/gezin/verjaardag/wens', { code: f.code, token: f.moeder.token, voorId: kindId, tekst: wens });
    assert.equal(r.status, 200, 'de wens "' + wens + '" staat erop');
  }
  assert.equal((await post('/gezin/verjaardag/wens',
    { code: f.code, token: f.moeder.token, voorId: 'bestaat-niet', tekst: 'x' })).status, 404,
    'een wens voor niemand kan niet');

  /* ---- DE VADER RESERVEERT DE VOETBAL. ---- */
  const alsVader = (await haal('/gezin/' + f.code + '/verjaardagen', f.vader.token)).body;
  const wensen = alsVader.mensen.find(m => m.id === kindId).wensen;
  const bal = wensen.find(w => /voetbal/i.test(w.tekst));
  assert.equal(bal.geclaimd, false, 'de voetbal is nog vrij');

  assert.equal((await post('/gezin/verjaardag/wens/claim',
    { code: f.code, token: f.vader.token, wensId: bal.id })).status, 200, 'de vader reserveert de voetbal');

  /* ---- DE ZUS ZIET DAT HIJ VERGEVEN IS, EN DOOR WIE. Dat is de hele functie:
     geen dubbele cadeaus. ---- */
  const alsZus = (await haal('/gezin/' + f.code + '/verjaardagen', f.zus.token)).body
    .mensen.find(m => m.id === kindId);
  const balZus = alsZus.wensen.find(w => w.id === bal.id);
  assert.equal(balZus.geclaimd, true, 'de zus ziet dat de voetbal vergeven is');
  assert.equal(balZus.claimerNaam, f.vader.naam, 'en door wie: ' + balZus.claimerNaam);
  assert.equal(balZus.doorMijGeclaimd, false, 'niet door haar');

  const dubbel = await post('/gezin/verjaardag/wens/claim', { code: f.code, token: f.zus.token, wensId: bal.id });
  assert.equal(dubbel.status, 400, 'en ze kan hem niet ook reserveren: ' +
    JSON.stringify(dubbel.body).slice(0, 160));

  /* ---- EN NU DE KERN: DE JARIGE ZELF ZIET NIETS. ---- */
  const alsJarige = (await haal('/gezin/' + f.code + '/verjaardagen', f.kind.token)).body
    .mensen.find(m => m.id === kindId);
  assert.equal(alsJarige.benIkDeJarige, true, 'het kind herkent zichzelf als de jarige');
  const balJarige = alsJarige.wensen.find(w => w.id === bal.id);
  assert.equal(balJarige.geclaimd, false, 'hij ziet NIET dat de voetbal al gereserveerd is');
  assert.equal(balJarige.claimerNaam, '', 'en al helemaal niet door wie: "' + balJarige.claimerNaam + '"');
  assert.equal(balJarige.doorMijGeclaimd, false, 'en niets wijst erop dat er iets loopt');
  assert.equal(alsJarige.wensen.length, 2, 'zijn wensenlijst ziet hij gewoon: ' + alsJarige.wensen.length);

  /* Hij kan zijn eigen wens ook niet reserveren -- dat zou de verrassing langs
     de achterdeur alsnog verraden ("hij was al vergeven"). */
  const eigenClaim = await post('/gezin/verjaardag/wens/claim',
    { code: f.code, token: f.kind.token, wensId: alsJarige.wensen.find(w => /ruimtevaart/i.test(w.tekst)).id });
  assert.equal(eigenClaim.status, 403, 'je reserveert je eigen wensen niet: ' +
    JSON.stringify(eigenClaim.body).slice(0, 160));

  /* ---- TERUGGEVEN kan, maar alleen door wie het reserveerde. ---- */
  assert.equal((await post('/gezin/verjaardag/wens/claim',
    { code: f.code, token: f.zus.token, wensId: bal.id, claim: false })).status, 200,
    'de zus mag ontclaimen aanroepen');
  const naZus = (await haal('/gezin/' + f.code + '/verjaardagen', f.vader.token)).body
    .mensen.find(m => m.id === kindId).wensen.find(w => w.id === bal.id);
  assert.equal(naZus.doorMijGeclaimd, true,
    'maar de reservering van de vader staat er nog -- je geeft niet terug wat niet van jou is');

  assert.equal((await post('/gezin/verjaardag/wens/claim',
    { code: f.code, token: f.vader.token, wensId: bal.id, claim: false })).status, 200,
    'de vader geeft hem wel terug');
  assert.equal((await haal('/gezin/' + f.code + '/verjaardagen', f.zus.token)).body
    .mensen.find(m => m.id === kindId).wensen.find(w => w.id === bal.id).geclaimd, false,
    'en dan is de voetbal weer vrij');
});

/* ============================================================================
   4 -- HET CADEAUPOTJE
   ========================================================================== */
test('het cadeaupotje: het gezin legt in, en de jarige ziet het potje niet', async () => {
  const f = await gezin('Potje');
  const jarig = (await post('/gezin/verjaardag/persoon',
    { code: f.code, token: f.moeder.token, naam: f.kind.naam, dag: 2, maand: 9, jaar: 2014, pid: f.kind.id })).body.persoon.id;

  assert.equal((await post('/gezin/verjaardag/potje/doel',
    { code: f.code, token: f.moeder.token, persoonId: jarig, doel: 120 })).status, 200, 'er is een doel van 120');

  assert.equal((await post('/gezin/verjaardag/potje/bijdrage',
    { code: f.code, token: f.moeder.token, persoonId: jarig, bedrag: 50 })).status, 200, 'de moeder legt 50 in');
  assert.equal((await post('/gezin/verjaardag/potje/bijdrage',
    { code: f.code, token: f.vader.token, persoonId: jarig, bedrag: 30 })).status, 200, 'de vader 30');
  assert.equal((await post('/gezin/verjaardag/potje/bijdrage',
    { code: f.code, token: f.zus.token, persoonId: jarig, bedrag: 7.5 })).status, 200, 'en de zus 7,50 uit haar zakgeld');

  const nul = await post('/gezin/verjaardag/potje/bijdrage',
    { code: f.code, token: f.zus.token, persoonId: jarig, bedrag: 0 });
  assert.equal(nul.status, 400, 'nul euro inleggen is geen bijdrage');
  const negatief = await post('/gezin/verjaardag/potje/bijdrage',
    { code: f.code, token: f.zus.token, persoonId: jarig, bedrag: -20 });
  assert.equal(negatief.status, 400, 'en een negatief bedrag haalt niets uit het potje');

  /* ---- HET POTJE TELT OP, EN IEDEREEN ZIET ZIJN EIGEN INLEG. ---- */
  const alsVader = (await haal('/gezin/' + f.code + '/verjaardagen', f.vader.token)).body
    .mensen.find(m => m.id === jarig);
  assert.equal(alsVader.pot.totaal, 87.5, 'er zit 87,50 in het potje: ' + alsVader.pot.totaal);
  assert.equal(alsVader.pot.aantal, 3, 'van drie mensen');
  assert.equal(alsVader.pot.doel, 120, 'op weg naar 120');
  assert.equal(alsVader.pot.mijnInleg, 30, 'en de vader ziet zijn eigen 30 terug');

  const alsZus = (await haal('/gezin/' + f.code + '/verjaardagen', f.zus.token)).body
    .mensen.find(m => m.id === jarig);
  assert.equal(alsZus.pot.totaal, 87.5, 'de zus ziet hetzelfde totaal');
  assert.equal(alsZus.pot.mijnInleg, 7.5, 'maar haar eigen inleg is 7,50: ' + alsZus.pot.mijnInleg);

  /* ---- EN DE JARIGE ZIET HET POTJE HELEMAAL NIET. Niet het bedrag, niet het
     doel, niet dat er uberhaupt een potje IS -- want alleen al weten dat er
     tachtig euro klaarligt verraadt het cadeau. ---- */
  const alsJarige = (await haal('/gezin/' + f.code + '/verjaardagen', f.kind.token)).body
    .mensen.find(m => m.id === jarig);
  assert.equal(alsJarige.pot, null, 'de jarige krijgt geen potje te zien: ' + JSON.stringify(alsJarige.pot));

  /* ---- DE PERSOON WEGHALEN NEEMT ZIJN WENSEN EN ZIJN POTJE MEE. Bleef het
     potje staan, dan hangt er geld in de app aan niemand. ---- */
  await post('/gezin/verjaardag/wens', { code: f.code, token: f.moeder.token, voorId: jarig, tekst: 'Een step' });
  const doorZus = await post('/gezin/verjaardag/persoon/verwijder',
    { code: f.code, token: f.zus.token, persoonId: jarig });
  assert.equal(doorZus.status, 403, 'de zus haalt niet weg wat een ander toevoegde: ' +
    JSON.stringify(doorZus.body).slice(0, 180));

  assert.equal((await post('/gezin/verjaardag/persoon/verwijder',
    { code: f.code, token: f.moeder.token, persoonId: jarig })).status, 200, 'de moeder wel');
  const na = (await haal('/gezin/' + f.code + '/verjaardagen', f.vader.token)).body;
  assert.equal(na.mensen.filter(m => m.id === jarig).length, 0, 'de persoon is weg');
  assert.ok(na.koppelbaar.some(k => k.pid === f.kind.id),
    'en het kind staat weer op de lijst om toe te voegen: ' + JSON.stringify(na.koppelbaar.map(k => k.naam)));

  /* Opnieuw toevoegen begint met een leeg potje -- anders erft een nieuwe
     verjaardag stilzwijgend het geld van de vorige. */
  const opnieuw = (await post('/gezin/verjaardag/persoon',
    { code: f.code, token: f.moeder.token, naam: f.kind.naam, dag: 2, maand: 9, pid: f.kind.id })).body.persoon.id;
  const vers = (await haal('/gezin/' + f.code + '/verjaardagen', f.vader.token)).body
    .mensen.find(m => m.id === opnieuw);
  assert.equal(vers.pot.totaal, 0, 'het potje begint op nul: ' + JSON.stringify(vers.pot));
  assert.equal(vers.wensen.length, 0, 'en de wensenlijst is leeg');
});
