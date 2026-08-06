/* DE LEVENSLOOP -- een mens van aanmelding tot tweede baan.

   WAAROM DIT ER IS

   De andere twee toetsen kijken in de breedte: 157 mensen kunnen bij hun werk
   (menselijkebanen) en mensen doen dingen met elkaar (menselijkverkeer). Wat
   ontbrak is de LENGTE. Een loopbaan is een keten, en een keten breekt op de
   overgangen: je wordt aangenomen maar je werk-app blijft dicht, je meldt je
   ziek maar je werkgever hoort het niet, je neemt een tweede baan en de eerste
   verdwijnt, je gaat uit dienst en je komt er nog steeds in.

   Die overgangen zijn hier nooit achter elkaar gelopen. Elke schakel had zijn
   eigen toets en niemand liep de hele weg. Dit is die weg, met EEN mens:

     aanmelden -> cv -> vacatures bekijken -> solliciteren -> uitgenodigd ->
     aangenomen (kassacode) -> in dienst met het eigen RTG-account ->
     inklokken -> ziek melden -> verlof aanvragen -> tweede baan erbij ->
     uit dienst bij de eerste

   WAT DEZE TOETS BEWUST NIET DOET

   Hij verzint geen tussenstappen en zet geen data met de hand in de database.
   Elke stap gaat over de route die een mens ook gebruikt, met de rol die er
   hoort: de sollicitant solliciteert, de MANAGER neemt aan, de medewerker
   meldt zich zelf ziek. Waar een rol ontbreekt hoort het te stuiten, en dat
   staat er als bewering bij. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

/* EIGEN OPSLAG, en dat is hier geen netheid maar noodzaak.

   De eerste versie draaide op de gedeelde datamap, en dat ging goed tot ik hem
   twee keer draaide: elke ronde liet een "Sanne Vermeer" achter bij KIKUNOI, de
   toets pakte bij het ontslag de OUDE Sanne, en de nieuwe hield haar werkplek.
   De melding was dan "er blijft precies een werkplek over: Sanne Vermeer, Sanne
   Vermeer" -- een toets die op zijn eigen restafval struikelt.

   Erger dan de storing zelf: ik had er bijna een mutatie mee bewezen. Twee
   mutaties gaven exact deze melding, en de tweede kon dat onmogelijk hebben
   veroorzaakt. Vandaar een verse map per ronde. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-levensloop-'));

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* De manager van een bedrijf, langs de weg die een mens ook loopt: het rooster
   opvragen en inloggen met de manager-PIN. */
