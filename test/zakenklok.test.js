/* DE ZAKENKLOK: WANNEER BEGINT EEN DAG VOOR DIT BEDRIJF?

   Er staan 195 plekken in de kern die "vandaag" uitrekenen als de KALENDERdag.
   Voor een strandclub die om drie uur 's nachts sluit is dat het verkeerde
   antwoord: alles tussen middernacht en sluitingstijd valt dan op de verkeerde
   dag. server/kern/zakenklok/ beantwoordt de vraag daarna -- bij welke periode
   hoort dit moment, gegeven wat DEZE zaak heeft ingesteld.

   Deze toets bewaakt vijf dingen, en de eerste is de reden dat het een register
   is en geen lijst van vier:

     1. een VIJFDE soort komt erbij zonder dat er iets aan de kern verandert
     2. de zaak overschrijft het voorstel van RTG, en RTG neemt dat niet terug
     3. de omslag rekent in LOKALE tijd, ook over een zomertijdgrens heen
     4. een onleesbare instelling valt NIET stil terug op de kalenderdag
     5. de perioden liggen aaneengesloten: geen moment valt tussen twee periodes
        in en geen moment valt in twee tegelijk
*/
const test = require('node:test');
const assert = require('node:assert');
const zk = require('../server/kern/zakenklok');

const zaak = (type, land, klok) => ({ type, settings: { land, klok: klok || {} } });
const CLUB_ES = zaak('club', 'ES');
const WINKEL_NL = zaak('winkel', 'NL');

test('een club en een winkel op hetzelfde moment zitten op een andere dag', () => {
  /* 01:30 UTC is 03:30 in Madrid. De club sluit om 05:00, dus dat hoort nog bij
     de avond ervoor. Voor de winkel is het gewoon de nieuwe dag. Dit is het hele
     probleem in een regel. */
  assert.equal(zk.periode(CLUB_ES, 'horecadag', '2026-08-24T01:30:00Z').sleutel, '2026-08-23');
  assert.equal(zk.periode(WINKEL_NL, 'horecadag', '2026-08-24T01:30:00Z').sleutel, '2026-08-24');
  /* En andersom: 22:30 UTC is in Amsterdam al de volgende dag (00:30), maar in
     Madrid ook -- en daar valt hij door de omslag terug op de 24e. */
  assert.equal(zk.periode(WINKEL_NL, 'horecadag', '2026-08-24T22:30:00Z').sleutel, '2026-08-25');
  assert.equal(zk.periode(CLUB_ES, 'horecadag', '2026-08-24T22:30:00Z').sleutel, '2026-08-24');
});

test('de zaak overschrijft het voorstel van RTG, en RTG neemt dat niet terug', () => {
  const eigenwijs = zaak('club', 'ES', { horecadag: { omslag: '00:00' } });
  assert.equal(zk.instellingVan(CLUB_ES, 'horecadag').omslag, '05:00', 'RTG stelt 05:00 voor bij een club');
  assert.equal(zk.instellingVan(eigenwijs, 'horecadag').omslag, '00:00', 'maar de zaak mag dat overschrijven');
  assert.equal(zk.periode(eigenwijs, 'horecadag', '2026-08-24T01:30:00Z').sleutel, '2026-08-24');

  const k = zk.keuzeVan(eigenwijs, 'horecadag');
  assert.equal(k.eigenKeuze, true, 'een scherm hoort te zien DAT dit een eigen keuze is');
  assert.equal(k.standaard.omslag, '05:00', 'en wat het voorstel van RTG was');
  assert.equal(zk.keuzeVan(CLUB_ES, 'horecadag').eigenKeuze, false,
    'een zaak die niets instelde heeft geen eigen keuze -- dat verschil bepaalt of iemand hem durft aan te raken');
});

