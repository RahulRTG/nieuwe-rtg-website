/* ============================================================================
   HET HUISHOUDEN: DE KEUKEN, HET SPAARPOT EN HET DROMENBORD.

   WAT DEZE DRIE BINDT: ze zijn allemaal GEDEELD. Geen van drieen heeft een
   eigenaar per regel -- het weekmenu is van het gezin, de boodschappenlijst is
   van het gezin, en het spaardoel ook. Dat maakt de interessante vragen hier
   andere dan elders in deze app: niet "wie mag erbij" maar "wat gebeurt er als
   twee mensen tegelijk hetzelfde doen".

   Drie dingen die daardoor stil fout kunnen gaan:

   1. DUBBELE REGELS. Twee ouders die allebei "melk" op de lijst zetten hoort
      een keer melk op te leveren. Een boodschappenlijst met drie keer melk is
      niet fout in de zin dat er iets crasht -- hij is alleen onbruikbaar, en
      dat merk je pas in de winkel.

   2. EEN TELLER DIE DE VERKEERDE KANT OP KAN. Bij een spaardoel mag een
      bijdrage negatief zijn (je haalt iets terug), maar de pot mag nooit onder
      nul zakken. Anders spaart een gezin zich in de schulden op een scherm dat
      voor kinderen bedoeld is.

   3. WIE MAG ER AFVINKEN OF WEGGOOIEN. Bij het dromenbord is dat scherp: een
      droom is van EEN persoon, en een ander mag hem niet behaald verklaren of
      weghalen. Iemands droom afvinken die hij zelf nog niet af vindt, is precies
      het soort kleinigheid dat een gedeeld bord onveilig maakt.

   Draai los: node --test test/gezinhuishouden.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-huishouden-'));
let child, BASE;

const post = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const haal = (pad, token) => fetch(BASE + '/api/foundation' + pad, {
  headers: { Authorization: 'Bearer ' + token }
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  ({ child, base: BASE } = await startServer({
    env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health'
  }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function gezin(naam) {
  const g = (await post('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Moeder ' + naam, pin: '1234' })).body;
  assert.ok(g.code && g.token, 'het gezin bestaat: ' + JSON.stringify(g).slice(0, 160));
  const maak = async (pnaam, rol) => {
    const r = await post('/gezin/profiel/maak', { code: g.code, token: g.token, naam: pnaam, rol });
    assert.equal(r.status, 200, pnaam + ' is aangemaakt');
    const kies = await post('/gezin/profiel/kies', { code: g.code, profielId: r.body.profiel.id });
    return { id: r.body.profiel.id, token: kies.body.token, naam: pnaam };
  };
  const mij = await haal('/gezin/' + g.code + '/keuken', g.token);
  return {
    code: g.code,
    moeder: { id: mij.body.mijnId, token: g.token, naam: 'Moeder ' + naam },
    vader: await maak('Vader ' + naam, 'ouder'),
    kind: await maak('Kind ' + naam, 'kind'),
    oppas: await maak('Oppas ' + naam, 'gast')
  };
}

/* ============================================================================
   1 -- DE KEUKEN: EEN GEDEELDE LIJST DIE NIET DUBBEL LOOPT
   ========================================================================== */
