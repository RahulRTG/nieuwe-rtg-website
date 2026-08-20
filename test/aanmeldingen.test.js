/* Aanmeldingen (kern/aanmeldingen.js): de aanmelding per pas is geheel
   geautomatiseerd, behalve de menselijke ja/nee. De AI kent NOOIT zelf
   Lifestyle/Business toe. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);

function maak() {
  const db = { data: {} };
  const geldPasprijzen = () => ({ passen: { rtg: { maandCenten: 6500 }, lifestyle: { maandCenten: 2000000 } } });
  return require('../server/kern/aanmeldingen')({ db, save: () => {}, crypto, schoon, geldPasprijzen }).aanmeldingen;
}

test('een aanmelding krijgt automatisch de hele reis en wacht op de mens', () => {
  const a = maak();
  const r = a.aanvraag({ pas: 'rtg', naam: 'Amber', contact: 'amber@example.com' });
  assert.equal(r.ok, true);
  assert.equal(r.aanmelding.status, 'in behandeling');
  // de zes geautomatiseerde stappen staan er en zijn allemaal door de AI gedaan
  const ids = r.aanmelding.reis.map(s => s.id);
  for (const stap of ['welkom', 'onboarding', 'rondleiding', 'rtf', 'security', 'privacy'])
    assert.ok(ids.includes(stap), stap + ' zit in de reis');
  assert.ok(r.aanmelding.reis.every(s => s.auto === true), 'elke stap is geautomatiseerd');
});

test('de toon draait mee met de pas (je voor RTG, u voor Business)', () => {
  const a = maak();
  const rtg = a.aanvraag({ pas: 'rtg', naam: 'Sam' }).aanmelding;
  const biz = a.aanvraag({ pas: 'business', naam: 'Dr. Vos' }).aanmelding;
  assert.match(rtg.reis.find(s => s.id === 'security').tekst, /\bje\b/);
  assert.match(biz.reis.find(s => s.id === 'security').tekst, /\bu\b/);
});

test('alleen een mens (met naam) beslist; de AI kan Lifestyle/Business nooit toekennen', () => {
  const a = maak();
  assert.equal(a.magAutomatischToekennen('lifestyle'), false);
  assert.equal(a.magAutomatischToekennen('business'), false);
  assert.equal(a.magAutomatischToekennen('rtg'), false);

  const life = a.aanvraag({ pas: 'lifestyle', naam: 'Gast' }).aanmelding;
  /* ZONDER HERLEIDBAAR PERSOON GEEN LIFESTYLE- OF BUSINESS-BESLUIT.

     Dit stond op 400 (ontbrekend veld). Het is 403 geworden, en dat is de
     juistere code: de beller IS ingelogd op de backoffice, hij is alleen niet
     herleidbaar -- hij gebruikt de gedeelde kantoorcode, en die is geen mens.
     De merkregel zegt dat deze twee passen uitsluitend na MENSELIJKE
     goedkeuring ontstaan, en achteraf moet te zeggen zijn wie dat was.

     Waarom dit ertoe deed: de route gaf tot vandaag altijd 'RTG-personeel' mee,
     want officeAuth zet req.session niet. Deze grendel stond er dus wel en werd
     verslagen door een terugval die altijd slaagde. */
  const geweigerd = a.beslis(life.id, 'geaccepteerd', '');
  assert.equal(geweigerd.status, 403, JSON.stringify(geweigerd));
  assert.match(geweigerd.error, /herleidbaar persoon/, 'en het zegt hoe je het wel doet: ' + geweigerd.error);
  // met naam wel
  const ok = a.beslis(life.id, 'geaccepteerd', 'Rahul Imran Ismail', 'Op uitnodiging', { contractEuro: 20000 });
  assert.equal(ok.aanmelding.status, 'geaccepteerd');
  assert.equal(ok.aanmelding.besluit.door, 'Rahul Imran Ismail');
  // en niet twee keer
  assert.equal(a.beslis(life.id, 'afgewezen', 'Iemand').status, 409);

  /* DE RTG PASS LIGT ANDERS. Die staat na de AI-intake voor iedereen open, dus
     daar is een herleidbaar persoon te zwaar. Wel wordt eerlijk genoteerd dat
     het via de gedeelde code ging: beter een spoor dat zegt "we weten het niet"
     dan een spoor dat een persoon verzint. */
  const rtg = a.aanvraag({ pas: 'rtg', naam: 'Gast' }).aanmelding;
  const viaCode = a.beslis(rtg.id, 'geaccepteerd', '');
  assert.equal(viaCode.aanmelding.status, 'geaccepteerd', JSON.stringify(viaCode).slice(0, 140));
  assert.equal(viaCode.aanmelding.besluit.door, 'backoffice (gedeelde code)',
    'geen verzonnen naam, maar de eerlijke vermelding dat het niet te herleiden is');
  assert.doesNotMatch(viaCode.aanmelding.besluit.door, /RTG-personeel/,
    'en zeker niet de oude verzonnen naam die elk besluit droeg');
});

