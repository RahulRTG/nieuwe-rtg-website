/* RTG BIJSTAND: twaalf beweringen, en ze gaan allemaal over de manier waarop
   "onze engineer heeft even in uw omgeving gekeken" een oncontroleerbare zin
   wordt.

    1. ALLEEN DE KLANTKANT MAAKT EEN SESSIE. De RTG-kant kent geen enkele
       functie die er een aanmaakt; dat is de belofte in zijn zichtbaarste vorm.
    2. EEN GEDEELDE KANTOORCODE BETREEDT GEEN KLANTOMGEVING. Die naam kan niet in
       een verslag staan als degene die het deed.
    3. DE SESSIE VERLOOPT VANZELF, zonder dat er iets wordt opgeruimd. Anders
       hangt "verloopt vanzelf" van een cron af.
    4. UITVOEREN KAN NIET ZONDER AKKOORD VAN DE KLANT.
    5. HET NIVEAU BEGRENST WAT ER MAG: kijken stelt niets voor, meedenken voert
       niets uit.
    6. BIJ NOOD IS HET AKKOORD VOORAF GEGEVEN, EN DAT STAAT OP DE HANDELING --
       niet stil overgeslagen.
    7. INHOUD IS DICHT. Opengaan vraagt een reden van RTG én een besluit van de
       klant.
    8. DE DIAGNOSE DRAAGT WAT HIJ NOOIT TOONT, met een reden per post.
    9. INTREKKEN KAN ZONDER REDEN, en stopt de sessie meteen.
   10. AFSLUITEN VRAAGT EEN VERSLAG.
   11. HET SPOOR ZEGT WAT ER IS BEKEKEN. "De medewerker keek rond" is geen
       zichtbaarheid.
   12. ER LOOPT HOOGUIT ÉÉN SESSIE PER ORGANISATIE.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - een sessie-aanmaker `nieuweSessie` aan de RTG-kant geëxporteerd
     -> "alleen de klantkant maakt een sessie" ZAKT (RAAK)
   - diezelfde functie `vraag` noemen (dus botsend met de klantkant)
     -> ALLE toetsen zakken, en dat is TE GROF om iets te bewijzen (LAT regel 2).
        Het legde wel een echt gat bloot: Object.assign liet de RTG-kant winnen,
        dus zo'n functie had de klantkant stilzwijgend vervangen. Er staat nu een
        fail-fast op die botsing, en de toets hieronder dekt hem af:
   - de GEDEELD-controle uit betreed() gehaald
     -> "een gedeelde kantoorcode betreedt geen klantomgeving" ZAKT (RAAK)
   - stand() het `tot`-moment laten negeren
     -> "de sessie verloopt vanzelf" ZAKT (RAAK)
   - de statuscontrole uit voerUit() gehaald
     -> "uitvoeren kan niet zonder akkoord" ZAKT (RAAK)
   - niveaus.mag() altijd true laten geven
     -> "het niveau begrenst wat er mag" ZAKT (RAAK)
   - bij nood de handeling toch op "voorgesteld" zetten
     -> "bij nood is het akkoord vooraf gegeven" ZAKT (RAAK)
   - inhoud standaard op open
     -> "inhoud is dicht" ZAKT (RAAK)
   - NOOIT in bijstand-diagnose.js leeggemaakt
     -> "de diagnose draagt wat hij nooit toont" ZAKT (RAAK)
   - de fail-fast op een botsende naam uitgezet
     -> "een naam die aan beide kanten staat, weigert bij het opstarten" ZAKT (RAAK)

   Draai los: node --test test/bijstand.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { maakBijstand } = require('../server/kern/command/bijstand');
const { maakRtgkant } = require('../server/kern/command/bijstand-rtg');
const { maakDiagnose } = require('../server/kern/command/bijstand-diagnose');

const ORG = 'HOSHI';
const TENANT = {
  register: {
    haal: (o) => (String(o) === ORG
      ? { org: ORG, naam: 'Hoshi Group', modus: 'powered', actief: true,
        werkruimtes: ['W-1', 'W-2'], zaken: ['LEV-9'],
        groepen: [{ groep: 'Directie Rotterdam', rol: 'directie', werkruimte: 'W-1' }] }
      : null),
    lijst: () => [{ org: ORG, naam: 'Hoshi Group', modus: 'powered', actief: true,
      werkruimtes: 2, zaken: 1, groepen: 1, merk: false, bij: '2026-08-01T00:00:00.000Z' }],
    vanWerkruimte: () => ({ org: ORG })
  },
  levensloop: { stand: () => ({ toestand: 'in gebruik' }) },
  bewijs: { stand: () => ({ beweringen: [{ wat: 'SLA', mag: false, waarom: 'geen terugzetproef' }] }) }
};
const GEZOND = { stand: () => ({ oordeel: 'in orde', tel: { storing: 0 },
  vermogens: [{ id: 'betalen', naam: 'Betalen', oordeel: 'in orde', graad: 'gemeten', taal: { mens: 'Betalen werkt.' } }] }) };
const INCIDENT = { lijst: () => [] };

function opstelling() {
  const db = { data: {} };
  const regels = [];
  const diagnose = maakDiagnose({ tenant: TENANT, gezondheid: GEZOND, incident: INCIDENT });
  const b = maakBijstand({ db, save() {}, crypto,
    journaal: { noteer: (r) => regels.push(r) }, tenant: TENANT, diagnose });
  return { db, regels, b, diagnose };
}
const open = (b, o) => b.vraag(ORG, Object.assign({ niveau: 'herstellen', onderwerp: 'de kassakoppeling' }, o || {}));

test('1. alleen de klantkant maakt een sessie', () => {
  /* De RTG-kant kent zes handelingen, en "vraag" is er geen van. Dit is geen
     stijlkwestie: zolang die functie daar niet staat, kan RTG zichzelf geen
     toegang geven zonder dat iemand het andere bestand openslaat. */
  const rtg = maakRtgkant({ vind: () => null, levend: () => false, stand: () => 'open',
    kort: (x) => x, dossier: () => ({}), spoor() {}, noteer() {}, nu: () => '', save() {}, diagnose: {} });
  assert.deepEqual(Object.keys(rtg).sort(),
    ['betreed', 'kijk', 'sluit', 'stelVoor', 'voerUit', 'vraagInhoud']);
  assert.equal(rtg.vraag, undefined, 'de RTG-kant kan een sessie aanmaken');
});

