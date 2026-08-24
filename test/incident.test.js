/* HET INCIDENT ALS OBJECT: tien beweringen, en ze gaan allemaal over de manier
   waarop een incidentenlijst normaal gesproken onwaar wordt.

    1. DE MACHINE OPENT. Een storing die niemand vastlegt, is een storing waar
       niemand van leert.
    2. MAAR HIJ OPENT ER GEEN TWEEDE voor dezelfde storing. Een lijst die elke
       ronde aangroeit, leert mensen wegkijken.
    3. DE MACHINE SLUIT NIET. Herstelt de bron zich, dan wordt het incident
       "hersteld" en wacht het op een verslag -- anders staat er een storing in
       de historie zonder conclusie.
    4. SLUITEN KAN NIET TERWIJL HET NOG STUK IS. Een gesloten incident boven een
       lopende storing is een leugen in de historie, en de makkelijkste om te
       vertellen: het scherm wordt er rustiger van.
    5. MAAR HET KAN WEL MET "TOCH", en dan staat dat in het verslag. Een grendel
       zonder uitweg wordt omzeild in plaats van gebruikt.
    6. EEN VERSLAG IS VERPLICHT.
    7. DE IMPACT IS GEMETEN, EN WAT NIET TE METEN IS STAAT ERBIJ. Geen enkel
       getal over verlies, dubbelingen of geraakte leden -- die tellers bestaan
       hier niet.
    8. DE OORZAAK IS EEN AANLEIDING EN GEEN FEIT. Vindt hij niets, dan zegt hij
       dat in plaats van iets te verzinnen.
    9. DE MOMENTOPNAME BIJ HET ONTSTAAN BLIJFT STAAN. Wie later kijkt, ziet
       anders alleen de toestand waarin het probleem er niet meer is.
   10. EEN INCIDENT IS GEEN ZAAK. Het hangt aan een VERMOGEN en niet aan een
       geval, en het staat in zijn eigen rij.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de `if (!lopend)`-bewaking in weeg() weggehaald (dus elke ronde een nieuw)
     -> "hij opent er geen tweede voor dezelfde storing" ZAKT (RAAK)
   - weeg() het incident laten sluiten in plaats van markeren als hersteld
     -> "de machine sluit niet" ZAKT (RAAK)
   - de `nogStuk && !opt.toch`-grendel uit sluit() gehaald
     -> "sluiten kan niet terwijl het nog stuk is" ZAKT (RAAK)
   - de verslaglengte-eis uit sluit() gehaald
     -> "een verslag is verplicht" ZAKT (RAAK)
   - NIET_TE_METEN leeggemaakt
     -> "de impact is gemeten, en wat niet te meten is staat erbij" ZAKT (RAAK)
   - aanleidingen() een vaste zin laten teruggeven als er niets is gevonden
     -> "de oorzaak is een aanleiding en geen feit" ZAKT (RAAK)

   Draai los: node --test test/incident.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakIncidenten } = require('../server/kern/command/incident');

/* Een gezondheidskaart die je zelf zet. De motor leest er alleen uit; alles wat
   hij over een storing zegt, moet uit deze bevindingen komen. */
function kaartMet(oordelen, extra) {
  const v = (id, naam, oordeel, bev, geraakt) => ({
    id, naam, oordeel, graad: oordeel === 'niet vast te stellen' ? 'onbekend' : 'gemeten',
    geraakt: geraakt || [], bevindingen: bev || [],
    taal: { mens: naam + ': ' + oordeel }
  });
  return { stand: () => ({ vermogens: [
    v('betalen', 'Betalen', oordelen.betalen || 'in orde',
      (extra && extra.betalen) || [{ bron: 'meting', oordeel: oordelen.betalen === 'storing' ? 'storing' : 'in orde',
        graad: 'gemeten', at: '2026-08-24T10:00:00.000Z', zin: '440 verzoeken, 40 serverfouten (9.091%)',
        getallen: { verzoeken: 440, fouten5xx: 40 }, zegtNiet: 'de teller zit in het geheugen van dit proces' }],
      (extra && extra.betalenGeraakt) || []),
    v('sporen', 'De sporen', oordelen.sporen || 'in orde',
      [{ bron: 'journaal', oordeel: oordelen.sporen === 'storing' ? 'storing' : 'in orde', graad: 'gemeten',
        at: '2026-08-24T10:00:00.000Z', zin: 'de hashketen is heel over 12 regels',
        getallen: { heel: oordelen.sporen !== 'storing', regels: 12 }, zegtNiet: 'stilte is hier geen bewijs' }])
  ] }) };
}

function opstelling(oordelen, extra) {
  const db = { data: {} };
  const regels = [];
  const journaal = { noteer: (r) => regels.push(r), overObject: (t, i) => regels.filter(r => r.objectId === i) };
  let kaart = kaartMet(oordelen || {}, extra);
  const inc = maakIncidenten({ db, save() {}, journaal, gezondheid: { stand: () => kaart.stand() } });
  return { db, regels, inc, zet: (o, e) => { kaart = kaartMet(o, e); } };
}