test('de keuken: twee mensen zetten hetzelfde op de lijst en er staat een keer melk', async () => {
  const f = await gezin('Keuken');

  /* ---- HET WEEKMENU. Zeven dagen vooruit, vandaag voorop. ---- */
  const zonderDatum = await post('/gezin/keuken/menu', { code: f.code, token: f.moeder.token, gerecht: 'Pasta' });
  assert.equal(zonderDatum.status, 400, 'een gerecht zonder dag hangt nergens aan');
  const zonderGerecht = await post('/gezin/keuken/menu', { code: f.code, token: f.moeder.token, datum: dag(1) });
  assert.equal(zonderGerecht.status, 400, 'en een dag zonder gerecht zegt niets');

  assert.equal((await post('/gezin/keuken/menu',
    { code: f.code, token: f.moeder.token, datum: dag(1), gerecht: 'Andijviestamppot', kok: f.vader.id })).status,
    200, 'morgen eten we stamppot, de vader kookt');

  const k = (await haal('/gezin/' + f.code + '/keuken', f.kind.token)).body;
  assert.equal(k.dagen.length, 7, 'de week toont zeven dagen');
  assert.equal(k.dagen[0].vandaag, true, 'vandaag staat voorop');
  const morgen = k.dagen.find(d => d.datum === dag(1));
  assert.equal(morgen.gerecht, 'Andijviestamppot', 'met het gerecht erbij');
  assert.equal(morgen.kokNaam, f.vader.naam, 'en de naam van de kok, niet alleen zijn nummer');

  /* Een kok die geen gezinslid is wordt genegeerd -- anders staat er een naam
     op het menu die niemand kent. */
  await post('/gezin/keuken/menu', { code: f.code, token: f.moeder.token, datum: dag(2), gerecht: 'Nasi', kok: 'bestaat-niet' });
  const overmorgen = (await haal('/gezin/' + f.code + '/keuken', f.kind.token)).body.dagen.find(d => d.datum === dag(2));
  assert.equal(overmorgen.gerecht, 'Nasi', 'het gerecht staat er');
  assert.equal(overmorgen.kok, '', 'maar er is geen verzonnen kok: "' + overmorgen.kok + '"');

  /* ---- DE GEDEELDE BOODSCHAPPENLIJST. Hier zit de echte vraag: twee mensen,
     hetzelfde product. ---- */
  assert.equal((await post('/gezin/keuken/lijst', { code: f.code, token: f.moeder.token, wat: 'Melk' })).status, 200,
    'de moeder zet melk op de lijst');
  assert.equal((await post('/gezin/keuken/lijst', { code: f.code, token: f.vader.token, wat: 'melk' })).status, 200,
    'de vader denkt daar ook aan');
  assert.equal((await post('/gezin/keuken/lijst', { code: f.code, token: f.kind.token, wat: 'Koekjes' })).status, 200,
    'en het kind zet er koekjes bij');

  const lijst = (await haal('/gezin/' + f.code + '/keuken', f.moeder.token)).body.lijst;
  assert.equal(lijst.filter(x => /melk/i.test(x.wat)).length, 1,
    'er staat een keer melk op, niet twee keer: ' + JSON.stringify(lijst.map(x => x.wat)));
  assert.equal(lijst.length, 2, 'de lijst telt twee dingen');
  assert.equal(lijst.find(x => /koekjes/i.test(x.wat)).door, f.kind.naam,
    'en er staat bij wie het erop zette');

  /* ---- AFVINKEN. Iedereen mag alles afvinken -- het is een gedeelde lijst, en
     wie in de winkel staat pakt wat er ligt. ---- */
  const melk = lijst.find(x => /melk/i.test(x.wat));
  assert.equal((await post('/gezin/keuken/lijst/af',
    { code: f.code, token: f.kind.token, itemId: melk.id, af: true })).status, 200,
    'het kind vinkt de melk af, ook al zette de moeder hem erop');
  const naAf = (await haal('/gezin/' + f.code + '/keuken', f.moeder.token)).body.lijst;
  assert.equal(naAf.find(x => x.id === melk.id).af, true, 'de melk is af');
  assert.equal(naAf[naAf.length - 1].id, melk.id, 'en afgevinkte spullen zakken naar onderen');

  /* Zolang de melk afgevinkt op de lijst staat, is een nieuwe melk WEL welkom --
     dat is precies wat je wilt: vorige week gehaald, deze week weer nodig. */
  assert.equal((await post('/gezin/keuken/lijst', { code: f.code, token: f.moeder.token, wat: 'Melk' })).status, 200,
    'volgende week weer melk');
  const opnieuw = (await haal('/gezin/' + f.code + '/keuken', f.moeder.token)).body.lijst;
  assert.equal(opnieuw.filter(x => /melk/i.test(x.wat)).length, 2,
    'nu staat er een afgevinkte en een nieuwe: ' + JSON.stringify(opnieuw.filter(x => /melk/i.test(x.wat))));

  assert.equal((await post('/gezin/keuken/lijst/af',
    { code: f.code, token: f.kind.token, itemId: 'bestaat-niet', af: true })).status, 404,
    'iets afvinken dat er niet staat kan niet');

  /* ---- OPRUIMEN haalt alleen het afgevinkte weg. ---- */
  assert.equal((await post('/gezin/keuken/lijst/opruim', { code: f.code, token: f.moeder.token })).status, 200,
    'de lijst wordt opgeruimd');
  const naOpruim = (await haal('/gezin/' + f.code + '/keuken', f.moeder.token)).body.lijst;
  assert.ok(naOpruim.every(x => !x.af), 'er staat niets afgevinkts meer op');
  assert.equal(naOpruim.length, 2, 'en de twee open dingen staan er nog: ' +
    JSON.stringify(naOpruim.map(x => x.wat)));

  /* ---- VASTE BOODSCHAPPEN, ook zonder dubbelingen. ---- */
  await post('/gezin/keuken/vast', { code: f.code, token: f.moeder.token, wat: 'Brood' });
  await post('/gezin/keuken/vast', { code: f.code, token: f.vader.token, wat: 'brood' });
  const vast = (await haal('/gezin/' + f.code + '/keuken', f.moeder.token)).body.vast;
  assert.equal(vast.length, 1, 'brood staat er een keer bij: ' + JSON.stringify(vast));

  /* ---- DE VERRAS-ME-KNOP werkt zonder AI-sleutel, en stelt niet voor wat al
     op het menu staat. ---- */
  const idee = await post('/gezin/keuken/idee', { code: f.code, token: f.moeder.token });
  assert.equal(idee.status, 200, 'er is altijd een idee: ' + JSON.stringify(idee.body).slice(0, 140));
  assert.ok(idee.body.idee && idee.body.idee.length > 3, 'en het is een echt gerecht: ' + idee.body.idee);
  assert.notEqual(idee.body.idee, 'Andijviestamppot', 'niet iets dat deze week al op het menu staat');

  /* ---- EN DE OPPAS KOMT ER NIET BIJ. Het huishouden is prive; de noodnummers
     en de locaties waren dat juist niet. ---- */
  assert.equal((await haal('/gezin/' + f.code + '/keuken', f.oppas.token)).status, 403,
    'de oppas ziet het weekmenu niet');
  assert.equal((await post('/gezin/keuken/lijst', { code: f.code, token: f.oppas.token, wat: 'Iets' })).status, 403,
    'en zet niets op de lijst');
});

