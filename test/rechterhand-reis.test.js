/* ============================================================================
   DE RECHTERHAND: EEN REIS VOORBEREIDEN.

   WAAROM DIT BESTAAN MOEST, TERWIJL DE DEKKING AL 100% WAS

   De waargenomen dekking (scripts/dekking.js) staat op 100%: elke route van De
   Rechterhand wordt tijdens de suite aangeraakt. Maar "aangeraakt" en
   "getoetst" is niet hetzelfde, en het verschil zit precies waar deze apps hun
   waarde hebben: in de AFGELEIDE getallen.

   Een fles heeft geen veld "op dronk" -- dat wordt uitgerekend uit twee
   jaartallen. Vlieguren staan nergens opgeteld. Het aantal gastpassen loopt
   terug bij gebruik en weer op bij een correctie. Een verlopend paspoort wordt
   niet ingevuld maar afgeleid uit een datum en een venster van 90 dagen.

   Dat is de klasse fouten die stil is: de route antwoordt 200, het veld staat
   er, en het GETAL klopt niet. Een omgekeerde vergelijking in venster() zet uw
   hele kelder op "laten liggen" en niemand ziet het, want er is geen foutmelding
   -- er is alleen een kelder waar u niets uit schenkt.

   HET VERHAAL

   Een lid met een Lifestyle Pass bereidt een reis naar Milaan voor. Dat is geen
   omlijsting maar de reden dat deze vier apps in EEN bestand staan: ze hangen in
   het echt aan elkaar. Het reisboek weet dat er een visum verloopt, de entourage
   weet wiens paspoort niet meer geldig is, de cercle weet waar hij in Milaan
   terechtkan en de hangar weet waar zijn toestel staat.

   Draai los: node --test test/rechterhand-reis.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, elevateTier } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rh-reis-'));
let srv, base, lid, office;

const raw = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const rh = (pad, body) => raw('member/rechterhand/' + pad, body, lid);

/* Datums ten opzichte van vandaag. Vaste datums in een toets zijn een tijdbom:
   die van vorig jaar "verlopen" en de toets wordt groen om de verkeerde reden. */