test('1. de machine opent, en 10. een incident hangt aan een vermogen', () => {
  const t = opstelling({ betalen: 'storing' });
  const w = t.inc.weeg('de toets');
  assert.equal(w.nieuw.length, 1);
  const lijst = t.inc.lijst();
  assert.equal(lijst.length, 1);
  assert.equal(lijst[0].vermogen, 'betalen', 'een incident hangt aan een vermogen en niet aan een geval');
  assert.match(lijst[0].id, /^RTG-\d{4}$/, 'een incident heeft een nummer waar je naar kunt verwijzen');
  assert.equal(lijst[0].status, 'open');
  assert.ok(t.regels.some(r => r.actie === 'incident geopend'), 'het openen staat niet in het journaal');
});

test('2. hij opent er geen tweede voor dezelfde storing', () => {
  const t = opstelling({ betalen: 'storing' });
  t.inc.weeg('de toets');
  const tweede = t.inc.weeg('de toets');
  assert.deepEqual(tweede.nieuw, [], 'de tweede ronde opende er nog een');
  assert.equal(t.inc.lijst().length, 1);
  /* En met de hand kan het ook niet, met een verwijzing naar het lopende. */
  const hand = t.inc.opdeHand('betalen', 'iemand', 'nog een', 'omdat het kan');
  assert.equal(hand.status, 409);
  assert.ok(hand.incident.id, 'de weigering wijst niet naar het lopende incident');
});

test('3. de machine sluit niet: hersteld is geen gesloten', () => {
  const t = opstelling({ betalen: 'storing' });
  t.inc.weeg('de toets');
  t.zet({ betalen: 'in orde' });
  const w = t.inc.weeg('de toets');
  assert.equal(w.hersteld.length, 1);
  const i = t.inc.lijst()[0];
  assert.equal(i.status, 'hersteld', 'de machine sloot het incident zelf');
  assert.ok(i.hersteldAt, 'het moment van herstellen staat er niet bij');
  assert.equal(t.inc.tel().wachtOpVerslag, 1);
  assert.equal(t.inc.tel().gesloten, 0);
});

test('4. sluiten kan niet terwijl het nog stuk is', () => {
  const t = opstelling({ betalen: 'storing' });
  const id = t.inc.weeg('de toets').nieuw[0];
  const r = t.inc.sluit(id, { verslag: 'het leek me wel klaar zo', door: 'iemand' });
  assert.equal(r.status, 409, 'een lopende storing liet zich gewoon afsluiten');
  assert.equal(t.inc.lijst()[0].status, 'open');
});

test('5. maar het kan wel met "toch", en dat staat in het verslag', () => {
  const t = opstelling({ betalen: 'storing' });
  const id = t.inc.weeg('de toets').nieuw[0];
  const r = t.inc.sluit(id, { verslag: 'bekend probleem bij de leverancier, buiten ons bereik',
    door: 'iemand', toch: true, reden: 'wij kunnen hier niets meer aan doen' });
  assert.ok(!r.error, r.error);
  assert.equal(r.incident.status, 'gesloten');
  assert.equal(r.incident.verslag.geslotenBovenEenStoring, true, 'het verslag verzwijgt dat het nog stuk was');
  assert.equal(r.incident.verslag.reden, 'wij kunnen hier niets meer aan doen');
});

test('6. een verslag is verplicht', () => {
  const t = opstelling({ betalen: 'storing' });
  const id = t.inc.weeg('de toets').nieuw[0];
  for (const verslag of ['', '   ', 'ok']) {
    const r = t.inc.sluit(id, { verslag, door: 'iemand', toch: true, reden: 'x' });
    assert.equal(r.status, 400, 'een incident sloot met verslag "' + verslag + '"');
  }
});