/* ============================================================================
   2 -- HET SPAARDOEL: DE POT ZAKT NOOIT ONDER NUL
   ========================================================================== */
test('het spaardoel: het gezin spaart samen, en de pot gaat nooit onder nul', async () => {
  const f = await gezin('Sparen');

  assert.equal((await post('/gezin/spaardoel/maak', { code: f.code, token: f.moeder.token, doel: 300 })).status, 400,
    'een doel zonder naam kan niet');
  assert.equal((await post('/gezin/spaardoel/maak', { code: f.code, token: f.moeder.token, naam: 'Tent' })).status, 400,
    'en een doel zonder bedrag ook niet');
  assert.equal((await post('/gezin/spaardoel/maak',
    { code: f.code, token: f.moeder.token, naam: 'Tent', doel: -50 })).status, 400,
    'naar een negatief bedrag spaar je niet');

  const gemaakt = await post('/gezin/spaardoel/maak',
    { code: f.code, token: f.moeder.token, naam: 'Tent voor de zomer', doel: 300 });
  assert.equal(gemaakt.status, 200, 'het doel staat er: ' + JSON.stringify(gemaakt.body).slice(0, 160));
  const id = gemaakt.body.doel.id;
  assert.equal(gemaakt.body.doel.nu, 0, 'en begint op nul');
  assert.equal(gemaakt.body.doel.klaar, false, 'nog niet gehaald');

  /* ---- IEDEREEN LEGT IN, ook het kind. Dat is het hele idee: samen. ---- */
  assert.equal((await post('/gezin/spaardoel/bijdrage',
    { code: f.code, token: f.vader.token, doelId: id, bedrag: 100 })).body.doel.nu, 100, 'de vader legt 100 in');
  const vanKind = await post('/gezin/spaardoel/bijdrage',
    { code: f.code, token: f.kind.token, doelId: id, bedrag: 12.5 });
  assert.equal(vanKind.body.doel.nu, 112.5, 'het kind 12,50 uit zijn zakgeld: ' + vanKind.body.doel.nu);
  assert.equal(vanKind.body.gevierd, false, 'er valt nog niets te vieren');

  const bijdragen = vanKind.body.doel.bijdragen;
  assert.equal(bijdragen[0].vanNaam, f.kind.naam, 'de nieuwste bijdrage staat bovenaan, met naam');

  /* ---- TERUGHALEN MAG (een bijdrage kan negatief), MAAR DE POT ZAKT NIET ONDER
     NUL. Dat is de grens die telt: dit scherm is voor kinderen, en een spaarpot
     met een negatief saldo leert precies het verkeerde. ---- */
  const terug = await post('/gezin/spaardoel/bijdrage',
    { code: f.code, token: f.vader.token, doelId: id, bedrag: -50 });
  assert.equal(terug.body.doel.nu, 62.5, 'vijftig eruit halen kan: ' + terug.body.doel.nu);

  const teveel = await post('/gezin/spaardoel/bijdrage',
    { code: f.code, token: f.vader.token, doelId: id, bedrag: -1000 });
  assert.equal(teveel.body.doel.nu, 0, 'meer eruit halen dan erin zit laat de pot op nul staan, niet negatief: ' +
    teveel.body.doel.nu);

  assert.equal((await post('/gezin/spaardoel/bijdrage',
    { code: f.code, token: f.vader.token, doelId: id, bedrag: 0 })).status, 400,
    'nul inleggen is geen bijdrage');
  assert.equal((await post('/gezin/spaardoel/bijdrage',
    { code: f.code, token: f.vader.token, doelId: 'bestaat-niet', bedrag: 10 })).status, 404,
    'en inleggen in een doel dat niet bestaat kan niet');

  /* ---- HET DOEL HALEN wordt EEN KEER gevierd. Elke bijdrage daarna opnieuw
     feest maken is precies het soort holle beloning dat dit huis niet doet. ---- */
  const haalt = await post('/gezin/spaardoel/bijdrage',
    { code: f.code, token: f.moeder.token, doelId: id, bedrag: 300 });
  assert.equal(haalt.body.doel.klaar, true, 'het doel is gehaald');
  assert.equal(haalt.body.gevierd, true, 'en dat wordt gevierd');

  const daarna = await post('/gezin/spaardoel/bijdrage',
    { code: f.code, token: f.moeder.token, doelId: id, bedrag: 20 });
  assert.equal(daarna.body.doel.klaar, true, 'het doel blijft gehaald');
  assert.equal(daarna.body.gevierd, false, 'maar er wordt niet nog een keer gevierd');

  /* ---- WEGGOOIEN doet alleen de beheerder. Een gedeelde pot waar iedereen de
     stekker uit kan trekken is geen gedeelde pot. ---- */
  const doorVader = await post('/gezin/spaardoel/verwijder', { code: f.code, token: f.vader.token, doelId: id });
  assert.equal(doorVader.status, 403, 'zelfs de andere ouder gooit het doel niet weg: ' +
    JSON.stringify(doorVader.body).slice(0, 180));
  const doorKind = await post('/gezin/spaardoel/verwijder', { code: f.code, token: f.kind.token, doelId: id });
  assert.equal(doorKind.status, 403, 'het kind al helemaal niet');

  assert.equal((await haal('/gezin/' + f.code + '/spaardoelen', f.kind.token)).body.spaardoelen.length, 1,
    'het doel staat er dus nog');
  assert.equal((await post('/gezin/spaardoel/verwijder',
    { code: f.code, token: f.moeder.token, doelId: id })).status, 200, 'de beheerder wel');
  assert.equal((await haal('/gezin/' + f.code + '/spaardoelen', f.kind.token)).body.spaardoelen.length, 0,
    'en dan is hij weg');
});

