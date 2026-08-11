/* De levenslijn (LEVEN.md par. 1.1, fase 1): EEN lijn door een leven in plaats
   van vijf leeftijdshokjes.

   Deze toetsen bespelen de MOTOR rechtstreeks met een nagemaakte kern, en niet
   over een route. Dat is hier geen gemakzucht maar de enige manier om de vraag
   te stellen die ertoe doet: wat doet de lijn bij een lid waarvan een bron
   niets weet, of stukgaat, of iets uit de toekomst aanlevert? Die drie
   toestanden zijn over een echte server niet te maken zonder er data voor te
   verzinnen die daar niet hoort. De bronnen zelf (onderwijs, entourage,
   werkrollen) hebben hun eigen toetsen.

   Wat hier bewaakt wordt is niet in de eerste plaats of de lijn KLOPT, maar of
   hij zich aan de grenzen van LEVEN.md par. 2 houdt: geen norm, geen
   rangschikking, geen verzonnen fase, geen kindernaam, en geen bron die stil
   wegvalt.

   Elke toets is tegen een tijdelijk kapotgemaakte motor gezien zakken (LAT.md
   regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --test test/levenslijn.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakLevenslijn = require('../server/kern/levenslijn');
const { FASEN: LADDER } = require('../server/kern/onderwijs-ladder');

/* De tien fasen zoals LEVEN.md par. 1.1 ze opsomt, hier LETTERLIJK overgetikt
   en niet uit ./fasen.js gelezen. Dat is met opzet: een toets die zijn
   verwachting uit het bestand haalt dat hij toetst, kan niet zakken (LAT.md
   regel 9). Wie een fase hernoemt, hoort deze regel tegen te komen. */
const TIEN = ['geboorte', 'opvang', 'basisschool', 'middelbaar', 'studie',
  'werk', 'relatie', 'kinderen', 'zaak', 'pensioen'];

const KIND_NAAM = 'Wilhelmina Petronella Vandenbroeke';

const LEEG = {
  paspoortGeboortejaarVan: () => null,
  onderwijs: { FASEN: LADDER, mijn: () => ({ ok: true, fase: null, jaar: 1, historie: [] }) },
  accRollen: () => ({ rollen: [] }),
  metier: { profielVan: () => ({ rollen: [] }) },
  entourage: () => ({ gezelschap: [] }),
  rtf: { groepen: () => [{ id: 'mini', naam: 'Allerkleinsten', bereik: '0 t/m 4 jaar' }] },
  levensgraaf: { tower: () => ({ achterstallig: [], vensters: [] }) }
};

const motor = (over) => maakLevenslijn({ kern: Object.assign({}, LEEG, over || {}) }).levenslijn;
const faseUit = (l, id) => l.fasen.find(f => f.id === id);

/* Een leven waarin echt iets speelt: vwo afgerond, aan een universitaire
   master bezig, een bewezen werkrol, een partner en twee kinderen. */
const VOL = {
  paspoortGeboortejaarVan: () => 1994,
  onderwijs: { FASEN: LADDER, mijn: () => ({ ok: true,
    fase: { id: 'wo-m', trap: 'wo', naam: 'Universitaire master' }, jaar: 1,
    historie: [
      { van: 'po-g8', naar: 'vwo', op: '2006-08-15T10:00:00.000Z' },
      { van: 'vwo', naar: 'wo-b', op: '2012-09-01T10:00:00.000Z' },
      { van: 'wo-b', naar: 'wo-m', op: '2015-09-01T10:00:00.000Z' }
    ] }) },
  accRollen: () => ({ rollen: [{ rol: 'personeel', code: 'ZEN', naam: 'Sommelier',
    zaakNaam: 'Huis Vega', sinds: '2016-04-01T09:00:00.000Z' }] }),
  entourage: () => ({ gezelschap: [
    { band: 'partner', naam: 'Anders Iemand' },
    { band: 'kind', naam: KIND_NAAM },
    { band: 'kind', naam: 'Tweede Kind' }
  ] })
};