test('de omslag rekent in LOKALE tijd, ook over de zomertijdgrens heen', () => {
  /* In 2026 gaat de Europese klok op 25 oktober terug van 03:00 naar 02:00. Een
     vaste verschuiving van twee uur klopt precies tot dat moment en daarna niet
     meer. Twee momenten, een aan elke kant van de grens, allebei om 03:30 LOKAAL. */
  const club = zaak('club', 'NL');                       // omslag 05:00
  const voor = zk.periode(club, 'horecadag', '2026-10-25T01:30:00Z');   // 03:30 CEST
  const na = zk.periode(club, 'horecadag', '2026-10-26T02:30:00Z');     // 03:30 CET
  assert.equal(voor.sleutel, '2026-10-24', 'zomertijd: 03:30 lokaal hoort nog bij de 24e');
  assert.equal(na.sleutel, '2026-10-25', 'wintertijd: 03:30 lokaal hoort bij de 25e');
  /* De tegenproef op de tijdzone zelf: dezelfde UTC-tijd, twee landen. Zou de
     zone genegeerd worden, dan stond hier twee keer hetzelfde. */
  const a = zk.periode(zaak('winkel', 'NL'), 'horecadag', '2026-08-24T22:30:00Z').sleutel;
  const b = zk.periode(zaak('winkel', 'GB'), 'horecadag', '2026-08-24T22:30:00Z').sleutel;
  assert.notEqual(a, b, 'Nederland is dan al over middernacht en het Verenigd Koninkrijk niet');
});

test('een onleesbare instelling valt NIET stil terug op de kalenderdag', () => {
  /* Een tikfout in een instelling ("4:00 uur", "vier uur") mag niet stilletjes
     de omslag op nul zetten -- dan telt de zaak maandenlang verkeerd zonder dat
     iemand het merkt (LAT-regel 5). Hij valt terug op de STANDAARD van de soort,
     niet op nul. */
  const stuk = zaak('club', 'ES', { horecadag: { omslag: 'vier uur' } });
  assert.equal(zk.instellingVan(stuk, 'horecadag').omslag, '05:00',
    'een onleesbare waarde wordt GENEGEERD alsof hij niet was ingevuld -- dus geldt weer wat RTG voorstelt, ' +
    'en niet 00:00. Zou hij op nul terugvallen, dan telt deze zaak maandenlang op de kalenderdag zonder ' +
    'dat iemand het merkt.');
  assert.equal(zk.periode(stuk, 'horecadag', '2026-08-24T01:30:00Z').sleutel, '2026-08-23');
  assert.deepEqual(zk.keuzeVan(stuk, 'horecadag').ongeldig, ['omslag'],
    'en het scherm hoort te KUNNEN zien welk veld werd genegeerd; stil negeren is net zo erg als stil raden');
  assert.equal(zk.instellingVan(zaak('club', 'ES', { horecadag: { omslag: '25:00' } }), 'horecadag').omslag,
    '05:00', 'een onmogelijk uur idem');
  /* En de tegenproef: een GELDIGE waarde hoort gewoon te blijven staan. Zonder
     deze bewering zou een keurder die alles afkeurt hier ook doorheen komen. */
  const goed = zaak('club', 'ES', { horecadag: { omslag: '02:00' } });
  assert.equal(zk.instellingVan(goed, 'horecadag').omslag, '02:00');
  assert.deepEqual(zk.keuzeVan(goed, 'horecadag').ongeldig, []);
});

test('een VIJFDE soort komt erbij zonder dat er iets aan de kern verandert', () => {
  /* Dit is de bewering waar het register voor bestaat. Zou hier een lijst van
     vier staan, dan zou een vaarseizoen of een ploegendienst een wijziging in de
     kern kosten -- en dan is het geen register maar een vergaarbak. */
  const sleutel = 'zzproef' + process.pid;
  zk.meld({
    sleutel, naam: 'Proefperiode', uitleg: 'alleen voor de toets',
    standaard: { blok: 10 },
    periodeVan: (datum, instelling, h) => {
      const d = h.delenIn(datum, h.zone);
      const n = Math.floor((d.dag - 1) / instelling.blok);
      return { sleutel: h.isoDag(d.jaar, d.maand, 1) + '#' + n, label: 'blok ' + n };
    }
  });
  assert.ok(zk.soorten().some(s => s.sleutel === sleutel), 'de nieuwe soort staat in het register');
  assert.equal(zk.periode(WINKEL_NL, sleutel, '2026-08-24T12:00:00Z').sleutel, '2026-08-01#2');
  const eigen = zaak('winkel', 'NL', { [sleutel]: { blok: 5 } });
  assert.equal(zk.periode(eigen, sleutel, '2026-08-24T12:00:00Z').sleutel, '2026-08-01#4',
    'en de zaak kan hem net zo goed instellen als de vier ingebouwde -- anders is de nieuwe soort tweederangs');

  /* Een half aangemelde soort hoort METEEN te weigeren en niet pas als iemand er
     een periode uit vraagt: dan staat er een verkeerd getal op een scherm in
     plaats van een fout in de log. */
  assert.throws(() => zk.meld({ sleutel: 'zz-half', naam: 'x', uitleg: 'y' }), /standaard/);
  assert.throws(() => zk.meld({ sleutel, naam: 'x', uitleg: 'y', standaard: {}, periodeVan: () => ({}) }),
    /bestaat al/, 'twee soorten met dezelfde sleutel is een botsing en geen overschrijving');
});