test('na accepteren loopt de betaling 12 maanden automatisch met de 30%-split', () => {
  const a = maak();
  const life = a.aanvraag({ pas: 'lifestyle', naam: 'Gast' }).aanmelding;
  /* De Lifestyle Pass is contractueel (kern/pasladder.js): er is geen
     lijstprijs, dus het afgesproken bedrag hoort bij het besluit. 20.000 is
     hier de bodem en tegelijk wat er is afgesproken. */
  const r = a.beslis(life.id, 'geaccepteerd', 'Rahul Imran Ismail', '', { contractEuro: 20000 });
  assert.equal(r.betaalschema, true);
  const bet = a.betalingen();
  assert.equal(bet.aantalLeden, 1);
  const lid = bet.lidmaatschappen[0];
  assert.equal(lid.termijnen.length, 12, '12 maandtermijnen');
  const t1 = lid.termijnen[0];
  assert.equal(t1.bedrag, 20000);        // Lifestyle 20.000 ex btw p/m
  assert.equal(t1.foundation, 6000);     // 30%
  assert.equal(t1.lokaal, 4000);         // 20%
  assert.equal(t1.rtf, 2000);            // 10%
  // het jaartotaal naar de foundation = 12 x 6000 = 72000
  assert.equal(bet.totaal.foundation, 72000);
  assert.equal(bet.totaal.lokaal, 48000);
  assert.equal(bet.totaal.rtf, 24000);
});

test('afwijzen start geen betaling; Business draagt zijn contractbedrag', () => {
  const a = maak();
  const afw = a.aanvraag({ pas: 'rtg', naam: 'Nee' }).aanmelding;
  a.beslis(afw.id, 'afgewezen', 'Beoordelaar');
  assert.equal(a.betalingen().aantalLeden, 0, 'een afwijzing maakt geen betaalschema');

  /* Dit was ooit "Business is prijs op maat: bedrag nog leeg", en dat leek
     netjes -- tot je je afvraagt wie dat bedrag dan later invult. Niemand: er
     was geen veld. Sinds de ladder hoort het bedrag bij het besluit, dus een
     schema met twaalf lege termijnen kan niet meer ontstaan. */
  const biz = a.aanvraag({ pas: 'business', naam: 'Zaak' }).aanmelding;
  a.beslis(biz.id, 'geaccepteerd', 'Beoordelaar', '', { contractEuro: 7500 });
  const rij = a.betalingen().lidmaatschappen[0];
  const t = rij.termijnen[0];
  assert.equal(t.opMaat, false, 'er IS nu een afgesproken bedrag, dus niets staat meer open');
  assert.equal(t.bedrag, 7500, 'en dat is het contractbedrag, niet de bodem van 5.000');
  assert.equal(t.foundation, 2250, '30% naar de RTFoundation, over het contractbedrag');
  assert.equal(rij.termijnen.filter(x => x.bedrag == null).length, 0,
    'geen enkele termijn blijft leeg');
});

test('de wachtrij telt de openstaande aanmeldingen', () => {
  const a = maak();
  a.aanvraag({ pas: 'rtg', naam: 'Een' });
  a.aanvraag({ pas: 'rtg', naam: 'Twee' });
  const l = a.lijst();
  assert.equal(l.openstaand, 2);
  assert.equal(a.lijst('in behandeling').aanmeldingen.length, 2);
});

/* DE GRENDEL DIE MET DE LADDER MEEKWAM. Een contractuele pas zonder afgesproken
   bedrag levert een lidmaatschap dat loopt terwijl niemand weet wat het kost --
   twaalf termijnen met een leeg bedrag. Accepteren hoort dan te weigeren, met de
   ondergrens in de zin zodat de beoordelaar weet wat hij mist. */
