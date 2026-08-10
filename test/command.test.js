/* RTG Command (kern/command/): de bestuurslaag van het RTG- en RTF-kantoor
   bewijst hier zijn zes harde beloftes. Zoeken vindt over domeinen heen; het
   objectdossier meet zijn afhankelijkheden in plaats van ze op te schrijven;
   dezelfde handeling krijgt een ander niveau zodra het beleid schuift; een
   herstelronde is terug te draaien maar wist nooit andermans werk; het journaal
   merkt dat er in geknoeid is; en vier ogen zijn twee mensen.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `beleid.getal('risico.autoGrens')` vast op 30 gezet in risico.js
     -> "een hoger beleid maakt van mensenwerk machinewerk" ZAKT (RAAK), en
        "de simulatie raakt het echte beleid niet aan" zakt mee -- die leest
        dezelfde grens, dus dat hoort zo
   - de waardecontrole in runbooks.draaiTerug weggehaald (altijd terugzetten)
     -> "terugdraaien wist nooit het werk van iemand anders" ZAKT (RAAK)
   - de gelijke-actor-grendel in beleid.keur weggehaald
     -> "wie voorstelt keurt niet zelf goed" ZAKT (RAAK)
   - de hash-vergelijking in journaal.controleer op `true` gezet
     -> "het journaal merkt dat er in geknoeid is" ZAKT (RAAK)
   - het ruime venster in runbooks.doelenVoor terug naar de rondegrens
     -> "een gekozen geval buiten de rondegrens wordt toch gevonden" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

/* Een verse kern met een kleine, echte wereld eronder: vier ritten waarvan er
   drie vastlopen op twee voertuigen, één voertuig met storing, een zaak en een
   mislukte bestelling. Precies genoeg om alle beloftes op te toetsen. */
function maak() {
  const db = { data: {
    rides: [
      { id: 'r1', status: 'vast', kenteken: 'AA-01', lijn: '12', from: 'Haarlem', to: 'Zandvoort' },
      { id: 'r2', status: 'vast', kenteken: 'AA-01', lijn: '12', from: 'Haarlem', to: 'Zandvoort' },
      { id: 'r3', status: 'vast', kenteken: 'BB-02', lijn: '12', from: 'Haarlem', to: 'Bloemendaal' },
      { id: 'r4', status: 'gepland', kenteken: 'CC-03', lijn: '9', from: 'Amsterdam', to: 'Haarlem' }
    ],
    ovVoertuigen: [
      { id: 'v1', kenteken: 'AA-01', soort: 'bus', lijn: '12', staat: 'storing' },
      { id: 'v2', kenteken: 'BB-02', soort: 'bus', lijn: '12', staat: 'rijdt' }
    ],
    suppliers: [{ code: 'HOSHI', name: 'Aguamarina Ibiza', type: 'hotel', city: 'Ibiza' }],
    orders: [{ id: 'o1', status: 'mislukt', supplierCode: 'HOSHI', total: 1200 }]
  } };
  return { db, c: require('../server/kern/command').maakCommand({ db, save: () => {}, crypto, anthropic: null }) };
}

test('de zoekbalk vindt hetzelfde kenteken in een ander domein dan waar je het typte', () => {
  const { c } = maak();
  const uit = c.zoek('AA-01');
  const soorten = uit.groepen.map(g => g.type);
  assert.ok(soorten.includes('voertuig'), 'het voertuig zelf staat erbij: ' + soorten.join(','));
  // en het bereik vertelt waar er gekeken is, ook als er niets is
  const niets = c.zoek('ditbestaatniet');
  assert.equal(niets.totaal, 0);
  assert.ok(c.bereik().length >= 8, 'de zoekbalk zegt in hoeveel soorten hij keek');
});

test('het objectdossier MEET zijn afhankelijkheden en schrijft ze niet op', () => {
  const { db, c } = maak();
  const d = c.dossier('voertuig', 'v1');
  const ritten = d.afhankelijkheden.find(g => g.type === 'rit');
  assert.ok(ritten && ritten.totaal === 2, 'de twee ritten op AA-01 hangen aan v1');
  assert.equal(ritten.rijen[0].via, 'kenteken', 'en hij zegt VIA welk veld');

  /* De meting, niet de tabel: een rit die er niet was toen dit bestand werd
     geschreven, hangt er meteen aan. Een handgeschreven relatietabel zou hier
     stil hetzelfde antwoord blijven geven. */
  db.data.rides.push({ id: 'r5', status: 'gepland', kenteken: 'AA-01', lijn: '12' });
  assert.equal(c.dossier('voertuig', 'v1').afhankelijkheden.find(g => g.type === 'rit').totaal, 3);
});