/* ============================================================================
   3 -- HET DROMENBORD: EEN DROOM IS VAN EEN PERSOON
   ========================================================================== */
test('het dromenbord: aanmoedigen doet iedereen, maar afvinken doe je zelf', async () => {
  const f = await gezin('Dromen');

  assert.equal((await post('/gezin/droom/maak', { code: f.code, token: f.kind.token, tekst: '  ' })).status, 400,
    'een lege droom is geen droom');

  const droom = await post('/gezin/droom/maak',
    { code: f.code, token: f.kind.token, tekst: 'Ik wil leren duiken deze zomer' });
  assert.equal(droom.status, 200, 'het kind zet zijn droom op het bord: ' + JSON.stringify(droom.body).slice(0, 160));
  const id = droom.body.droom.id;

  /* ---- AANMOEDIGEN DOET IEDEREEN, en het is een schakelaar: nog eens tikken
     haalt hem weer weg. Zonder die tweede tak kun je een aanmoediging niet
     terugnemen en telt de teller alleen maar op. ---- */
  const eerste = await post('/gezin/droom/moedig', { code: f.code, token: f.moeder.token, droomId: id });
  assert.equal(eerste.body.aantal, 1, 'de moeder moedigt aan');
  assert.equal(eerste.body.aangemoedigd, true, 'en dat staat aan');

  const tweede = await post('/gezin/droom/moedig', { code: f.code, token: f.vader.token, droomId: id });
  assert.equal(tweede.body.aantal, 2, 'de vader ook');

  const nogmaals = await post('/gezin/droom/moedig', { code: f.code, token: f.moeder.token, droomId: id });
  assert.equal(nogmaals.body.aantal, 1, 'de moeder tikt nog eens en neemt hem terug: ' + nogmaals.body.aantal);
  assert.equal(nogmaals.body.aangemoedigd, false, 'en dat staat nu uit');

  const bord = (await haal('/gezin/' + f.code + '/dromen', f.vader.token)).body.dromen.find(d => d.id === id);
  assert.equal(bord.aantal, 1, 'het bord telt een aanmoediging');
  assert.equal(bord.aangemoedigd, true, 'de vader ziet dat hij zelf heeft aangemoedigd');
  assert.equal(bord.vanMij, false, 'en dat het niet zijn droom is');
  assert.equal(bord.vanNaam, f.kind.naam, 'maar wel van wie: ' + bord.vanNaam);

  /* ---- AFVINKEN DOE JE ZELF. Iemands droom behaald verklaren die hij zelf nog
     niet af vindt, is precies de kleinigheid die een gedeeld bord onveilig
     maakt. De beheerder mag het wel -- die moet een bord kunnen opruimen. ---- */
  const doorVader = await post('/gezin/droom/behaald', { code: f.code, token: f.vader.token, droomId: id });
  assert.equal(doorVader.status, 403, 'de vader verklaart de droom van zijn kind niet behaald: ' +
    JSON.stringify(doorVader.body).slice(0, 180));

  const doorKind = await post('/gezin/droom/behaald', { code: f.code, token: f.kind.token, droomId: id });
  assert.equal(doorKind.status, 200, 'het kind zelf wel');
  assert.equal(doorKind.body.droom.behaald, true, 'en dan staat hij behaald');
  assert.ok(doorKind.body.droom.behaaldAt, 'met een moment erbij');

  /* Terugdraaien kan ook -- een droom "af" verklaren is geen eenrichtingsverkeer. */
  const terug = await post('/gezin/droom/behaald', { code: f.code, token: f.kind.token, droomId: id, behaald: false });
  assert.equal(terug.body.droom.behaald, false, 'toch nog niet');
  assert.equal(terug.body.droom.behaaldAt, null, 'en het moment is weg');

  /* ---- WEGGOOIEN, zelfde regel. ---- */
  const wegDoorVader = await post('/gezin/droom/verwijder', { code: f.code, token: f.vader.token, droomId: id });
  assert.equal(wegDoorVader.status, 403, 'de vader haalt de droom van zijn kind niet weg');
  assert.equal((await haal('/gezin/' + f.code + '/dromen', f.kind.token)).body.dromen.length, 1,
    'de droom staat er dus nog');

  assert.equal((await post('/gezin/droom/verwijder',
    { code: f.code, token: f.moeder.token, droomId: id })).status, 200,
    'de beheerder kan het bord wel opruimen');
  assert.equal((await haal('/gezin/' + f.code + '/dromen', f.kind.token)).body.dromen.length, 0,
    'en dan is de droom weg');
});