test('7. de impact is gemeten, en wat niet te meten is staat erbij', () => {
  const t = opstelling({ betalen: 'storing' });
  const id = t.inc.weeg('de toets').nieuw[0];
  const d = t.inc.dossier(id);
  const im = d.bijAanvang.impact;
  assert.deepEqual(im.gemeten[0].getallen, { verzoeken: 440, fouten5xx: 40 });
  const namen = im.nietGemeten.map(n => n.wat);
  assert.ok(namen.some(n => /verloren/.test(n)), 'verlies staat niet als niet-gemeten');
  assert.ok(namen.some(n => /dubbel/.test(n)), 'dubbele verwerking staat niet als niet-gemeten');
  /* LEDEN blijven niet-gemeten: de meting draagt geen lid en er is geen tweede
     register voor. ORGANISATIES zijn dat sinds 24 augustus niet meer -- daar
     staat een ONDERGRENS (server/meting-tenant.js). Die twee horen niet meer
     onder dezelfde noemer te staan, want ze zijn niet meer hetzelfde. */
  assert.ok(namen.some(n => /LEDEN/i.test(n)), 'de geraakte leden staan niet als niet-gemeten');
  assert.equal(namen.some(n => /^hoeveel leden of organisaties/i.test(n)), false,
    'leden en organisaties staan nog onder één noemer terwijl er voor organisaties wel iets gemeten wordt');
  for (const n of im.nietGemeten) assert.ok(n.waarom && n.waarom.length > 30, n.wat + ' heeft geen reden');

  /* En de ondergrens staat APART van de gewone getallen, met zijn grens erbij.
     Tussen de gezondheidscijfers zou hij als een even hard getal lezen. */
  const og = im.gemetenOndergrens;
  assert.ok(og && typeof og.gemeten === 'boolean', 'er staat geen ondergrens: ' + JSON.stringify(og));
  if (og.gemeten) {
    assert.equal(typeof og.organisatiesMinstens, 'number');
    assert.match(og.let, /ONDERGRENS/);
    assert.match(og.let, /geen beschikbaarheidscijfer/);
  } else {
    assert.ok(og.waarom && og.waarom.length > 20, 'niet gemeten zonder reden: ' + JSON.stringify(og));
  }
  /* En er staat nergens een nul die niemand heeft geteld. */
  const tekst = JSON.stringify(im);
  assert.ok(!/"verloren"|"dubbel"\s*:\s*0/.test(tekst), 'er staat een geteld ogende nul in de impact');
});

test('8. de oorzaak is een aanleiding en geen feit', () => {
  const t = opstelling({ betalen: 'storing' });
  const id = t.inc.weeg('de toets').nieuw[0];
  const a = t.inc.dossier(id).bijAanvang.aanleidingen;
  assert.equal(a.lijst.length, 1);
  assert.equal(a.lijst[0].bron, 'meting');
  assert.match(a.let, /AANLEIDINGEN en geen oorzaak/);
  assert.ok(!/oorzaak:/.test(JSON.stringify(a.lijst)), 'er staat een oorzaak als feit in de lijst');

  /* Een storing zonder enige bevinding met een oordeel: dan is er geen
     aanleiding, en dat is een uitslag. */
  const leeg = opstelling({ betalen: 'storing' }, { betalen: [] });
  const id2 = leeg.inc.weeg('de toets').nieuw[0];
  const a2 = leeg.inc.dossier(id2).bijAanvang.aanleidingen;
  assert.deepEqual(a2.lijst, []);
  assert.equal(a2.zekerheid, 'geen aanleiding gevonden');
  assert.match(a2.let, /geen reden om er een te verzinnen/);

  /* En leunt het op iets dat ook stuk is, dan is DAT de sterkere kandidaat --
     met de zin erbij dat gelijktijdigheid geen oorzaak is. */
  const keten = opstelling({ betalen: 'storing', sporen: 'storing' }, { betalenGeraakt: ['sporen'] });
  const id3 = keten.inc.weeg('de toets').nieuw.find(x => keten.inc.dossier(x).vermogen === 'betalen');
  const a3 = keten.inc.dossier(id3).bijAanvang.aanleidingen;
  assert.ok(a3.lijst.some(x => x.soort === 'keten'), 'de keten staat niet bij de aanleidingen');
  assert.match(a3.zekerheid, /kan het gevolg zijn/);
});

test('9. de momentopname bij het ontstaan blijft staan', () => {
  const t = opstelling({ betalen: 'storing' });
  const id = t.inc.weeg('de toets').nieuw[0];
  t.zet({ betalen: 'in orde' });
  t.inc.weeg('de toets');
  const d = t.inc.dossier(id);
  assert.equal(d.bijAanvang.impact.oordeel, 'storing', 'de momentopname is meegelopen met de werkelijkheid');
  assert.equal(d.nu.oordeel, 'in orde', 'de stand van nu staat er niet naast');
  assert.equal(d.bijAanvang.impact.gemeten[0].getallen.fouten5xx, 40);
});

test('de maatregelen verwijzen en vertellen niet na', () => {
  const t = opstelling({ betalen: 'storing' });
  const id = t.inc.weeg('de toets').nieuw[0];
  assert.equal(t.inc.maatregel(id, { wat: '', door: 'iemand' }).status, 400, 'een lege maatregel werd genoteerd');
  const r = t.inc.maatregel(id, { wat: 'herstelronde gedraaid', soort: 'herstel',
    verwijzing: 'run-123', door: 'iemand' });
  assert.equal(r.incident.maatregelen, 1);
  const d = t.inc.dossier(id);
  assert.equal(d.maatregelen[0].verwijzing, 'run-123', 'de maatregel wijst nergens naar');
  assert.ok(t.regels.some(x => x.actie === 'incident maatregel'));
});