test('een hoger beleid maakt van mensenwerk machinewerk, zonder dat er code wijzigt', () => {
  const { c } = maak();
  // 'voertuig uit dienst' (grondslag 45) + klantimpact: boven de autogrens van 30
  const voor = c.risico.beoordeel('voertuig uit dienst', { aantal: 1, klantImpact: true });
  assert.notEqual(voor.niveau, 'auto', 'met de startgrenzen is dit geen machinewerk (' + voor.score + ')');

  c.beleid.zet('risico.autoGrens', 90, 'Rahul', 'proef: alles autonoom');
  // vier ogen: dit is een voorstel, dus de waarde staat nog niet
  assert.equal(c.risico.beoordeel('voertuig uit dienst', { aantal: 1, klantImpact: true }).niveau, voor.niveau);
  const v = c.beleid.openVoorstellen()[0];
  c.beleid.keur(v.id, 'Tweede Persoon', true, 'akkoord voor de proef');

  const na = c.risico.beoordeel('voertuig uit dienst', { aantal: 1, klantImpact: true });
  assert.equal(na.niveau, 'auto', 'na het beleid wel (' + na.score + ' onder ' + na.grenzen.auto + ')');
  assert.equal(na.score, voor.score, 'dezelfde score: het is de GRENS die schoof, niet het risico');
});

test('een stapel is een andere handeling dan één geval', () => {
  const { c } = maak();
  const een = c.risico.beoordeel('rit vast', { aantal: 1 });
  const veel = c.risico.beoordeel('rit vast', { aantal: 150 });
  assert.ok(veel.score > een.score, 'honderdvijftig gevallen wegen zwaarder dan één');
  assert.equal(c.risico.beoordeel('massamutatie', {}).vierOgen, true);
});

test('droog draaien verandert niets; uitvoeren wel', () => {
  const { db, c } = maak();
  const droog = c.runbooks.voer('rit-vast-hervatten', { droog: true });
  assert.equal(droog.run.geraakt, 3);
  assert.equal(db.data.rides.filter(r => r.status === 'vast').length, 3, 'de droogloop liet ze staan');

  const echt = c.runbooks.voer('rit-vast-hervatten', { droog: false, door: 'Rahul', reden: 'toets' });
  assert.equal(echt.run.geraakt, 3);
  assert.equal(db.data.rides.filter(r => r.status === 'vast').length, 0, 'nu zijn ze hervat');
});

test('terugdraaien wist nooit het werk van iemand anders', () => {
  const { db, c } = maak();
  const run = c.runbooks.voer('rit-vast-hervatten', { droog: false, door: 'Rahul', reden: 'toets' }).run;
  // iemand anders zet r2 daarna zelf op iets anders
  db.data.rides.find(r => r.id === 'r2').status = 'geannuleerd';

  const terug = c.runbooks.draaiTerug(run.id, 'Rahul', 'toch niet');
  assert.equal(terug.teruggezet, 2, 'alleen wat nog stond zoals de ronde het achterliet');
  assert.equal(terug.overgeslagen, 1, 'en het handwerk van de ander is overgeslagen');
  assert.equal(db.data.rides.find(r => r.id === 'r2').status, 'geannuleerd', 'dat werk staat er nog');
});

test('een gekozen geval buiten de rondegrens wordt toch gevonden', () => {
  /* DE VAL die deze toets dichtzet: de operator kijkt met een RUIMER venster
     dan de rondegrens, dus zijn veilige gevallen kunnen voorbij de eerste
     maxPerRonde kandidaten liggen. Zocht runbooks.voer daarna alleen in dat
     eerste stuk, dan kwam er "0 hersteld" uit -- zonder fout, zonder melding.
     Een uitkomst van nul die niets zegt, is de gevaarlijkste uitkomst die er is. */
  const { db, c } = maak();
  c.beleid.zet('herstel.maxPerRonde', 2, 'Rahul', 'krappe ronde voor de proef');
  for (let i = 0; i < 8; i++) db.data.rides.push({ id: 'x' + i, status: 'vast', kenteken: 'ZZ-0' + i });
  const laatste = 'x7';
  const r = c.runbooks.voer('rit-vast-hervatten', { droog: false, door: 'Rahul', reden: 'alleen de laatste', alleen: [laatste] });
  assert.equal(r.run.geraakt, 1, 'het gevraagde geval is gevonden, ook al staat het achteraan');
  assert.equal(db.data.rides.find(x => x.id === laatste).status, 'gepland');
  // en de rondegrens geldt nog steeds op wat er WEL wordt aangeraakt
  const veel = c.runbooks.voer('rit-vast-hervatten', { droog: true, alleen: db.data.rides.map(x => x.id) });
  assert.equal(veel.run.geraakt, 2, 'de rondegrens van 2 knijpt de selectie af');
});

