/* DE LEDENLADDER -- van RTG Pass naar Lifestyle, en wat daar dan achter zit.

   WAAROM DIT DE BELANGRIJKSTE OPENSTAANDE WAS

   Dit huis is een membership-platform. De kernbelofte is dat een pas iets
   OPENT, en die belofte was nooit end-to-end nagelopen: TAKEN.md 4.1 stond
   open ("de pas-toekenning is nooit doorlopen") en eerlijkheidspunt 6.3 zei
   het scherper -- dat er echte functionaliteit achter de Lifestyle-poort zit
   wist ik uit de CODE, niet uit een draaiend systeem.

   Drie eerdere pogingen om die pas met de hand toe te kennen liepen op 400 en
   403. Dat was de code die zijn werk deed: de merkregel is dat Lifestyle en
   Business uitsluitend na goedkeuring door een MENS worden verleend, nooit
   door de AI en nooit door een gedeelde code. Deze toets omzeilt dat niet maar
   loopt het af.

   WAT ER WORDT VASTGELEGD

   1. DE POORT ZIT ECHT DICHT. Een RTG-lid krijgt bij elk van de twaalf
      Lifestyle-apps een 403 met dezelfde eerlijke uitleg, en ook bij de
      dertiende ingang: de adviseur die de gegevens van het lid voorleest.
   2. DE PAS WORDT DOOR EEN MENS VERLEEND, in de backoffice, na een aanvraag.
   3. EN DAN GAAT HIJ OOK ECHT OPEN -- niet met een leeg scherm maar met
      werkende apps: wat je erin zet, staat er daarna ook echt in. Dat is het
      verschil tussen een pas die iets opent en een pas die een vlag zet. Ook
      de adviseur kijkt dan echt in het dossier van dit lid, in de u-vorm, en
      zonder een boeking te beloven.
   4. DE PAS IS NIET TE RADEN OF TE VRAGEN. Zonder besluit blijft het lid
      gewoon RTG. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ladder-'));
let child, BASE;

function post(pad, body, token) {
  return fetch(BASE + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De twaalf app-families achter de Lifestyle-poort, elk met de leesroute en
   een schrijfactie die er echt iets in zet. Zo toetst dit niet "de route
   antwoordt" maar "de app werkt". */
const APPS = [
  { naam: 'Reisboek', lees: 'reisboek', zet: 'reis/zet', body: { naam: 'Ronde om de Middellandse Zee' }, veld: 'naam' },
  { naam: 'Cellier', lees: 'cellier', zet: 'cellier/zet', body: { naam: 'Chateau Margaux 2016', kleur: 'rood' }, veld: 'naam' },
  { naam: 'Table', lees: 'table', zet: 'table/zet', body: { naam: 'Diner voor acht' }, veld: 'naam' },
  { naam: 'Maison', lees: 'maison', zet: 'maison/staf', body: { naam: 'Huishoudster', rol: 'huishouding' }, veld: 'naam' },
  { naam: 'Garderobe', lees: 'garderobe', zet: 'garderobe/stuk', body: { naam: 'Grijs krijtstreep' }, veld: 'naam' },
  { naam: 'Mecenaat', lees: 'mecenaat', zet: 'mecenaat/gift', body: { doel: 'Concertgebouw', thema: 'kunst', bedrag: 500 }, veld: 'doel' },
  { naam: 'Nalatenschap', lees: 'nalatenschap', zet: 'nalatenschap/wens', body: { tekst: 'De boeken naar de bibliotheek' }, veld: 'tekst' },
  { naam: 'Logboek', lees: 'logboek', zet: 'logboek/object', body: { naam: 'De Riva' }, veld: 'naam' },
  { naam: 'Cercle', lees: 'cercle', zet: 'cercle/club', body: { naam: 'Amstel Cercle', stad: 'Amsterdam' }, veld: 'naam' },
  { naam: 'Hangar', lees: 'hangar', zet: 'hangar/toestel', body: { naam: 'Citation CJ4' }, veld: 'naam' },
  { naam: 'Entourage', lees: 'entourage', zet: 'entourage/persoon', body: { naam: 'Chauffeur Almeida' }, veld: 'naam' },
  { naam: 'Attenties', lees: 'attenties', zet: 'attenties/relatie', body: { naam: 'Familie Duarte' }, veld: 'naam' }
];