/* 1. EEN LEEG LEVEN IS EEN COMPLEET LEVEN. Weet geen enkele bron iets, dan
   staan alle tien op 'nvt' -- niet op 'komt', want dat zou zeggen dat er nog
   iets moet gebeuren, en dat is de norm die par. 2.2 verbiedt.
   Mutatie gezien: in bouwFase de beginstaat 'nvt' vervangen door 'komt'. */
test('zonder aanwijzing is elke fase nvt, en nooit komt', () => {
  const l = motor().lijn('user-leeg');
  assert.equal(l.fasen.length, TIEN.length);
  for (const f of l.fasen) {
    assert.equal(f.staat, 'nvt', f.id + ' hoort nvt te zijn zonder aanwijzing');
    assert.equal(f.vanaf, null);
    assert.deepEqual(f.gegevens, []);
  }
  assert.deepEqual(l.nu, { faseId: null, sinds: null });
  assert.deepEqual(l.stil, []);
});

/* 2. DE SERVER SNIJDT NIET. Alle tien komen altijd terug, in de volgorde van
   LEVEN.md par. 1.1; het WEGLATEN van 'nvt' is een schermkeuze. Een server die
   alvast filtert, maakt van een weergavekeuze een besluit.
   Mutatie gezien: `.filter(f => f.staat !== 'nvt')` in lijn(). */
test('de lijn geeft altijd alle tien de fasen terug, in de vaste volgorde', () => {
  assert.deepEqual(motor().lijn('a').fasen.map(f => f.id), TIEN);
  assert.deepEqual(motor(VOL).lijn('b').fasen.map(f => f.id), TIEN);
});

/* 3. DE AANWIJZINGEN KOMEN OP DE JUISTE FASE, met het jaar waarvoor bewijs is.
   Basisschool krijgt GEEN beginjaar: er is alleen een overstap eruit bekend, en
   de lijn doet niet alsof hij weet wanneer groep 1 begon.
   Mutatie gezien: TRAP_FASE.vo van 'middelbaar' naar 'studie' gezet. */
test('onderwijs, werk en entourage landen elk op hun eigen fase', () => {
  const l = motor(VOL).lijn('user-vol');
  assert.equal(faseUit(l, 'geboorte').vanaf, 1994);
  assert.equal(faseUit(l, 'basisschool').staat, 'geweest');
  assert.equal(faseUit(l, 'basisschool').vanaf, null);
  assert.equal(faseUit(l, 'middelbaar').staat, 'geweest');
  assert.equal(faseUit(l, 'middelbaar').vanaf, 2006);
  assert.equal(faseUit(l, 'studie').staat, 'nu');
  assert.equal(faseUit(l, 'studie').vanaf, 2012);
  assert.equal(faseUit(l, 'studie').sinds, '2015-09-01');
  assert.equal(faseUit(l, 'werk').staat, 'nu');
  assert.equal(faseUit(l, 'werk').vanaf, 2016);
  assert.equal(faseUit(l, 'relatie').staat, 'nu');
  assert.equal(faseUit(l, 'kinderen').staat, 'nu');
  // en wat niemand heeft aangetoond blijft leeg, ook in een vol leven
  assert.equal(faseUit(l, 'zaak').staat, 'nvt');
  assert.equal(faseUit(l, 'pensioen').staat, 'nvt');
  // elke bewering draagt zijn gegevens (par. 2.10)
  for (const f of l.fasen.filter(x => x.staat !== 'nvt')) assert.ok(f.gegevens.length >= 1, f.id);
});

/* 4. EEN KIND IS GEEN PROFIEL (par. 2.1). De fase 'kinderen' telt en schrijft
   niet uit: geen naam uit Entourage haalt dit antwoord, ook niet in de
   uitleg-gegevens. Getoetst op het HELE antwoord en niet op een veld, want de
   volgende lek zit in het veld waar je niet naar keek.
   Mutatie gezien: `wat` in de entourage-bron de namen laten opsommen. */
test('geen naam uit Entourage verlaat de levenslijn, wel de telling', () => {
  const l = motor(VOL).lijn('user-vol');
  const alles = JSON.stringify(l);
  assert.ok(!alles.includes(KIND_NAAM), 'er staat een kindernaam in de levenslijn');
  assert.ok(!alles.includes('Anders Iemand'), 'er staat een partnernaam in de levenslijn');
  assert.match(faseUit(l, 'kinderen').gegevens.join(' '), /2 kinderen/);
  assert.match(faseUit(l, 'relatie').gegevens.join(' '), /1 partner/);
});