test('een runbook raakt nooit een bevroren veld', () => {
  const { c } = maak();
  const { BEVROREN } = require('../server/kern/command/runbooks');
  for (const rb of c.runbooks.RUNBOOKS) {
    assert.equal(BEVROREN.has(rb.veld), false, rb.id + ' schrijft in ' + rb.veld + ', en dat is bevroren');
  }
  assert.ok(BEVROREN.has('total') && BEVROREN.has('codenaam'), 'bedrag en identiteit staan op slot');
});

test('de operator meet de oorzaak en verzint hem niet', () => {
  const { c } = maak();
  const p = c.operator.plan('waarom lopen ritten vast?', 'Rahul');
  const deel = p.delen.find(d => d.runbook === 'rit-vast-hervatten');
  assert.equal(deel.oorzaakVeld, 'kenteken', 'het kenteken clustert deze drie het strakst');
  assert.equal(deel.oorzaken[0].aantal, 2, 'twee op AA-01');
  assert.ok(p.tekst.includes('kenteken AA-01'), 'en dat staat in de zin: ' + p.tekst);

  /* Zonder gedeelde oorzaak zegt hij dat er geen is, in plaats van er een aan
     te wijzen. Een groepering die met gezag het verkeerde zegt, is erger dan
     geen groepering. */
  const { groepeer } = require('../server/kern/command/oorzaak');
  const los = groepeer([{ rij: { a: '1' } }, { rij: { a: '2' } }, { rij: { a: '3' } }]);
  assert.equal(los.veld, null);
});

test('"doe de veilige gevallen" doet er precies zoveel, en de rest wordt een zaak', () => {
  const { db, c } = maak();
  const p = c.operator.plan('wat kan er hersteld worden?', 'Rahul');
  assert.ok(p.veilig > 0 && p.uitzonderingen > 0, 'er is iets veiligs en iets voor een mens: ' + p.tekst);

  const uit = c.operator.voerVeilig(p.id, 'Rahul', 'de veilige gevallen');
  assert.equal(uit.hersteld, p.veilig);
  assert.equal(uit.zaken, p.uitzonderingen, 'elke uitzondering is een zaak geworden en niet verdampt');
  assert.equal(db.data.ovVoertuigen.find(v => v.id === 'v1').staat, 'storing',
    'het voertuig met klantimpact is NIET aangeraakt: dat was de uitzondering');

  const zaak = c.zaken.lijst({ status: 'open' })[0];
  assert.ok(zaak.bewijs && zaak.bewijs.plan === p.id, 'de zaak draagt het bewijs waarop hij ontstond');
  assert.equal(c.operator.voerVeilig(p.id, 'Rahul', 'nog eens').status, 409, 'en een plan gaat maar één keer');
});

test('een zaak vraagt een reden, en herhaalde besluiten worden een kandidaat', () => {
  const { c } = maak();
  const z = c.zaken.open({ titel: 'Proef', domein: 'mobiliteit', oorzaak: 'kenteken-afwijking', door: 'Rahul', reden: 'toets' });
  assert.equal(c.zaken.besluit(z.id, 'Rahul', 'hersteld', 'ok').status, 400, 'een reden van drie letters is geen reden');
  assert.ok(c.zaken.besluit(z.id, 'Rahul', 'hersteld', 'handmatig hersteld na controle').zaak);

  for (let i = 0; i < 3; i++) {
    const x = c.zaken.open({ titel: 'Proef ' + i, domein: 'mobiliteit', oorzaak: 'kenteken-afwijking', door: 'Rahul', reden: 'toets' });
    c.zaken.besluit(x.id, 'Rahul', 'hersteld', 'handmatig hersteld na controle');
  }
  const punten = c.zaken.leerpunten(3);
  assert.ok(punten.length && punten[0].aantal >= 4, 'vier keer hetzelfde besluit is een runbook dat nog niet bestaat');
});

test('vier ogen betekent twee mensen', () => {
  const { c } = maak();
  const r = c.beleid.zet('risico.mensGrens', 95, 'Rahul', 'proef met vier ogen');
  assert.equal(r.vierOgen, true, 'een zware regel wordt een voorstel en gaat niet meteen live');
  assert.equal(c.beleid.waarde('risico.mensGrens'), 70, 'de oude waarde staat er nog');

  const zelf = c.beleid.keur(r.voorstel.id, 'Rahul', true, 'ik keur mezelf goed');
  assert.equal(zelf.status, 403, zelf.error);
  const ander = c.beleid.keur(r.voorstel.id, 'Tweede Persoon', true, 'gezien en akkoord');
  assert.equal(ander.uitkomst.waarde, 95);
  assert.equal(c.beleid.waarde('risico.mensGrens'), 95);
});

