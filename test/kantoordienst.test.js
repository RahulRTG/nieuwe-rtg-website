/* ============================================================================
   HET RTG-KANTOOR OP EEN WERKDAG: AANMELDEN, INWERKEN, EN DE NOODKNOP.

   DRIE DINGEN DIE HIER SAMENKOMEN

   1. DE DIENSTKLOK. Wie is er nu, op kantoor of thuis. Klinkt eenvoudig, en de
      enige interessante regel is uitgerekend de regel die je niet ziet als het
      goed gaat: je kunt je niet twee keer aanmelden. Zonder die grens groeit
      het dienstbord vol met dubbele mensen en telt "wie is er nu" niets meer.

   2. DE ONBOARDING. Elke afdeling heeft een eigen inwerkpagina met de
      huisregels van het huis. Die regels zijn geen decor -- er staat onder
      andere "fouten meld je meteen en zonder schaamte" en "privacy is heilig:
      klantdata bekijk je alleen als je taak erom vraagt". Een inwerkpagina die
      die regels stil kwijtraakt bij een refactor is een inwerkpagina die het
      tegenovergestelde leert.

   3. DE PANIEKKAMER, EN DAARMEE HET DERDE VIER-OGEN-SLOT VAN DIT HUIS. Het
      patroon komt hier drie keer voor, en telkens op iets onomkeerbaars:

        - een Lifestyle Pass wordt alleen door een MENS verleend
          (test/ledenladder.test.js)
        - een gezin wissen vraagt met twee volwassenen de tweede volwassene
          (test/gezinzorg.test.js)
        - en hier: een schakelaar van het platform omzetten is vanuit de
          paniekkamer een VOORSTEL, geen daad. De boardroom besluit.

      Dat is dezelfde ontwerpregel op drie plekken, en het is de moeite waard
      dat ze alle drie een toets hebben die hem echt aflegt. Want de stille
      faalvorm is overal gelijk: het voorstel schakelt meteen, en niemand merkt
      het omdat de knop precies doet wat er staat.

   Draai los: node --test test/kantoordienst.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoor-'));
const CODE = 'KANTOOR-DIENST-1';
let srv, base, office, baas;

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const kantoor = (pad, body) => api('office/' + pad, body, office);
const boardroom = (pad, body) => api('office/' + pad, body, baas);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  office = (await api('office/login', { code: CODE })).body.token;
  assert.ok(office, 'het kantoor logt in op de gedeelde code');

  /* De boardroomdeur vraagt de eigenaar zelf: zijn accountlogin opent het
     kantoor MET een identiteit, in plaats van met een gedeelde code. Dat
     onderscheid is precies wat de paniekkamer hieronder beschermt. */
  const eig = (await api('auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body;
  assert.ok(eig.token, 'de eigenaar logt in op zijn eigen account');
  baas = (await api('account/start', { rol: 'kantoor' }, eig.token)).body.token;
  assert.ok(baas, 'en staat met dat account in de backoffice');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ============================================================================
   1 -- DE DIENSTKLOK
   ========================================================================== */
test('de dienstklok: je meldt je aan, niet twee keer, en af is echt af', async () => {
  const leeg = await kantoor('dienst', {});
  assert.equal(leeg.status, 200, 'het dienstbord is te lezen: ' + JSON.stringify(leeg.body).slice(0, 160));
  const beginAantal = leeg.body.aangemeld.length;

  const zonderNaam = await kantoor('dienst/in', { kamer: 'hr' });
  assert.equal(zonderNaam.status, 400, 'aanmelden zonder naam kan niet: ' +
    JSON.stringify(zonderNaam.body).slice(0, 140));

  const onbekendeKamer = await kantoor('dienst/in', { naam: 'Sanne Vermeer', kamer: 'zolder' });
  assert.equal(onbekendeKamer.status, 404, 'en niet in een kamer die niet bestaat');

  /* ---- AANMELDEN. Twee mensen, en een van hen werkt thuis -- want dat
     onderscheid is het halve nut van dit bord. ---- */
  const sanne = await kantoor('dienst/in', { naam: 'Sanne Vermeer', kamer: 'hr', waar: 'kantoor' });
  assert.equal(sanne.status, 200, 'Sanne meldt zich aan: ' + JSON.stringify(sanne.body).slice(0, 160));
  assert.equal(sanne.body.dienst.waar, 'kantoor', 'op kantoor');
  assert.equal(sanne.body.dienst.uit, null, 'en haar dienst staat open');

  const joris = await kantoor('dienst/in', { naam: 'Joris Bakker', kamer: 'financien', waar: 'thuis' });
  assert.equal(joris.status, 200, 'Joris ook');
  assert.equal(joris.body.dienst.waar, 'thuis', 'maar dan vanuit huis');

  /* Een onbekende plek is geen derde optie: alles wat geen 'thuis' is telt als
     kantoor. Anders staat er op het bord een werkplek die niet bestaat. */
  const vaag = await kantoor('dienst/in', { naam: 'Ilse Groen', kamer: 'sales', waar: 'strand' });
  assert.equal(vaag.body.dienst.waar, 'kantoor', 'een onbekende plek wordt kantoor, geen verzonnen derde optie');

  /* ---- EN NIET TWEE KEER. Dit is de regel waar het om gaat. ---- */
  const nogmaals = await kantoor('dienst/in', { naam: 'Sanne Vermeer', kamer: 'sales' });
  assert.equal(nogmaals.status, 409, 'Sanne kan zich niet nog eens aanmelden: ' +
    JSON.stringify(nogmaals.body).slice(0, 180));
  assert.match(String(nogmaals.body.error), /al aangemeld/i, 'en het zegt waarom');

  /* Ook niet met een andere schrijfwijze -- anders is de grens met een
     hoofdletter te omzeilen en betekent hij niets. */
  const anders = await kantoor('dienst/in', { naam: 'sanne vermeer', kamer: 'hr' });
  assert.equal(anders.status, 409, 'ook niet met kleine letters');

  const bord = (await kantoor('dienst', {})).body;
  assert.equal(bord.aangemeld.length, beginAantal + 3, 'er staan drie mensen op het bord: ' +
    JSON.stringify(bord.aangemeld.map(x => x.naam)));
  const s = bord.aangemeld.find(x => x.naam === 'Sanne Vermeer');
  assert.equal(s.kamer, 'hr', 'Sanne staat bij HR');
  assert.ok(s.sinds, 'en er staat sinds wanneer');

  /* ---- AFMELDEN sluit precies EEN dienst. ---- */
  assert.equal((await kantoor('dienst/uit', { id: sanne.body.dienst.id })).status, 200, 'Sanne meldt zich af');
  const na = (await kantoor('dienst', {})).body;
  assert.equal(na.aangemeld.filter(x => x.naam === 'Sanne Vermeer').length, 0, 'ze staat er niet meer op');
  assert.equal(na.aangemeld.length, beginAantal + 2, 'de andere twee staan er nog: ' +
    JSON.stringify(na.aangemeld.map(x => x.naam)));

  /* Twee keer afmelden kan niet, en een verzonnen id ook niet. Allebei geven ze
     404 -- en dat is beter dan een stille 200, want anders denk je dat je iets
     hebt afgesloten wat allang dicht was. */
  const opnieuwUit = await kantoor('dienst/uit', { id: sanne.body.dienst.id });
  assert.equal(opnieuwUit.status, 404, 'een dienst die al dicht is, sluit je niet nog eens');
  assert.equal((await kantoor('dienst/uit', { id: 'bestaat-niet' })).status, 404, 'en een verzonnen dienst ook niet');

  /* ---- EN NA HET AFMELDEN KAN ZE WEER OPNIEUW BEGINNEN. Zonder deze tak zou
     de dubbel-grens een medewerker voor de rest van de dag buitensluiten -- de
     avonddienst na een middagpauze zou niet kunnen. ---- */
  const tweedeDienst = await kantoor('dienst/in', { naam: 'Sanne Vermeer', kamer: 'hr', waar: 'thuis' });
  assert.equal(tweedeDienst.status, 200, 'Sanne begint later opnieuw, nu vanuit huis: ' +
    JSON.stringify(tweedeDienst.body).slice(0, 160));
  assert.equal(tweedeDienst.body.dienst.waar, 'thuis', 'en dat staat er ook zo bij');
});

/* ============================================================================
   2 -- DE ONBOARDING PER KAMER
   ========================================================================== */
test('de onboarding: elke kamer werkt je in, met de huisregels van het huis', async () => {
  const onzin = await kantoor('onboarding', { kamer: 'zolder' });
  assert.equal(onzin.status, 404, 'een kamer die niet bestaat werkt niemand in');

  /* Vier kamers met elk hun eigen accenten. Ze horen alle vier te werken, want
     de dag dat er een afdeling bijkomt zonder inwerkpagina is de dag dat de
     nieuwe collega niets krijgt. */
  const kamers = ['hr', 'sales', 'financien', 'intern'];
  const stuk = [];
  for (const k of kamers) {
    const r = await kantoor('onboarding', { kamer: k });
    if (r.status !== 200) { stuk.push(k + ': status ' + r.status); continue; }
    const o = r.body.onboarding;
    if (!o || !o.welkom) { stuk.push(k + ': geen welkomsttekst'); continue; }
    if (!Array.isArray(o.regels) || o.regels.length < 3) stuk.push(k + ': te weinig huisregels');
    if (!Array.isArray(o.knoppen) || !o.knoppen.length) stuk.push(k + ': geen wegwijzer');
    if (!Array.isArray(o.handelingen) || !o.handelingen.length) stuk.push(k + ': geen concrete handelingen');
  }
  assert.deepEqual(stuk, [], 'alle vier de kamers werken iemand in:\n  ' + stuk.join('\n  '));

  /* ---- DE HUISREGELS ZELF. Dit is geen opmaakcontrole: dit zijn de beloften
     die dit huis aan zijn mensen doet, en ze staan hier zodat ze niet stil uit
     de inwerkpagina kunnen verdwijnen. ---- */
  const hr = (await kantoor('onboarding', { kamer: 'hr' })).body.onboarding;
  const regels = hr.regels.join(' | ');
  assert.match(regels, /vragen stellen is sterk/i, 'vragen stellen is sterk: ' + regels);
  assert.match(regels, /zonder schaamte/i, 'fouten meld je zonder schaamte');
  assert.match(regels, /buddy/i, 'elke stagiair krijgt een buddy');
  assert.match(regels, /vertrouwenspersoon/i, 'en er is een vertrouwenspersoon');
  assert.match(regels, /privacy is heilig/i, 'en privacy is heilig');

  /* Elke kamer krijgt DEZELFDE huisregels -- die horen niet per afdeling te
     verschillen -- maar wel EIGEN handelingen. */
  const sales = (await kantoor('onboarding', { kamer: 'sales' })).body.onboarding;
  assert.deepEqual(sales.regels, hr.regels, 'de huisregels zijn overal dezelfde');
  assert.notDeepEqual(sales.handelingen, hr.handelingen,
    'maar het werk verschilt per kamer: ' + JSON.stringify(sales.handelingen));
  assert.match(sales.welkom, /Welkom bij/i, 'en de welkomsttekst noemt de kamer: ' + sales.welkom.slice(0, 80));

  /* HR belooft in zijn handelingen iets dat een sollicitant aangaat, en dat is
     precies het soort belofte dat een toets verdient. */
  assert.match(sales.handelingen.join(' '), /bestelling|partner/i, 'sales gaat over verkopen');
  assert.match(hr.handelingen.join(' '), /sollicitant krijgt altijd antwoord/i,
    'en HR belooft dat elke sollicitant antwoord krijgt, ook bij een nee: ' + hr.handelingen.join(' | '));
});

/* ============================================================================
   3 -- DE PANIEKKAMER: EEN KNOP IS EEN VOORSTEL
   ========================================================================== */
test('de paniekkamer: een omgezette knop schakelt niets tot de boardroom besluit', async () => {
  const lijst = await kantoor('paniek', {});
  assert.equal(lijst.status, 200, 'de paniekkamer is te lezen: ' + JSON.stringify(lijst.body).slice(0, 200));
  assert.ok(Array.isArray(lijst.body.voorstellen), 'en geeft de openstaande voorstellen: ' +
    JSON.stringify(lijst.body).slice(0, 200));

  /* De functie waar we mee schakelen doet er niet toe zolang hij ECHT bestaat.
     Een vast id hier zou de toets laten omvallen zodra iemand de functielijst
     opschoont -- en erger, hem stil laten slagen als de naam blijft bestaan maar
     de betekenis verandert. Daarom pakken we er een uit dezelfde lijst die de
     server gebruikt, en eisen we dat er uberhaupt functies zijn. */
  const { OP_ID } = require('../server/functies.js');
  const ids = Object.keys(OP_ID || {});
  assert.ok(ids.length > 10, 'het schakelbord kent functies: ' + ids.length);
  const fn = ids[0];

  const onbekend = await kantoor('paniek/stel', { functie: 'bestaat-niet', aan: false, reden: 'test' });
  assert.equal(onbekend.status, 404, 'een functie die niet bestaat kun je niet voorstellen');

  /* ---- HET VOORSTEL. Let op wat er NIET gebeurt: er wordt niets geschakeld. ---- */
  const voorstel = await kantoor('paniek/stel',
    { functie: fn, aan: false, reden: 'Storing gemeld door twee leden; graag tijdelijk uit.' });
  assert.equal(voorstel.status, 200, 'de paniekkamer stelt voor: ' + JSON.stringify(voorstel.body).slice(0, 200));
  assert.equal(voorstel.body.voorstel.status, 'open', 'en het voorstel staat open, niet uitgevoerd');
  const id = voorstel.body.voorstel.id;

  /* Twee keer hetzelfde voorstellen stuit -- anders staat de boardroom voor een
     stapel identieke verzoeken en wordt de een per ongeluk twee keer uitgevoerd. */
  const nogmaals = await kantoor('paniek/stel', { functie: fn, aan: false, reden: 'nog een keer' });
  assert.equal(nogmaals.status, 409, 'voor dezelfde knop ligt al een voorstel: ' +
    JSON.stringify(nogmaals.body).slice(0, 180));

  /* ---- EN DE PANIEKKAMER BESLIST NIET ZELF. Dit is het slot: paniek/besluit
     hangt achter de boardroomdeur, en het kantoor heeft alleen de gedeelde
     code. Zou dit open staan, dan is het "voorstel" twee klikken van dezelfde
     persoon en beschermt het niets. ---- */
  const zelfBeslissen = await kantoor('paniek/besluit', { id, besluit: 'accepteer' });
  assert.ok(zelfBeslissen.status === 401 || zelfBeslissen.status === 403,
    'de paniekkamer beslist niet over zijn eigen voorstel (kreeg ' + zelfBeslissen.status + ')');

  const nogSteedsOpen = (await kantoor('paniek', {})).body.voorstellen.find(v => v.id === id);
  assert.equal(nogSteedsOpen.status, 'open', 'het voorstel staat er nog steeds open bij');

  /* ---- DE BOARDROOM WIJST EEN VOORSTEL AF. Dan gebeurt er ook niets, en dat
     is de andere helft van de belofte: afwijzen is een echt antwoord. ---- */
  const afgewezen = await boardroom('paniek/besluit', { id, besluit: 'wijs-af' });
  assert.equal(afgewezen.status, 200, 'de boardroom wijst af: ' + JSON.stringify(afgewezen.body).slice(0, 200));
  const naAfwijzen = (await kantoor('paniek', {})).body.voorstellen.find(v => v.id === id);
  assert.equal(naAfwijzen.status, 'afgewezen', 'en dat staat er zo bij');

  /* Een afgehandeld voorstel is af -- er valt niet later alsnog op terug te
     komen, want dan is een afwijzing niet definitief. */
  const opnieuw = await boardroom('paniek/besluit', { id, besluit: 'accepteer' });
  assert.equal(opnieuw.status, 409, 'een afgehandeld voorstel is af: ' +
    JSON.stringify(opnieuw.body).slice(0, 180));

  /* ---- EN NU DE ACCEPTATIE, waarna er WEL geschakeld wordt. ---- */
  const tweede = await kantoor('paniek/stel', { functie: fn, aan: false, reden: 'Toch nodig, de storing houdt aan.' });
  assert.equal(tweede.status, 200, 'na de afwijzing kan er een nieuw voorstel liggen');
  const id2 = tweede.body.voorstel.id;

  const akkoord = await boardroom('paniek/besluit', { id: id2, besluit: 'accepteer' });
  assert.equal(akkoord.status, 200, 'de boardroom accepteert: ' + JSON.stringify(akkoord.body).slice(0, 200));
  const geaccepteerd = (await kantoor('paniek', {})).body.voorstellen.find(v => v.id === id2);
  assert.equal(geaccepteerd.status, 'geaccepteerd', 'het voorstel is geaccepteerd');
  assert.ok(geaccepteerd.beslotenAt, 'en er staat wanneer dat besloten is');

  /* Een besluit dat geen besluit is, is geen besluit. */
  const derde = await kantoor('paniek/stel', { functie: fn, aan: true, reden: 'weer aan' });
  const raar = await boardroom('paniek/besluit', { id: derde.body.voorstel.id, besluit: 'misschien' });
  assert.equal(raar.status, 400, 'accepteer of wijs-af, iets anders bestaat niet: ' +
    JSON.stringify(raar.body).slice(0, 160));

  /* ---- DE DISCUSSIE. Een voorstel waar je alleen ja of nee op kunt zeggen
     dwingt een besluit af zonder vraag te kunnen stellen. ---- */
  const bericht = await kantoor('paniek/bericht',
    { id: derde.body.voorstel.id, wie: 'Joris Bakker', tekst: 'Weten we zeker dat de storing voorbij is?' });
  assert.equal(bericht.status, 200, 'er kan over gepraat worden: ' + JSON.stringify(bericht.body).slice(0, 160));
  const metDiscussie = (await kantoor('paniek', {})).body.voorstellen.find(v => v.id === derde.body.voorstel.id);
  assert.equal(metDiscussie.discussie.length, 1, 'en de vraag staat bij het voorstel');
  assert.match(metDiscussie.discussie[0].tekst, /storing voorbij/i, 'met de tekst erbij');
});