test('een contractuele pas kan niet worden geaccepteerd zonder afgesproken bedrag', () => {
  const a = maak();
  for (const pas of ['lifestyle', 'business']) {
    const aan = a.aanvraag({ pas, naam: 'Zonder bedrag' }).aanmelding;
    const zonder = a.beslis(aan.id, 'geaccepteerd', 'Rahul Imran Ismail');
    assert.equal(zonder.status, 400, pas + ': geen bedrag hoort een weigering te zijn');
    assert.match(zonder.error, /maandbedrag/, 'met de reden erbij');
    assert.equal(a.een(aan.id).aanmelding.status, 'in behandeling',
      pas + ': en de aanmelding blijft open in plaats van half toegekend');

    // onder de bodem mag evenmin
    const teLaag = a.beslis(aan.id, 'geaccepteerd', 'Rahul Imran Ismail', '', { contractEuro: 100 });
    assert.equal(teLaag.status, 400, pas + ': onder de bodem hoort geweigerd te worden');
    assert.match(teLaag.error, /minimaal/);

    // en met een geldig bedrag loopt het schema op DAT bedrag, niet op de bodem
    const bodemEuro = pas === 'business' ? 5000 : 20000;
    const ok = a.beslis(aan.id, 'geaccepteerd', 'Rahul Imran Ismail', '', { contractEuro: bodemEuro * 2 });
    assert.equal(ok.ok, true, JSON.stringify(ok));
    const rij = a.betalingen({ aanmeldingId: aan.id }).lidmaatschappen[0];
    assert.equal(rij.termijnen[0].bedrag, bodemEuro * 2,
      pas + ': het afgesproken bedrag wint van de bodem EN van de lijstprijs');
  }
});

/* MAAND 13. Dit kon voorheen niet bestaan: startBetalingen zette twaalf
   termijnen klaar en daarna hield het op. Nu komt het schema uit een contract,
   en groeit het alleen als iemand verlengt. */
test('maand 13 ontstaat door te verlengen, en verdwijnt door op te zeggen', () => {
  const a = maak();
  const lid = a.aanvraag({ pas: 'rtg', naam: 'Jaarlid' }).aanmelding;
  a.beslis(lid.id, 'geaccepteerd', 'Beoordelaar');
  const rij = () => a.betalingen({ aanmeldingId: lid.id }).lidmaatschappen[0];
  assert.equal(rij().termijnen.length, 12, 'de eerste verbintenis is twaalf maanden');

  const v = a.verlengLidmaatschap(lid.id);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.erbij, 12, 'verlengen levert een tweede periode van twaalf op');
  assert.equal(rij().termijnen.length, 24);
  assert.equal(rij().termijnen[12].maand, 13, 'en daar is maand 13');

  // opzeggen laat de termijnen na de einddatum vervallen
  const o = a.zegOpLidmaatschap(lid.id);
  assert.equal(o.ok, true, JSON.stringify(o));
  assert.ok(o.eindigtOp, 'met een uitgerekende einddatum');
  assert.ok(rij().termijnen.length < 24, 'de termijnen daarna zijn er niet meer');
  assert.ok(rij().termijnen.every(t => new Date(t.vervalt) < new Date(o.eindigtOp)),
    'een geplande termijn die nooit komt, is geen termijn met een andere status maar een termijn die er niet is');
});

/* DE PRIJS-LOCK. Besluit van 20 augustus 2026: een prijswijziging in de
   boardroom raakt nooit een lopend contract. */
test('een prijswijziging raakt een lopend lidmaatschap niet', () => {
  const a = maak({ pasprijzen: { rtg: 6500 } });
  const lid = a.aanvraag({ pas: 'rtg', naam: 'Voor de verhoging' }).aanmelding;
  a.beslis(lid.id, 'geaccepteerd', 'Beoordelaar');
  const eerst = a.betalingen({ aanmeldingId: lid.id }).lidmaatschappen[0].termijnen[0].bedrag;
  assert.equal(eerst, 65);

  // de boardroom verhoogt naar 99 euro
  a.zetPasprijs && a.zetPasprijs('rtg', 9900);
  const na = a.betalingen({ aanmeldingId: lid.id }).lidmaatschappen[0].termijnen;
  assert.ok(na.every(t => t.bedrag === 65),
    'wat dit lid tekende, betaalt dit lid -- de termijnen dragen de momentopname van het contract');
});