/* 5. NIETS SLAAT STIL OVER (LAT.md regel 5). Een bron die gooit komt met naam
   in stil[] en neemt de andere niet mee -- een lege lijn leest als een leeg
   leven, en dat is de ergste onwaarheid die dit scherm kan vertellen.
   Mutatie gezien: de catch in hulp.bron() leeggemaakt. */
test('een stukke bron staat met naam in stil, de rest van de lijn blijft', () => {
  const l = motor(Object.assign({}, VOL, {
    entourage: () => { throw new Error('boem'); }
  })).lijn('user-stuk');
  assert.deepEqual(l.stil, ['entourage']);
  assert.equal(faseUit(l, 'studie').staat, 'nu', 'de andere bronnen horen door te lopen');
  assert.equal(faseUit(l, 'kinderen').staat, 'nvt');
  assert.ok(l.bronnen.includes('entourage'));
});

/* 6. DE LADDER IS GEEN NORM. Iemand op het vwo krijgt 'studie' NIET als
   'komt', ook al kent de doorstroomkaart die route. "Dit komt nog voor u" is
   geen waarneming maar een verwachting over andermans leven (par. 2.2/2.7).
   Mutatie gezien: in de onderwijs-bron een aanwijzing voor p.verder.doorstroom
   toegevoegd met een jaartal in de toekomst. */
test('een schoolladder levert geen komt op: wie op vwo zit, mist geen studie', () => {
  const l = motor(Object.assign({}, VOL, {
    onderwijs: { FASEN: LADDER, mijn: () => ({ ok: true,
      fase: { id: 'vwo', trap: 'vo', naam: 'Vwo (atheneum/gymnasium)' }, jaar: 5, historie: [],
      verder: { volgende: null, doorstroom: ['wo-b', 'hbo-b'], via: null } }) }
  })).lijn('user-vwo');
  assert.equal(faseUit(l, 'middelbaar').staat, 'nu');
  assert.equal(faseUit(l, 'studie').staat, 'nvt');
  assert.ok(!l.fasen.some(f => f.staat === 'komt'));
});

/* 7. EN TOCH IS 'komt' BEREIKBAAR, zodat het geen dode staat is (LAT.md regel
   9): een rol met een BEWEZEN startdatum die nog moet aanbreken. Het verschil
   met toets 6 is precies de bedoeling: een datum die de mens zelf heeft laten
   vastleggen mag vooruitkijken, een ladder niet.
   Mutatie gezien: staatVan() de vergelijking met het huidige jaar afgenomen. */
test('een bewezen startdatum in de toekomst geeft komt, geen nu', () => {
  const jaar = new Date().getFullYear() + 5;
  const l = motor({ accRollen: () => ({ rollen: [{ rol: 'zaak', code: 'X',
    zaakNaam: 'Atelier Nord', sinds: jaar + '-01-05T09:00:00.000Z' }] }) }).lijn('user-straks');
  const z = faseUit(l, 'zaak');
  assert.equal(z.staat, 'komt');
  assert.equal(z.vanaf, jaar);
  assert.equal(l.nu.faseId, null, 'een fase die nog moet komen is niet wat er nu speelt');
});

/* 8. NOOIT VERGELIJKEND (par. 2.4). Er komt geen getal uit deze laag dat een
   mens rangschikt: geen score, geen percentiel, geen "x van de 10 fasen af".
   De telling die er WEL is, telt gebeurtenissen en geen mensen.
   Mutatie gezien: `af: fasen.filter(f => f.staat === 'geweest').length` aan het
   antwoord toegevoegd. */
test('er komt geen cijfer uit dat mensen rangschikt', () => {
  const antwoord = JSON.stringify(motor(VOL).feiten('user-vol'));
  for (const woord of ['score', 'percentiel', 'rang', 'voortgang', 'niveau', '"af"', 'compleetheid']) {
    assert.ok(!antwoord.includes(woord), 'de levenslijn levert een rangschikkend begrip: ' + woord);
  }
  const f = motor(VOL).feiten('user-vol');
  assert.deepEqual(Object.keys(f.telling).sort(), ['achterstallig', 'komt', 'speelt']);
});