let teller = 0;
async function nieuwLid(naam) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await post('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1985-06-06', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, naam + ' is aangemeld: ' + JSON.stringify(r.body).slice(0, 160));
  return { token: r.body.token, email: naam.toLowerCase() + u + '@x.nl', wachtwoord: 'geheim123' };
}

test('de poort zit dicht: een RTG-lid komt bij geen van de dertien ingangen binnen', async () => {
  const lid = await nieuwLid('Rtglid');
  const dicht = [];
  for (const a of APPS) {
    const r = await post('/api/member/rechterhand/' + a.lees, {}, lid.token);
    if (r.status !== 403) dicht.push(a.naam + ': status ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 80));
    else if (!/Lifestyle Pass/i.test(String(r.body.error))) dicht.push(a.naam + ': onduidelijke melding "' + r.body.error + '"');
  }
  assert.deepEqual(dicht, [],
    'alle twaalf horen dicht te zitten met dezelfde eerlijke uitleg:\n  ' + dicht.join('\n  '));

  /* En schrijven kan ook niet -- een dichte deur die je wel door kunt schuiven
     is geen deur. */
  const schrijf = await post('/api/member/rechterhand/cellier/zet', { naam: 'Stiekem' }, lid.token);
  assert.equal(schrijf.status, 403, 'ook schrijven stuit: ' + JSON.stringify(schrijf.body).slice(0, 160));

  /* En de dertiende ingang: de adviseur binnen de apps. Die is de gevaarlijkste
     om open te laten staan, want hij LEEST de gegevens van het lid voor. */
  const ai = await post('/api/member/rechterhand/ai', { app: 'cellier', vraag: 'Wat ligt er?' }, lid.token);
  assert.equal(ai.status, 403, 'ook de adviseur zwijgt voor een RTG-lid: ' + JSON.stringify(ai.body).slice(0, 160));
});

test('de pas wordt door een MENS verleend, en dan gaan alle twaalf apps echt open', async () => {
  const lid = await nieuwLid('Kandidaat');

  /* ---- 1. DE AANVRAAG, INGELOGD. Dat is geen detail: de aanvraag hangt
     alleen aan een account als hij met een sessie binnenkomt, en zonder die
     koppeling kan het besluit later niemands pas optillen. Een aanvraag die
     anoniem binnenkomt is een briefje zonder afzender. ---- */
  const aanvraag = await post('/api/aanmelding/aanvraag', {
    naam: 'Kandidaat Vos', email: lid.email, telefoon: '0612340000',
    pas: 'lifestyle', motivatie: 'Ik reis veel en wil het uit handen geven.'
  }, lid.token);
  assert.equal(aanvraag.status, 200, 'de aanvraag komt binnen: ' + JSON.stringify(aanvraag.body).slice(0, 200));
  const id = aanvraag.body.aanmelding.id;
  assert.equal(aanvraag.body.aanmelding.status, 'in behandeling', 'en staat in behandeling');

  /* ---- 2. ZONDER MENS GEEN PAS. Dit is de merkregel, en de reden dat drie
     eerdere pogingen terecht op een 403 liepen. ---- */
  const zonderMens = await post('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd' });
  assert.ok(zonderMens.status === 401 || zonderMens.status === 403,
    'zonder backoffice-sessie valt er geen besluit (kreeg ' + zonderMens.status + ')');

  /* ---- 3. HET BESLUIT, door een herleidbaar mens. ---- */
  const mens = await kantoorAlsPersoon(BASE);
  assert.ok(mens, 'er is een herleidbaar mens in de backoffice');
  const besluit = await post('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd' }, mens);
  assert.equal(besluit.status, 200, 'het mens beslist: ' + JSON.stringify(besluit.body).slice(0, 200));
  assert.equal(besluit.body.aanmelding.status, 'geaccepteerd', 'de aanmelding staat op geaccepteerd');

  /* ---- 4. HET LID LOGT OPNIEUW IN EN HEEFT DE PAS. ---- */
  const opnieuw = await post('/api/auth/login', { login: lid.email, password: lid.wachtwoord });
  assert.equal(opnieuw.status, 200, 'het lid logt opnieuw in');
  const tok = opnieuw.body.token;
  assert.ok(tok, 'met een nieuwe sessie');

  const mij = await post('/api/auth/me', {}, tok);
  assert.equal((mij.body.user || {}).tier, 'lifestyle',
    'en draagt nu de Lifestyle Pass: ' + JSON.stringify(mij.body).slice(0, 200));

  /* ---- 5. EN DAN DE VRAAG DIE NOOIT IS GESTELD: gaan die apps ook echt
     open, met werkende inhoud? Niet "de route antwoordt" maar: wat ik erin
     zet, staat er daarna ook in. ---- */
  const stuk = [];
  for (const a of APPS) {
    const open = await post('/api/member/rechterhand/' + a.lees, {}, tok);
    if (open.status !== 200) { stuk.push(a.naam + ': gaat niet open (' + open.status + ' ' + JSON.stringify(open.body).slice(0, 90) + ')'); continue; }

    const gezet = await post('/api/member/rechterhand/' + a.zet, a.body, tok);
    if (gezet.status !== 200) { stuk.push(a.naam + ': schrijven mislukt (' + gezet.status + ' ' + JSON.stringify(gezet.body).slice(0, 90) + ')'); continue; }

    const na = await post('/api/member/rechterhand/' + a.lees, {}, tok);
    const zoek = String(a.body[a.veld]);
    if (!JSON.stringify(na.body).includes(zoek)) {
      stuk.push(a.naam + ': "' + zoek + '" staat er na het opslaan niet in (' + JSON.stringify(na.body).slice(0, 120) + ')');
    }
  }
  assert.deepEqual(stuk, [],
    'alle twaalf Lifestyle-apps horen te werken, niet alleen te antwoorden:\n  ' + stuk.join('\n  '));

  /* ---- 6. DE DERTIENDE INGANG: de adviseur binnen de apps. Hij is nu open, en
     hij hoort DE EIGEN GEGEVENS te kennen -- anders is het een praatje naast de
     app in plaats van een adviseur erin. De reis die hierboven is opgeslagen
     moet in zijn antwoord terugkomen. ---- */
  const adviseur = await post('/api/member/rechterhand/ai',
    { app: 'reisboek', vraag: 'Waar moet ik op letten?' }, tok);
  assert.equal(adviseur.status, 200, 'de adviseur doet open: ' + JSON.stringify(adviseur.body).slice(0, 160));
  const antwoord = String(adviseur.body.antwoord || '');
  assert.match(antwoord, /Reizen in het boek: 1/,
    'en hij kijkt echt in het reisboek van dit lid: "' + antwoord.slice(0, 200) + '"');

  /* De merkregel voor de rechterhand-apps is de u-vorm -- dit is de Lifestyle
     Pass, de "vertrouwde rechterhand", geen tutoyerende RTG-toon. En hij belooft
     geen boeking: dat is een harde regel uit CLAUDE.md, geen stijlkwestie. */
  assert.match(antwoord, /\bu\b|\buw\b/i, 'in de u-vorm: "' + antwoord.slice(0, 200) + '"');
  assert.doesNotMatch(antwoord, /\b(geboekt|gereserveerd|bevestigd)\b/i,
    'en zonder een boeking te beloven: "' + antwoord.slice(0, 200) + '"');

  const onzin = await post('/api/member/rechterhand/ai', { app: 'kasteel', vraag: 'Hoi' }, tok);
  assert.equal(onzin.status, 400, 'een app die niet bestaat krijgt geen adviseur');
});

test('de pas is niet te vragen of te raden: zonder besluit blijft een lid RTG', async () => {
  const lid = await nieuwLid('Aandringer');

  /* Een aanvraag doen mag; hij levert alleen niets op zolang niemand beslist.
     Zonder deze toets zou de vorige ook slagen als de pas al bij de AANVRAAG
     werd toegekend -- en dan is de menselijke goedkeuring een formaliteit. */
  const aanvraag = await post('/api/aanmelding/aanvraag', {
    naam: 'Aandringer Vos', email: lid.email, telefoon: '0612340001',
    pas: 'lifestyle', motivatie: 'Graag meteen.'
  });
  assert.equal(aanvraag.status, 200, 'de aanvraag komt binnen');

  const opnieuw = await post('/api/auth/login', { login: lid.email, password: lid.wachtwoord });
  const mij = await post('/api/auth/me', {}, opnieuw.body.token);
  assert.equal((mij.body.user || {}).tier, 'rtg', 'het lid is nog gewoon RTG: ' + JSON.stringify(mij.body).slice(0, 160));

  const nogDicht = await post('/api/member/rechterhand/cellier', {}, opnieuw.body.token);
  assert.equal(nogDicht.status, 403, 'en de deur zit nog dicht');
});