async function managerVan(P, code) {
  const rooster = await P('/api/supplier/roster', { code });
  assert.equal(rooster.status, 200, 'rooster van ' + code);
  const man = (rooster.body.staff || []).find(s => s.role === 'manager');
  assert.ok(man, code + ' heeft een manager');
  const lg = await P('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(lg.body.token, 'de manager van ' + code + ' logt in');
  return { token: lg.body.token, naam: man.name, staffId: man.id };
}

/* De hele weg naar binnen bij een bedrijf: solliciteren, uitgenodigd worden,
   aangenomen worden en in dienst zijn.

   DE LAATSTE STAP IS VERANDERD, met opzet. Hier stond eerst: aannemen levert
   een kassacode, en daarmee meld je je aan bij /api/supplier/staff/join. Maar
   wie via de app solliciteert HEEFT al een RTG-account -- daar solliciteerde
   hij mee -- en dan is een code met "typ de bedrijfsnaam over" een omweg langs
   gegevens die het systeem zelf al heeft. Aannemen verbindt hem nu meteen.

   De kassacode is niet weg: wie BUITEN de app solliciteert (naam en telefoon
   op de open sollicitatie, zonder account) krijgt hem nog steeds, samen met de
   wervingslink. Dat pad staat in test/werving-link.test.js. */
async function inDienstBij(P, code, sollicitant, inlog) {
  const manager = await managerVan(P, code);

  const sol = await P('/api/member/apply', { supplierCode: code, func: 'Bediening' }, sollicitant);
  assert.equal(sol.status, 200, 'de sollicitatie komt binnen bij ' + code + ': ' + JSON.stringify(sol.body).slice(0, 160));

  /* De sollicitaties komen mee in de leveranciersstaat -- dezelfde staat die
     de manager bij het inloggen krijgt, dus we halen hem opnieuw op. */
  const staat = await P('/api/supplier/login', { code, staffId: manager.staffId, pin: '1234' });
  const mijne = ((staat.body.state || {}).applications || []).find(a => a.name === inlog.naam);
  assert.ok(mijne, 'de manager ziet haar sollicitatie staan: ' +
    JSON.stringify(((staat.body.state || {}).applications || []).map(a => a.name)).slice(0, 200));

  const uitnodiging = await P('/api/supplier/apply/decide', { id: mijne.id, action: 'uitnodigen' }, manager.token);
  assert.equal(uitnodiging.status, 200, 'de manager nodigt uit: ' + JSON.stringify(uitnodiging.body).slice(0, 160));

  const aanname = await P('/api/supplier/apply/decide', { id: mijne.id, action: 'aannemen' }, manager.token);
  assert.equal(aanname.status, 200, 'de manager neemt aan: ' + JSON.stringify(aanname.body).slice(0, 160));
  assert.ok(aanname.body.direct && aanname.body.direct.staffId,
    'wie via de app solliciteerde is meteen in dienst, zonder code over te typen: ' +
    JSON.stringify(aanname.body).slice(0, 200));
  assert.equal(aanname.body.invite, undefined,
    'en krijgt dus geen kassacode meer voor een stap die al gezet is');
  return { direct: aanname.body.direct, join: aanname.body.direct, manager };
}

test('de levensloop: van aanmelding tot tweede baan, en er weer uit', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const u = String(Date.now()).slice(-8);
    const inlog = { naam: 'Sanne Vermeer', email: 'sanne' + u + '@x.nl', wachtwoord: 'geheim123' };

    /* ---- 1. AANMELDEN. Een gratis account is genoeg om te werken; een
       betaalde pas hoort hier geen voorwaarde te zijn. ---- */
    const reg = await P('/api/auth/register', {
      name: inlog.naam, email: inlog.email, phone: '06' + u, password: inlog.wachtwoord,
      geboortedatum: '1996-04-12', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
    });
    assert.equal(reg.status, 200, 'Sanne meldt zich aan: ' + JSON.stringify(reg.body).slice(0, 160));
    const lid = reg.body.token;

    /* ---- 2. SOLLICITEREN ZONDER CV HOORT TE STUITEN. Zonder deze stap
       bewijst de volgende niets: dan zou "het cv is de sleutel" een zin zijn
       die nergens op slaat. ---- */
    const teVroeg = await P('/api/member/apply', { supplierCode: 'KIKUNOI', func: 'Bediening' }, lid);
    assert.equal(teVroeg.status, 409, 'zonder cv kun je niet solliciteren');
    assert.equal(teVroeg.body.needCv, true, 'en de app zegt waarom');

    /* ---- 3. HET CV. ---- */
    const cv = await P('/api/cv/save', {
      name: inlog.naam, contact: inlog.email,
      headline: 'Gastvrouw met kassa-ervaring',
      skills: 'gastvrijheid, kassa, Spaans',
      experience: 'Barista bij Cafe Nova (2018-2021)\nBediening bij Strandtent De Vier (2021-2024)',
      languages: 'Nederlands, Spaans'
    }, lid);
    assert.equal(cv.status, 200, 'het cv is bewaard: ' + JSON.stringify(cv.body).slice(0, 160));
    assert.equal(cv.body.ready, true, 'en het is compleet genoeg om mee te solliciteren');

    /* ---- 4. VACATURES. Ze bestaan, en de leeftijdsgrens wordt genoemd --
       Sanne is volwassen, dus zij mag solliciteren. ---- */
    const vac = await P('/api/member/vacatures', {}, lid);
    assert.equal(vac.status, 200, 'de vacaturebank opent');
    assert.equal(vac.body.magSolliciteren, true, 'op haar leeftijd mag ze solliciteren (' + vac.body.leeftijd + ')');

    /* ---- 5 t/m 7. SOLLICITEREN, UITGENODIGD, AANGENOMEN, IN DIENST. ---- */
    const eerste = await inDienstBij(P, 'KIKUNOI', lid, inlog);

    /* ---- 8. DE WERK-APP STAAT ER BIJ HET INLOGGEN. Geen tweede inlog, geen
       rol kiezen: dat is de belofte van kern/werkbijlogin.js. ---- */
    const opnieuw = await P('/api/auth/login', { login: inlog.email, password: inlog.wachtwoord });
    assert.equal(opnieuw.status, 200, 'Sanne logt opnieuw in op haar eigen account');
    const plekken = opnieuw.body.werkplekken || opnieuw.body.werk || [];
    assert.ok(plekken.length >= 1, 'haar werkplek staat er meteen bij: ' + JSON.stringify(opnieuw.body).slice(0, 240));
    const werk1 = plekken.find(p => p.token);
    assert.ok(werk1, 'en er is een werk-sessie zonder tweede inlog');

    /* ---- 9. INKLOKKEN. ---- */
    const klok = await P('/api/staff/clock', { actie: 'in' }, werk1.token);
    assert.equal(klok.status, 200, 'ze klokt in: ' + JSON.stringify(klok.body).slice(0, 160));

    /* ---- 10. ZIEK MELDEN. De werkgever hoort het te weten; een ziekmelding
       die niemand bereikt is geen ziekmelding.

       ZONDER "Griep". Hier stond `reden: 'Griep'`, en de route nam dat gewoon
       aan -- een gezondheidsgegeven van een werknemer in het dossier van zijn
       werkgever. Dat is dichtgezet (zie test/ziekmelding-privacy.test.js); wat
       de werkgever te weten komt is DAT ze er niet is, niet WAT ze heeft. Deze
       toets liep hier langs en legde het oude gedrag vast; dat is precies hoe
       een fout een afspraak wordt. ---- */
    const metReden = await P('/api/staff/leave/request', { soort: 'ziek', reden: 'Griep' }, werk1.token);
    assert.equal(metReden.status, 422, 'een ziekmelding met een omschrijving stuit');

    const ziek = await P('/api/staff/leave/request', { soort: 'ziek' }, werk1.token);
    assert.equal(ziek.status, 200, 'ze meldt zich ziek: ' + JSON.stringify(ziek.body).slice(0, 160));
    assert.equal(ziek.body.entry.soort, 'ziek', 'het staat als ziekmelding genoteerd');
    assert.equal(ziek.body.entry.status, 'gemeld', 'met de juiste status');
    assert.ok(ziek.body.entry.van, 'en met de dag van vandaag erbij');

    const bijBaas = await P('/api/supplier/state', {}, eerste.manager.token);
    const verlofLijst = (bijBaas.body.state || bijBaas.body).verlof || [];
    assert.ok(verlofLijst.some(v => v.soort === 'ziek' && v.name === inlog.naam),
      'de werkgever ziet haar ziekmelding staan: ' + JSON.stringify(verlofLijst).slice(0, 200));

    /* ---- 11. VERLOF AANVRAGEN, met een geldige periode. ---- */
    const slecht = await P('/api/staff/leave/request', { soort: 'verlof', van: '2026-09-10', tot: '2026-09-01' }, werk1.token);
    assert.equal(slecht.status, 400, 'een einddatum voor de begindatum wordt geweigerd');

    const verlof = await P('/api/staff/leave/request',
      { soort: 'verlof', van: '2026-09-01', tot: '2026-09-10', reden: 'Familiebezoek' }, werk1.token);
    assert.equal(verlof.status, 200, 'het verlof is aangevraagd');
    assert.equal(verlof.body.entry.status, 'nieuw', 'en wacht op de werkgever -- niet vanzelf goedgekeurd');

    /* ---- 12. EEN TWEEDE BAAN ERBIJ. De eerste hoort te BLIJVEN staan; dat
       is precies de overgang waar zoiets stukgaat. ---- */
    const tweede = await inDienstBij(P, 'ESVEDRA', lid, inlog);
    assert.ok(tweede.direct && tweede.direct.staffId, 'ze is ook bij ESVEDRA meteen in dienst');

    const naTwee = await P('/api/auth/login', { login: inlog.email, password: inlog.wachtwoord });
    const beide = naTwee.body.werkplekken || naTwee.body.werk || [];
    assert.equal(beide.length, 2, 'ze heeft nu TWEE werkplekken: ' +
      beide.map(p => p.naam || p.bedrijf || p.code).join(', '));

    /* ---- 13. UIT DIENST BIJ DE EERSTE. De manager haalt haar uit het team;
       daarna hoort die werkplek weg te zijn en de andere te blijven. ---- */
    const team = await P('/api/supplier/state', {}, eerste.manager.token);
    const zij = ((team.body.state || team.body).staff || []).find(s => s.name === inlog.naam);
    assert.ok(zij, 'ze staat in het team van KIKUNOI: ' +
      JSON.stringify(((team.body.state || team.body).staff || []).map(s => s.name)).slice(0, 200));

    const eruit = await P('/api/supplier/staff/remove', { staffId: zij.id }, eerste.manager.token);
    assert.equal(eruit.status, 200, 'de manager haalt haar uit het team: ' + JSON.stringify(eruit.body).slice(0, 160));

    const naOntslag = await P('/api/auth/login', { login: inlog.email, password: inlog.wachtwoord });
    const over = naOntslag.body.werkplekken || naOntslag.body.werk || [];
    assert.equal(over.length, 1, 'er blijft precies een werkplek over: ' +
      over.map(p => p.naam || p.bedrijf || p.code).join(', '));
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