test('2. een gedeelde kantoorcode betreedt geen klantomgeving', () => {
  const t = opstelling();
  const id = open(t.b).sessie.id;
  const r = t.b.betreed(id, 'kantoor (gedeelde code)');
  assert.equal(r.status, 403);
  assert.match(r.error, /eigen RTG-account/);
  assert.equal(t.b.dossier(id).medewerker, null, 'er is toch iemand binnengelaten');
  assert.ok(!t.b.betreed(id, 'Amira').error, 'een eigen naam komt er niet in');
});

test('3. de sessie verloopt vanzelf, zonder opruimen', () => {
  const t = opstelling();
  const id = open(t.b, { minuten: 5 }).sessie.id;
  assert.equal(t.b.dossier(id).status, 'open');
  /* De klok een half uur vooruit, en verder NIETS aanroepen. */
  t.db.data.bijstand[0].tot = new Date(Date.now() - 60000).toISOString();
  assert.equal(t.b.dossier(id).status, 'verlopen');
  assert.equal(t.b.betreed(id, 'Amira').status, 409, 'een verlopen sessie is nog te betreden');
  assert.equal(t.b.tel().levend, 0);
});

test('4. uitvoeren kan niet zonder akkoord, en 11. het spoor zegt wat er is bekeken', () => {
  const t = opstelling();
  const id = open(t.b).sessie.id;
  t.b.betreed(id, 'Amira');
  const v = t.b.stelVoor(id, 'Amira', { wat: 'de kassakoppeling opnieuw opbouwen', waarom: 'de sessie is weg' });
  assert.equal(v.sessie.handelingenLijst[0].status, 'voorgesteld');
  const mis = t.b.voerUit(id, 'Amira', 0, 'gedaan');
  assert.equal(mis.status, 403, 'er is uitgevoerd zonder akkoord');

  t.b.besluit(ORG, id, 0, true, 'de klant');
  const goed = t.b.voerUit(id, 'Amira', 0, '82 van 82 verwerkt');
  assert.equal(goed.sessie.handelingenLijst[0].status, 'uitgevoerd');

  t.b.kijk(id, 'Amira', 'platform');
  const spoor = t.b.dossier(id).spoor.map(x => x.wat);
  assert.ok(spoor.some(x => /bekeek de platformstand/.test(x)), 'het spoor zegt niet WAT er is bekeken: ' + spoor[0]);
  assert.ok(spoor.some(x => /voerde uit/.test(x)));
});