test('terugzetten is de volgende versie en niet het wissen van de vorige', () => {
  const { c } = maak();
  c.beleid.zet('zaak.termijnUren', 24, 'Rahul', 'korter');
  assert.equal(c.beleid.waarde('zaak.termijnUren'), 24);
  const t = c.beleid.terug('zaak.termijnUren', 'Rahul', 'toch niet');
  assert.equal(c.beleid.waarde('zaak.termijnUren'), 48);
  assert.equal(t.versie, 3, 'versie 3 is "terug naar 1"; versie 2 blijft in de geschiedenis staan');
  assert.equal(c.beleid.geschiedenis('zaak.termijnUren').versies.length, 3);
});

test('het journaal merkt dat er in geknoeid is', () => {
  const { db, c } = maak();
  c.beleid.zet('zaak.termijnUren', 24, 'Rahul', 'een wijziging om te noteren');
  c.beleid.zet('herstel.maxPerRonde', 10, 'Rahul', 'nog een wijziging');
  assert.equal(c.journaal.controleer().heel, true);

  db.data.commandJournaal[0].reden = 'iets heel anders';
  const stuk = c.journaal.controleer();
  assert.equal(stuk.heel, false);
  assert.match(stuk.waarom, /gewijzigd na het noteren/);
});

test('de nooddeur bestaat, maar niet stil', () => {
  const { c } = maak();
  assert.equal(c.toegang.breekGlas('kluis-inzage', 'Rahul', 'kort').status, 400, 'een halve reden is geen reden');
  const r = c.toegang.breekGlas('kluis-inzage', 'Rahul', 'incident 4412: lid meldt onterechte afschrijving');
  assert.ok(r.recht.nood && r.recht.tot > new Date().toISOString());
  assert.equal(c.toegang.geldig('Rahul', 'kluis-inzage'), true);

  const spoor = c.journaal.recent(5).find(x => x.actie === 'noodtoegang openen');
  assert.ok(spoor && spoor.risico === 95, 'de nooddeur staat als zwaarste handeling in het journaal');
  // een zwaar recht geef je niet aan jezelf
  assert.equal(c.toegang.geef('massamutatie', 'Rahul', 'Rahul', 'omdat het kan').status, 403);
});

test('de toezichthouder stopt een agent die vaker misgaat dan goed gaat', () => {
  const { c } = maak();
  for (let i = 0; i < 6; i++) c.toezicht.boek('proefagent', { gelukt: false });
  for (let i = 0; i < 5; i++) c.toezicht.boek('proefagent', { gelukt: true });
  const b = c.toezicht.budget('proefagent');
  assert.equal(b.gestopt, true, 'zes van de elf mislukt is meer dan de helft');
  assert.equal(c.toezicht.mag('proefagent', {}).mag, false);

  // en twee agents op hetzelfde object botsen
  c.toezicht.boek('agent-a', { objectType: 'rit', objectId: 'r1' });
  const bots = c.toezicht.mag('agent-b', { objectType: 'rit', objectId: 'r1' });
  assert.equal(bots.mag, false);
  assert.match(bots.waarom, /botsing/);
});

test('een leeg domein staat op leeg en niet op in orde', () => {
  const { c } = maak();
  const b = c.puls.beeld();
  const horeca = b.domeinen.find(d => d.domein === 'horeca');
  assert.equal(horeca.stand, 'leeg', 'niet gemeten is geen groen');
  const mob = b.domeinen.find(d => d.domein === 'mobiliteit');
  assert.notEqual(mob.stand, 'in orde', 'daar staat wel iets open');
});

test('de werkbesparing telt handwerk apart van machinewerk', () => {
  const { c } = maak();
  const p = c.operator.plan('wat kan er hersteld worden?', 'Rahul');
  c.operator.voerVeilig(p.id, 'Rahul', 'de veilige gevallen');
  const bord = c.werkbesparing.bord(30);
  assert.ok(bord.handelingen > 0);
  assert.ok(bord.werkstromen.some(w => w.perNiveau.auto > 0), 'er staat autonoom werk in');
  assert.ok(bord.onzeker.includes('schattingen'), 'en de meter zegt zelf dat hij schat');
});

test('de simulatie raakt het echte beleid niet aan', () => {
  const { c } = maak();
  const voor = c.beleid.waarde('risico.autoGrens');
  const proef = c.simulatie.beleidsproef('risico.autoGrens', 95);
  assert.equal(c.beleid.waarde('risico.autoGrens'), voor, 'de proef heeft niets gezet');
  assert.ok(proef.na.some((n, i) => n.niveau !== proef.voor[i].niveau), 'maar hij laat wel zien wat het zou doen');
  assert.ok(c.simulatie.watAls({ groeiProcent: 30 }).aannames.length >= 4, 'en een wat-als draagt zijn aannames');
});