/* 9. DE TERMIJNEN WORDEN NIET NAGETELD. De vier vensters plus achterstallig
   komen ongewijzigd uit kern/levensgraaf/termijnen.js; die motor kent al de
   regel dat een termijn in het EERSTE passende venster valt. Hem hier
   nabouwen zou een tweede telling geven die stil uit de pas loopt (regel 4).
   Mutatie gezien: alleen het eerste venster in komt[] opgenomen. */
test('feiten neemt de vensters van de levensgraaf over en telt ze niet zelf', () => {
  const rij = (id, dagen) => ({ id, naam: 'ding ' + id, wat: 'verzekering', bron: 'Logboek',
    datum: '2026-09-01', dagen, waarvan: 'Villa', zwaar: true });
  const f = motor(Object.assign({}, VOL, { levensgraaf: { tower: () => ({
    achterstallig: [rij('a', -12)],
    vensters: [{ sleutel: 'week', items: [rij('b', 3)] }, { sleutel: 'maand', items: [rij('c', 20)] },
      { sleutel: 'kwartaal', items: [] }, { sleutel: 'jaar', items: [rij('d', 200)] }]
  }) } })).feiten('user-vol');
  assert.deepEqual(f.komt.map(r => r.id), ['b', 'c', 'd']);
  assert.deepEqual(f.komt.map(r => r.venster), ['week', 'maand', 'jaar']);
  assert.equal(f.achterstallig.length, 1);
  assert.equal(f.telling.komt, f.komt.length);
  assert.equal(f.telling.achterstallig, f.achterstallig.length);
  assert.equal(f.telling.speelt, f.speelt.length);
  assert.ok(f.speelt.every(s => s.id !== 'geboorte'), 'geweest is niet wat er nu speelt');
});

/* 11. WERK DAT VOORBIJ IS, IS VOORBIJ. Een zelf opgegeven metier-rol met een
   eindjaar levert 'geweest' en niet 'nu'; loopt er daarnaast nog een rol
   zonder eindjaar, dan wint 'nu'. Het jaar is dat van de VROEGSTE aanwijzing,
   want dat is het jaar waarvoor bewijs bestaat.
   Mutatie gezien: in de metier-bron de staat vast op 'nu' gezet. */
test('een afgeronde zelf opgegeven baan geeft geweest, een lopende geeft nu', () => {
  const rollen = (lijst) => motor({ metier: { profielVan: () => ({ rollen: lijst }) } }).lijn('user-werk');
  const klaar = faseUit(rollen([{ wat: 'Gids', waar: 'Bureau Noord', van: 2018, tot: 2021 }]), 'werk');
  assert.equal(klaar.staat, 'geweest');
  assert.equal(klaar.vanaf, 2018);
  const nog = faseUit(rollen([
    { wat: 'Gids', waar: 'Bureau Noord', van: 2018, tot: 2021 },
    { wat: 'Coach', waar: 'Eigen praktijk', van: 2022, tot: null }
  ]), 'werk');
  assert.equal(nog.staat, 'nu');
  assert.equal(nog.vanaf, 2018);
  // een rol zonder ingevuld jaar levert geen verzonnen jaartal op
  assert.equal(faseUit(rollen([{ wat: 'Coach', waar: '', van: null, tot: null }]), 'werk').vanaf, null);
});

/* 10. EEN STUKKE CONTROL TOWER MAAKT DE COCKPIT NIET LEEG maar zichtbaar
   onvolledig, en de fasen blijven staan.
   Mutatie gezien: de try om kern.levensgraaf.tower() weggehaald. */
test('valt de levensgraaf weg, dan blijft de lijn staan en meldt feiten dat', () => {
  const f = motor(Object.assign({}, VOL, {
    levensgraaf: { tower: () => { throw new Error('boem'); } }
  })).feiten('user-vol');
  assert.ok(f.stil.includes('levensgraaf'));
  assert.deepEqual(f.komt, []);
  assert.ok(f.speelt.length >= 1, 'wat er speelt hangt niet aan de termijnen');
});