const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const jaar = new Date().getFullYear();

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-REIS' } });
  base = srv.base;
  office = (await raw('office/login', { code: 'KANTOOR-REIS' })).body.token;
  const u = Date.now().toString().slice(-9);
  const r = await raw('auth/register', { name: 'Reiziger', email: 'rr' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1978-03-11', tier: 'rtg' });
  assert.ok(r.body.token, 'het lid is geregistreerd');
  await elevateTier(base, r.body.token, 'lifestyle', office);
  lid = r.body.token;
  assert.equal((await rh('cellier', {})).status, 200, 'en draagt de Lifestyle Pass');
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ============================================================================
   1 -- HET REISBOEK SEINT WAT ER VERLOOPT

   Een reisdossier dat alleen bewaart wat u intikt is een tekstverwerker. De
   belofte is dat het MEEKIJKT: welk document verloopt voor of tijdens de reis.
   ========================================================================== */
test('het reisboek seint het document dat verloopt, en zwijgt over het document dat goed is', async () => {
  const gemaakt = await rh('reis/zet', { naam: 'Milaan in het najaar', bestemming: 'Milaan',
    van: dag(40), tot: dag(47), notitie: 'Salone en twee diners.' });
  assert.equal(gemaakt.status, 200, 'de reis staat in het boek: ' + JSON.stringify(gemaakt.body).slice(0, 160));
  const reisId = gemaakt.body.reis.id;

  /* Het draaiboek: een heenreis, een verblijf, twee documenten en een programma.
     Het ene document verloopt binnen het venster van 90 dagen, het andere pas
     over ruim een jaar -- en dat verschil is de hele bewering. */
  const leg = await rh('reis/item', { reisId, lijst: 'legs', van: 'Amsterdam', naar: 'Milaan',
    vervoer: 'eigen toestel', datum: dag(40), tijd: '09:30' });
  assert.equal(leg.status, 200, 'de heenreis staat erin');

  assert.equal((await rh('reis/item', { reisId, lijst: 'verblijven', naam: 'Appartement Brera',
    plaats: 'Milaan', in: dag(40), uit: dag(47) })).status, 200, 'het verblijf staat erin');

  assert.equal((await rh('reis/item', { reisId, lijst: 'documenten', soort: 'visum',
    houder: 'Reiziger', geldigTot: dag(30) })).status, 200, 'het visum staat erin');
  assert.equal((await rh('reis/item', { reisId, lijst: 'documenten', soort: 'paspoort',
    houder: 'Reiziger', geldigTot: dag(500) })).status, 200, 'het paspoort ook');

  assert.equal((await rh('reis/item', { reisId, lijst: 'programma',
    datum: dag(41), tekst: 'Salone del Mobile, ochtend' })).status, 200, 'en het programma');

  const boek = (await rh('reisboek', {})).body;
  const reis = boek.reizen.find(r => r.id === reisId);
  assert.ok(reis, 'de reis staat in het overzicht');
  assert.equal(reis.komend, true, 'en is aangemerkt als komend, want hij begint in de toekomst');
  assert.equal(reis.legs.length, 1, 'met een leg');
  assert.equal(reis.verblijven.length, 1, 'een verblijf');
  assert.equal(reis.programma.length, 1, 'en een programmapunt');

  /* DE KERN: precies EEN attentie. Twee zou betekenen dat het venster niet
     werkt; nul dat er helemaal niet gekeken wordt. */
  const vanDezeReis = boek.attenties.filter(a => a.reis === 'Milaan in het najaar');
  assert.equal(vanDezeReis.length, 1,
    'alleen het visum vraagt aandacht, het paspoort niet: ' + JSON.stringify(boek.attenties));
  assert.equal(vanDezeReis[0].soort, 'visum', 'en het is het visum');
  assert.equal(vanDezeReis[0].verlopen, false, 'dat nog niet verlopen is, maar wel binnen het venster valt');

  /* Een onbekend onderdeel bestaat niet -- anders kun je met een tikfout een
     lijst aanmaken die nergens getoond wordt en stil verdwijnt. */
  const onzin = await rh('reis/item', { reisId, lijst: 'boodschappen', tekst: 'kaas' });
  assert.equal(onzin.status, 400, 'een onderdeel dat niet bestaat wordt geweigerd');

  /* En een item weghalen laat de rest staan. */
  assert.equal((await rh('reis/item/weg', { reisId, lijst: 'documenten',
    itemId: reis.documenten.find(d => d.soort === 'visum').id })).status, 200, 'het visum gaat eraf');
  const na = (await rh('reisboek', {})).body;
  const naReis = na.reizen.find(r => r.id === reisId);
  assert.equal(naReis.documenten.length, 1, 'het paspoort staat er nog');
  assert.equal(na.attenties.filter(a => a.reis === 'Milaan in het najaar').length, 0,
    'en er is niets meer dat aandacht vraagt');
});

/* ============================================================================
   2 -- HET GEZELSCHAP: WAT ONTBREEKT ER NOG

   Deze app belooft niet "wij regelen uw visum" maar iets bescheideners en
   eerlijkers: wij zeggen wat er aan UW gegevens ontbreekt voor u vertrekt. Dat
   oordeel -- gereed of niet -- is de functie, en die is nergens vastgelegd.
   ========================================================================== */
test('het gezelschap: de app wijst aan wat er ontbreekt, en zwijgt pas als het compleet is', async () => {
  const wie = async (naam, extra) => {
    const r = await rh('entourage/persoon', Object.assign({ naam }, extra || {}));
    assert.equal(r.status, 200, naam + ' staat in de entourage');
    const lijst = (await rh('entourage', {})).body.gezelschap;
    return lijst.find(p => p.naam === naam).id;
  };

  const partner = await wie('Iris Mendes', { band: 'partner', telefoon: '0612345678', dieet: 'geen vis' });
  const vriend = await wie('Paul Brandt', { band: 'vriend', telefoon: '0698765432', dieet: 'vegetarisch' });
  const zakelijk = await wie('Nora Hallen', { band: 'zakelijk' });   // geen nummer, geen dieet

  /* Drie documenten met drie uitkomsten: verlopen, bijna verlopen, ruim goed.
     Zo staat elke tak van de vergelijking in de toets. */
  assert.equal((await rh('entourage/doc', { id: partner, soort: 'paspoort', tot: dag(-10) })).status, 200,
    'het paspoort van de partner is verlopen');
  assert.equal((await rh('entourage/doc', { id: vriend, soort: 'paspoort', tot: dag(45) })).status, 200,
    'dat van de vriend verloopt binnenkort');

  const zonderDatum = await rh('entourage/doc', { id: zakelijk, soort: 'paspoort', tot: 'binnenkort' });
  assert.equal(zonderDatum.status, 400, 'een document zonder echte datum wordt geweigerd: ' +
    JSON.stringify(zonderDatum.body).slice(0, 140));

  /* HET OVERZICHT: twee attenties, de verlopene bovenaan want ze staan op
     datum. Dat is geen opmaak maar de volgorde waarin je ze moet oplossen. */
  const ent = (await rh('entourage', {})).body;
  assert.equal(ent.aantal, 3, 'er gaan drie mensen mee');
  assert.equal(ent.attenties.length, 2, 'twee documenten vragen aandacht: ' + JSON.stringify(ent.attenties));
  assert.equal(ent.attenties[0].naam, 'Iris Mendes', 'de verlopene staat bovenaan');
  assert.equal(ent.attenties[0].verlopen, true, 'en is als verlopen gemerkt');
  assert.equal(ent.attenties[1].verlopen, false, 'de andere verloopt alleen binnenkort');

  /* HET OORDEEL over dit gezelschap. Vier punten: paspoort verlopen, paspoort
     bijna, geen telefoon, dieet onbekend -- en de derde persoon heeft ook geen
     enkel document, dus vijf. */
  const eerst = (await rh('entourage/gezelschap', { ids: [partner, vriend, zakelijk] })).body;
  assert.equal(eerst.personen, 3, 'het gezelschap telt drie mensen');
  assert.equal(eerst.gereed, false, 'en is niet gereed: ' + eerst.tekst);
  const wat = eerst.punten.map(p => p.naam + ': ' + p.wat).join(' | ');
  assert.match(wat, /Iris Mendes: paspoort is verlopen/, 'het verlopen paspoort staat erbij: ' + wat);
  assert.match(wat, /Paul Brandt: paspoort verloopt binnenkort/, 'het bijna-verlopen ook');
  assert.match(wat, /Nora Hallen: geen enkel document/, 'en dat Nora niets heeft');
  assert.match(wat, /Nora Hallen: geen telefoonnummer/, 'en geen nummer');
  assert.match(wat, /Nora Hallen: dieet onbekend/, 'en geen bekend dieet');

  /* De dieetwensen zijn apart, want die gaan naar wie de tafel reserveert. Nora
     staat er niet bij: haar dieet is onbekend, en dat is iets anders dan "geen
     wensen". Dat verschil verzinnen zou de gevaarlijkste fout van deze app zijn. */
  assert.deepEqual(eerst.dieten.map(d => d.naam).sort(), ['Iris Mendes', 'Paul Brandt'],
    'alleen de bekende dieetwensen gaan mee: ' + JSON.stringify(eerst.dieten));

  /* ALLES REPAREREN, en dan hoort de app te zwijgen. Een app die blijft
     waarschuwen nadat je het hebt opgelost, leert je hem te negeren. */
  const docs = (await rh('entourage', {})).body.gezelschap;
  const docVan = (id) => docs.find(p => p.id === id).documenten[0].id;
  assert.equal((await rh('entourage/doc', { id: partner, docId: docVan(partner),
    soort: 'paspoort', tot: dag(900) })).status, 200, 'het paspoort van de partner is vernieuwd');
  assert.equal((await rh('entourage/doc', { id: vriend, docId: docVan(vriend),
    soort: 'paspoort', tot: dag(900) })).status, 200, 'dat van de vriend ook');
  assert.equal((await rh('entourage/persoon', { id: zakelijk, naam: 'Nora Hallen', band: 'zakelijk',
    telefoon: '0611223344', dieet: 'glutenvrij' })).status, 200, 'Nora heeft nu een nummer en een dieet');
  assert.equal((await rh('entourage/doc', { id: zakelijk, soort: 'paspoort', tot: dag(900) })).status, 200,
    'en een geldig paspoort');

  const daarna = (await rh('entourage/gezelschap', { ids: [partner, vriend, zakelijk] })).body;
  assert.deepEqual(daarna.punten, [], 'nu vraagt niets meer aandacht: ' + JSON.stringify(daarna.punten));
  assert.equal(daarna.gereed, true, 'het gezelschap is compleet: ' + daarna.tekst);
  assert.equal(daarna.dieten.length, 3, 'en alle drie de dieetwensen staan op een rij');

  assert.equal((await rh('entourage', {})).body.attenties.length, 0, 'en het overzicht is stil');

  /* Een gezelschap van niemand is geen gezelschap. */
  const leeg = await rh('entourage/gezelschap', { ids: [] });
  assert.equal(leeg.status, 400, 'zonder mensen valt er niets samen te stellen');
});

/* ============================================================================
   3 -- DE CERCLE: WAAR KAN IK IN MILAAN TERECHT, EN OP WELK LIDMAATSCHAP

   Twee dingen die stil fout gaan: het antwoord op "waarheen" moet BEIDE wegen
   kennen (eigen club en reciprociteit), en de gastpassen moeten kloppen. Een
   teller die niet terugloopt is erger dan geen teller, want je vertrouwt hem.
   ========================================================================== */
test('de cercle: waarheen kent beide wegen, en de gastpassen kloppen', async () => {
  assert.equal((await rh('cercle/club', { naam: 'Circolo Filologico', stad: 'Milaan',
    lidnummer: 'MI-4417', sinds: jaar - 6, dresscode: 'jasje', gastpassen: 2,
    reciprociteit: 'Casa degli Artisti, The Arts Club Londen' })).status, 200, 'de club in Milaan staat erin');

  assert.equal((await rh('cercle/club', { naam: 'Sociëteit De Kring', stad: 'Amsterdam',
    lidnummer: 'AMS-88', sinds: jaar - 12, gastpassen: 4,
    reciprociteit: ['Circolo del Whist Turijn'] })).status, 200, 'de club in Amsterdam ook');

  const overzicht = (await rh('cercle', {})).body;
  assert.equal(overzicht.aantal, 2, 'twee clubs');
  assert.equal(overzicht.steden, 2, 'in twee steden');
  assert.equal(overzicht.gastpassen, 6, 'met zes gastpassen bij elkaar');
  assert.equal(overzicht.reciprociteiten, 3, 'en drie reciprociteiten');

  /* De tekstregel is bij het lezen gesplitst tot losse clubs. Dat is de zachte
     migratie uit de kop van de module, en zonder toets zou hij stil kunnen
     verdwijnen bij de volgende opschoning. */
  const milaan = overzicht.clubs.find(c => c.naam === 'Circolo Filologico');
  assert.deepEqual(milaan.reciprociteit, ['Casa degli Artisti', 'The Arts Club Londen'],
    'de tekstregel is gelezen als twee clubs: ' + JSON.stringify(milaan.reciprociteit));

  /* DE VRAAG WAAR HET OM GAAT. In Milaan: de eigen club, plus de club waar het
     Amsterdamse lidmaatschap niets aan bijdraagt -- die mag er dus NIET bij. */
  const w = (await rh('cercle/waarheen', { stad: 'Milaan' })).body;
  assert.equal(w.eigen.length, 1, 'een eigen club in Milaan: ' + JSON.stringify(w.eigen));
  assert.equal(w.eigen[0].club, 'Circolo Filologico', 'de juiste');
  assert.equal(w.eigen[0].lidnummer, 'MI-4417', 'met het lidnummer erbij, want daar vragen ze naar');
  assert.equal(w.viaGast.length, 0, 'en geen enkele reciprociteit heet "Milaan"');
  assert.match(w.bron, /zelf heeft ingevuld/,
    'en de app zegt erbij dat dit uit eigen invoer komt, niet uit een clubgids die wij zouden bijhouden');

  /* De andere weg: Turijn kent het lid alleen via het Amsterdamse lidmaatschap. */
  const t = (await rh('cercle/waarheen', { stad: 'Turijn' })).body;
  assert.equal(t.eigen.length, 0, 'geen eigen club in Turijn');
  assert.equal(t.viaGast.length, 1, 'maar wel een via reciprociteit: ' + JSON.stringify(t.viaGast));
  assert.match(t.viaGast[0].via, /De Kring/, 'en het zegt via welk lidmaatschap');

  /* DE GASTPASSEN. Twee bij de club in Milaan; er gaan er twee op, de derde
     stuit, en een correctie geeft er een terug. */
  const clubId = (await rh('cercle', {})).body.clubs.find(c => c.naam === 'Circolo Filologico').id;
  const een = await rh('cercle/gast', { id: clubId, wie: 'Iris Mendes', stad: 'Milaan' });
  assert.equal(een.body.gastpassen, 1, 'na een gast staat de teller op 1');
  const twee = await rh('cercle/gast', { id: clubId, wie: 'Paul Brandt', stad: 'Milaan' });
  assert.equal(twee.body.gastpassen, 0, 'na twee op 0');

  const derde = await rh('cercle/gast', { id: clubId, wie: 'Nora Hallen', stad: 'Milaan' });
  assert.equal(derde.status, 400, 'en een derde kan niet: ' + JSON.stringify(derde.body).slice(0, 140));

  /* Wie er mee is geweest staat in het logboek -- dat is de boekhouding die een
     concierge anders bijhoudt. */
  const club = (await rh('cercle', {})).body.clubs.find(c => c.id === clubId);
  assert.equal(club.gastlog.length, 2, 'twee gasten in het logboek');
  assert.deepEqual(club.gastlog.map(g => g.wie).sort(), ['Iris Mendes', 'Paul Brandt'],
    'met hun namen: ' + JSON.stringify(club.gastlog.map(g => g.wie)));

  /* Een vergissing terugdraaien geeft de pas terug EN haalt de regel weg. Beide
     moeten, anders klopt het saldo niet meer met het logboek. */
  const terug = await rh('cercle/gast/terug', { id: clubId, gastId: club.gastlog[0].id });
  assert.equal(terug.body.gastpassen, 1, 'de pas is terug');
  const na = (await rh('cercle', {})).body.clubs.find(c => c.id === clubId);
  assert.equal(na.gastlog.length, 1, 'en de regel is uit het logboek');

  const onbekend = await rh('cercle/gast/terug', { id: clubId, gastId: 'bestaat-niet' });
  assert.equal(onbekend.status, 404, 'een gastpas die er niet is kun je niet terugdraaien');
});

/* ============================================================================
   4 -- DE HANGAR: WAAR STAAT HET TOESTEL

   Drie berekende dingen: de vlieguren tellen op, de positie volgt de LAATSTE
   gevlogen vlucht (en valt terug op de thuishaven), en de eerstvolgende vlucht
   is de eerste in de toekomst. Alle drie staan nergens in de gegevens.
   ========================================================================== */
test('de hangar: uren tellen op, de positie volgt de laatste vlucht, en het toestel neemt zijn vluchten mee', async () => {
  const zonderToestel = await rh('hangar/vlucht', { toestelId: 'bestaat-niet', van: 'EHAM' });
  assert.equal(zonderToestel.status, 404, 'een vlucht zonder toestel kan niet: ' +
    JSON.stringify(zonderToestel.body).slice(0, 140));

  assert.equal((await rh('hangar/toestel', { naam: 'De Zilverreiger', type: 'jet',
    registratie: 'PH-RTG', basis: 'EHAM', stoelen: 8 })).status, 200, 'het toestel staat in de hangar');
  const t1 = (await rh('hangar', {})).body.toestellen[0].id;

  const zonderVan = await rh('hangar/vlucht', { toestelId: t1, naar: 'LIML' });
  assert.equal(zonderVan.status, 400, 'een vlucht zonder vertrekhaven ook niet');

  /* Twee gevlogen vluchten en een geplande. De positie hoort die van de tweede
     te zijn (de recentste in het verleden), niet die van de geplande. */
  assert.equal((await rh('hangar/vlucht', { toestelId: t1, van: 'EHAM', naar: 'LFPB',
    datum: dag(-20), tijd: '08:00', uren: 1.2, bemanning: 'cpt. Vos' })).status, 200, 'vlucht een');
  assert.equal((await rh('hangar/vlucht', { toestelId: t1, van: 'LFPB', naar: 'LSGG',
    datum: dag(-5), tijd: '14:15', uren: 0.9 })).status, 200, 'vlucht twee');
  assert.equal((await rh('hangar/vlucht', { toestelId: t1, van: 'LSGG', naar: 'LIML',
    datum: dag(40), tijd: '09:30', uren: 0.8 })).status, 200, 'en de geplande vlucht naar Milaan');

  const h = (await rh('hangar', {})).body;
  const toestel = h.toestellen.find(x => x.id === t1);
  assert.equal(toestel.vluchtAantal, 3, 'drie vluchten aan dit toestel');
  assert.equal(toestel.uren, 2.9, 'de uren tellen op tot 2.9: ' + toestel.uren);
  assert.equal(h.totaalUren, 2.9, 'en dat is ook het totaal van de hangar');
  assert.equal(toestel.positie, 'LSGG',
    'het toestel staat waar de laatste GEVLOGEN vlucht eindigde, niet waar de geplande heen gaat: ' + toestel.positie);
  assert.ok(h.komend && h.komend.naar === 'LIML', 'en de eerstvolgende vlucht gaat naar Milaan: ' +
    JSON.stringify(h.komend));

  /* Een tweede toestel zonder vluchten valt terug op zijn thuishaven. Zonder
     die tak staat een lege hangar met een leeg positieveld. */
  assert.equal((await rh('hangar/toestel', { naam: 'De Kraanvogel', type: 'helikopter',
    registratie: 'PH-KRN', basis: 'EHRD' })).status, 200, 'er komt een helikopter bij');
  const heli = (await rh('hangar', {})).body.toestellen.find(x => x.naam === 'De Kraanvogel');
  assert.equal(heli.positie, 'EHRD', 'die staat op zijn thuishaven, want hij heeft nog niet gevlogen');
  assert.equal(heli.uren, 0, 'met nul uren');

  /* EN DE SCHERPE: een toestel weghalen neemt ZIJN vluchten mee, en die van het
     andere toestel niet. Bleven ze staan, dan telde de hangar uren van een
     toestel dat er niet meer is -- een getal zonder eigenaar. */
  assert.equal((await rh('hangar/toestel/weg', { id: t1 })).status, 200, 'de jet gaat de hangar uit');
  const na = (await rh('hangar', {})).body;
  assert.equal(na.toestellen.length, 1, 'er staat er nog een');
  assert.equal(na.vluchten.length, 0, 'en zijn drie vluchten zijn mee weggegaan: ' + JSON.stringify(na.vluchten));
  assert.equal(na.totaalUren, 0, 'dus het totaal is weer nul');
  assert.equal(na.komend, null, 'en er is geen komende vlucht meer');
});

/* ============================================================================
   5 -- DE CELLIER: WAT IS ER NU OP DRONK

   Het drinkvenster is de enige functie van deze app die je niet zelf kunt zien
   door de lijst te bekijken. Drie takken, drie flessen.
   ========================================================================== */
test('de cellier: het drinkvenster deelt de kelder in drieen, en schenken telt af', async () => {
  const zonderNaam = await rh('cellier/zet', { domein: 'Onbekend' });
  assert.equal(zonderNaam.status, 400, 'een fles zonder naam gaat de kelder niet in');

  assert.equal((await rh('cellier/zet', { naam: 'Barolo Riserva', domein: 'Giacosa', kleur: 'rood',
    jaargang: jaar - 10, aantal: 6, waarde: 180, drinkVan: jaar - 2, drinkTot: jaar + 5 })).status, 200,
    'de Barolo staat in de kelder');
  assert.equal((await rh('cellier/zet', { naam: 'Jonge Chablis', kleur: 'wit',
    jaargang: jaar - 1, aantal: 12, waarde: 30, drinkVan: jaar + 3, drinkTot: jaar + 9 })).status, 200,
    'de Chablis ook');
  assert.equal((await rh('cellier/zet', { naam: 'Vergeten Bordeaux', kleur: 'rood',
    jaargang: jaar - 30, aantal: 1, waarde: 90, drinkVan: jaar - 20, drinkTot: jaar - 4 })).status, 200,
    'en de Bordeaux die te lang heeft gelegen');

  const k = (await rh('cellier', {})).body;
  const staat = (naam) => k.flessen.find(f => f.naam === naam).staat;
  assert.equal(staat('Barolo Riserva'), 'op dronk', 'de Barolo is nu op dronk');
  assert.equal(staat('Jonge Chablis'), 'laten liggen', 'de Chablis moet nog liggen');
  assert.equal(staat('Vergeten Bordeaux'), 'over de top', 'en de Bordeaux is over de top');
  assert.equal(k.opDronk, 1, 'dus er is er precies een om vanavond te openen: ' + k.opDronk);

  assert.equal(k.totaalFlessen, 19, 'negentien flessen in totaal: ' + k.totaalFlessen);
  assert.equal(k.kelderwaarde, 6 * 180 + 12 * 30 + 90, 'en de kelderwaarde telt per fles, niet per regel');

  /* Een fles zonder venster is 'onbekend' -- niet stilzwijgend 'op dronk'. Dat
     verschil is het verschil tussen weten en gokken. */
  assert.equal((await rh('cellier/zet', { naam: 'Naamloze magnum', aantal: 1, waarde: 0 })).status, 200,
    'er komt een fles zonder drinkvenster bij');
  assert.equal((await rh('cellier', {})).body.flessen.find(f => f.naam === 'Naamloze magnum').staat, 'onbekend',
    'die staat op onbekend, niet op op dronk');

  /* SCHENKEN telt af tot nul, en dan is er niets meer te schenken. */
  const magnumId = (await rh('cellier', {})).body.flessen.find(f => f.naam === 'Naamloze magnum').id;
  assert.equal((await rh('cellier/schenk', { id: magnumId })).body.aantal, 0, 'de magnum is geschonken');
  const nogeen = await rh('cellier/schenk', { id: magnumId });
  assert.equal(nogeen.status, 400, 'en er is er geen tweede: ' + JSON.stringify(nogeen.body).slice(0, 140));

  const weg = await rh('cellier/schenk', { id: 'bestaat-niet' });
  assert.equal(weg.status, 404, 'een fles die niet in de kelder ligt kun je niet schenken');
});