test('de boekhoudkwartalen tellen vanaf het BOEKJAAR en niet vanaf januari', () => {
  /* Een schoolbedrijf begint zijn boekjaar in augustus. Wie hier
     Math.ceil(maand/3) zou schrijven, telt de kalenderkwartalen en geeft zo'n
     zaak stil het verkeerde vak -- een fout die pas bij de jaarrekening opvalt. */
  const z = zaak('winkel', 'NL', { boekhoudperiode: { eenheid: 'kwartaal', boekjaarStart: 8 } });
  assert.equal(zk.periode(z, 'boekhoudperiode', '2026-08-24T12:00:00Z').sleutel, '2026-K1');
  assert.equal(zk.periode(z, 'boekhoudperiode', '2026-11-01T12:00:00Z').sleutel, '2026-K2');
  assert.equal(zk.periode(z, 'boekhoudperiode', '2027-02-01T12:00:00Z').sleutel, '2026-K3');
  assert.equal(zk.periode(z, 'boekhoudperiode', '2026-07-31T12:00:00Z').sleutel, '2025-K4',
    'de dag voor de boekjaarstart hoort nog bij het vorige boekjaar');
});

test('de vierwekelijkse loonperiode blijft ook VOOR de ankerdag vier weken lang', () => {
  /* Math.floor en geen afkapping: voor een datum voor het anker is het quotient
     negatief, en dan rondt afkappen de verkeerde kant op -- periode 0 zou twee
     keer zo lang worden als alle andere. Precies de soort fout die je pas ziet
     als iemand met terugwerkende kracht een loonstrook opvraagt. */
  const z = zaak('winkel', 'NL', { payrollperiode: { eenheid: 'vierwekelijks', ankerdag: '2026-01-05' } });
  const lengtes = new Set();
  for (let i = -5; i < 5; i++) {
    const dag = new Date(Date.UTC(2026, 0, 5 + i * 28));
    const p = zk.periode(z, 'payrollperiode', dag.toISOString());
    lengtes.add((Date.parse(p.totLokaal) - Date.parse(p.vanLokaal)) / 86400000);
  }
  assert.deepEqual([...lengtes], [28], 'elke periode hoort 28 dagen te zijn, ook de negatieve: ' + [...lengtes]);
});

test('de perioden liggen aaneengesloten: geen gat en geen overlap', () => {
  /* Over een half jaar, per uur, van elke soort de sleutel opvragen en kijken of
     hij monotoon verandert. Een gat (een moment zonder periode) en een overlap
     (twee perioden voor hetzelfde moment) zijn allebei stil: er komt geen fout,
     er staat alleen een omzet op de verkeerde plek. */
  const z = zaak('club', 'NL');
  for (const soort of ['horecadag', 'boekhoudperiode', 'payrollperiode', 'schooldag']) {
    let vorige = null, wisselingen = 0;
    for (let u = 0; u < 24 * 180; u++) {
      const moment = new Date(Date.UTC(2026, 0, 1, u)).toISOString();
      const p = zk.periode(z, soort, moment);
      assert.ok(p && p.sleutel, soort + ': elk moment hoort een periode te hebben (' + moment + ')');
      if (vorige !== null && p.sleutel !== vorige) wisselingen++;
      vorige = p.sleutel;
    }
    assert.ok(wisselingen > 0, soort + ': de periode hoort in een half jaar minstens EEN keer te wisselen; ' +
      'staat hij stil, dan is het geen periode maar een constante');
  }
});