test('5. het niveau begrenst wat er mag', () => {
  const kijk = opstelling();
  const a = kijk.b.vraag(ORG, { niveau: 'kijken', onderwerp: 'even meekijken' }).sessie.id;
  kijk.b.betreed(a, 'Amira');
  assert.equal(kijk.b.stelVoor(a, 'Amira', { wat: 'iets doen' }).status, 403, 'op kijken werd voorgesteld');

  const mee = opstelling();
  const c = mee.b.vraag(ORG, { niveau: 'meedenken', onderwerp: 'meedenken graag' }).sessie.id;
  mee.b.betreed(c, 'Amira');
  assert.ok(!mee.b.stelVoor(c, 'Amira', { wat: 'de koppeling opbouwen' }).error, 'meedenken mag voorstellen');
  mee.b.besluit(ORG, c, 0, true, 'de klant');
  assert.equal(mee.b.voerUit(c, 'Amira', 0, 'x').status, 403, 'op meedenken werd uitgevoerd');
});

test('6. bij nood is het akkoord vooraf gegeven, en dat staat op de handeling', () => {
  const t = opstelling();
  const zonder = t.b.vraag(ORG, { niveau: 'nood', onderwerp: 'alles ligt plat' });
  assert.equal(zonder.status, 400, 'nood ging open zonder reden');

  const s = t.b.vraag(ORG, { niveau: 'nood', onderwerp: 'alles ligt plat',
    reden: 'het is half drie en de kassa doet niets' });
  assert.equal(s.sessie.minuten, 30, 'nood duurt langer dan een half uur');
  assert.equal(s.sessie.voorafAkkoord, true);
  t.b.betreed(s.sessie.id, 'Amira');
  const h = t.b.stelVoor(s.sessie.id, 'Amira', { wat: 'de koppeling opnieuw opbouwen' }).sessie.handelingenLijst[0];
  assert.equal(h.status, 'goedgekeurd', 'bij nood bleef de handeling op voorgesteld staan');
  assert.match(h.besluitDoor, /vooraf/, 'er staat niet bij dat het akkoord vooraf is gegeven');
  assert.ok(h.besluitAt, 'het moment van dat akkoord staat er niet bij');
  const d = t.b.sluit(s.sessie.id, 'Amira', 'kassakoppeling opnieuw opgebouwd, 82 transacties verwerkt');
  assert.equal(d.sessie.verslag.voorafAkkoord, true, 'het verslag verzwijgt dat er vooraf akkoord was');
});

test('7. inhoud is dicht, en opengaan vraagt een reden en een besluit', () => {
  const t = opstelling();
  const id = open(t.b).sessie.id;
  t.b.betreed(id, 'Amira');
  assert.equal(t.b.dossier(id).inhoud.open, false, 'de inhoud stond meteen open');
  const zonder = t.b.kijk(id, 'Amira', 'inrichting');
  assert.equal(zonder.diagnose.inrichting.dicht, true, 'de inrichting lag open zonder akkoord');
  assert.ok(!JSON.stringify(zonder.diagnose).includes('Directie Rotterdam'), 'er lekte een groepsnaam');

  assert.equal(t.b.vraagInhoud(id, 'Amira', 'kort').status, 400, 'inhoud werd gevraagd zonder reden');
  t.b.vraagInhoud(id, 'Amira', 'ik moet zien welke groep aan welke rol hangt om dit te kunnen herstellen');
  assert.equal(t.b.dossier(id).inhoud.open, false, 'een verzoek opende de inhoud zelf al');

  t.b.inhoudBesluit(ORG, id, true, 'de klant');
  const met = t.b.kijk(id, 'Amira', 'inrichting');
  assert.equal(met.diagnose.inrichting.dicht, false);
  assert.ok(JSON.stringify(met.diagnose).includes('Directie Rotterdam'), 'na akkoord is de inrichting nog dicht');
});

test('8. de diagnose draagt wat hij nooit toont', () => {
  const t = opstelling();
  for (const wat of ['stand', 'inrichting', 'platform']) {
    const d = t.diagnose.voor(ORG, { inhoud: true, wat });
    assert.ok(d.nooit.length >= 3, 'de nooit-lijst ontbreekt bij ' + wat);
    for (const n of d.nooit) assert.ok(n.waarom && n.waarom.length > 30, n.wat + ' heeft geen reden');
  }
  const namen = t.diagnose.voor(ORG, { inhoud: true }).nooit.map(n => n.wat).join(' ');
  assert.match(namen, /echte namen/, 'de identiteitskluis staat niet in de nooit-lijst');
  /* En het platformhoofdstuk zegt dat het NIET over deze klant gaat. */
  const p = t.diagnose.voor(ORG, { wat: 'platform' }).platform;
  assert.match(p.let, /PLATFORM en niet van deze organisatie/);
});

test('9. intrekken kan zonder reden, en 12. er loopt hooguit een sessie per organisatie', () => {
  const t = opstelling();
  const id = open(t.b).sessie.id;
  assert.equal(open(t.b).status, 409, 'er ging een tweede sessie open');
  const r = t.b.trekIn(ORG, id);
  assert.equal(r.sessie.status, 'ingetrokken');
  assert.ok(!open(t.b).error, 'na intrekken kan er geen nieuwe open');
});

test('10. afsluiten vraagt een verslag', () => {
  const t = opstelling();
  const id = open(t.b).sessie.id;
  t.b.betreed(id, 'Amira');
  for (const v of ['', '  ', 'klaar']) assert.equal(t.b.sluit(id, 'Amira', v).status, 400, 'sloot met "' + v + '"');
  const d = t.b.sluit(id, 'Amira', 'sessie van de leverancier opnieuw opgebouwd; niets verloren');
  assert.equal(d.sessie.status, 'gesloten');
  assert.ok(d.sessie.verslag.duurMinuten >= 0);
  assert.ok(t.regels.some(x => x.actie === 'bijstand afgesloten'), 'het afsluiten staat niet in het journaal');
  /* En elke stap staat in het journaal, niet alleen de laatste. */
  const acties = t.regels.map(x => x.actie);
  for (const a of ['bijstand gevraagd', 'bijstand betreden', 'bijstand afgesloten']) {
    assert.ok(acties.includes(a), a + ' staat niet in het journaal');
  }
});

test('een naam die aan beide kanten staat, weigert bij het opstarten', () => {
  /* Zonder deze grendel wint de RTG-kant bij Object.assign, en dan vervangt een
     functie die daar `vraag` gaat heten stilzwijgend de klantkant -- terwijl
     bijstand-klant.js nog steeds de enige plek LIJKT waar een sessie ontstaat. */
  const echt = require('../server/kern/command/bijstand-rtg').maakRtgkant;
  const mod = require('../server/kern/command/bijstand-rtg');
  mod.maakRtgkant = (C) => Object.assign(echt(C), { vraag: () => ({}) });
  try {
    assert.throws(() => opstelling(), /staat aan beide kanten/,
      'een botsende naam werd stilzwijgend geaccepteerd');
  } finally { mod.maakRtgkant = echt; }
});

test('de teller zegt dat RTG nergens permanente toegang heeft', () => {
  const t = opstelling();
  assert.equal(t.b.tel().permanenteToegang, 0);
  open(t.b);
  assert.equal(t.b.tel().permanenteToegang, 0, 'een lopende sessie telt als permanente toegang');
  assert.equal(t.b.tel().wachtOpRtg, 1, 'een sessie zonder medewerker wacht niet op RTG');
});
