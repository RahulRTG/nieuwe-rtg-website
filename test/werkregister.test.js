/* HET WERKREGISTER: zoeken, dossier en samenhang over de tien modules heen.

   Deze laag bouwt geen tweede administratie -- hij zet de bestaande bakken van
   een werkruimte in een register (kern/werkcommand/register.js) en geeft dat
   aan de motoren die er al stonden. De beweringen die ertoe doen gaan dan ook
   allemaal over SCOPE, want dat is het enige wat hier fout kan gaan:

   1. HET RECHT LAAT EEN SOORT WEG, HET FILTERT HEM NIET WEG. Wie geen 'recht'
      heeft, vindt een contract niet EN ziet de soort niet in zijn bereik. Wie
      geen 'klant' heeft, vindt de klant niet -- met exact dezelfde zoekterm.
   2. DE WERKRUIMTE IS DE GRENS. Dezelfde term in twee werkruimtes levert
      alleen de eigen rijen op.
   3. DE AFSCHERMING VAN DE KENNISBANK GELDT OOK HIER. Een artikel dat aan een
      recht hangt, staat niet in de zoekuitslag van wie dat recht mist -- de
      titel verraadt vaak genoeg.
   4. DE SAMENHANG WORDT GEMETEN EN NIET OPGESCHREVEN. Niemand heeft ergens
      genoteerd dat een ticket aan een klant hangt; het dossier van de klant
      vindt de tickets omdat ze zijn sleutel dragen.
   5. EEN WANDELING LOOPT NIET DOOR EEN GESLOTEN MODULE. Vanaf een klant vindt
      de servicedesk zijn tickets; een jurist komt niet eens bij de klant,
      want die soort bestaat in zijn register niet.

   Draai los: node --experimental-sqlite --test test/werkregister.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkregister-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let W, B, W2, B2, VK, JU, SV, HR, PL, VK2, KLANT, PROJECT, PIA_ID, PIA_TOKEN;

/* De sleutels van een lid draagt elke aanroep mee, dus ze mogen ALLEEN heten
   zoals de poort ze noemt. Een helper die ook `id` en `naam` teruggaf, schreef
   met Object.assign stilletjes over het id en de naam van het verzoek heen --
   dan heet de klant naar de verkoper en zoekt /dossier het lid-id op. Kostte
   hier twee toetsen; vandaar deze korte vorm en deze regel erboven. */
async function lid(ruimte, beheer, naam, rollen) {
  const a = (await api('/lid/aanmeld', { werkruimte: ruimte, naam })).body;
  await api('/lid/besluit', { werkruimte: ruimte, beheerToken: beheer, lidId: a.lidId, akkoord: true });
  await api('/lid/rollen', { werkruimte: ruimte, beheerToken: beheer, lidId: a.lidId, rollen });
  /* `lidId` mag hier wel mee: geen enkele route waar dit object in wordt
     gespreid leest dat veld -- de ledenroutes krijgen hun lidId expliciet, met
     het beheer-token erbij. `id` en `naam` zouden wel botsen; zie hierboven. */
  return { werkruimte: ruimte, lidToken: a.lidToken, lidId: a.lidId };
}
const typen = (uit) => (uit.groepen || []).map(g => g.type);
const titels = (uit) => (uit.groepen || []).flatMap(g => g.rijen.map(r => r.titel));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));

  const w = (await api('/werkruimte/maak', { naam: 'Noordkaap Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  VK = await lid(W, B, 'Vera', ['verkoop']);
  JU = await lid(W, B, 'Joris', ['jurist']);
  SV = await lid(W, B, 'Sam', ['service']);
  HR = await lid(W, B, 'Hanna', ['hr']);
  PL = await lid(W, B, 'Pia', ['projectleider']);
  PIA_TOKEN = PL.lidToken; PIA_ID = PL.lidId;

  const w2 = (await api('/werkruimte/maak', { naam: 'Zuidkaap BV', land: 'NL' })).body;
  W2 = w2.werkruimte; B2 = w2.beheerToken;
  VK2 = await lid(W2, B2, 'Wim', ['verkoop']);

  /* De klant waar alles aan hangt, plus een contract met dezelfde naam erin --
     zodat een zoekterm die beide RAAKT laat zien dat het recht de scheiding
     maakt en niet de term. */
  KLANT = (await api('/klant/zet', Object.assign({ naam: 'Fjordlijn Transport', branche: 'logistiek' }, VK))).body.klant;
  await api('/contract/zet', Object.assign({ titel: 'Raamovereenkomst Fjordlijn', wederpartij: 'Fjordlijn Transport',
    soort: 'leverancier', eindigt: '2027-01-01', opzegtermijnDagen: 60, waarde: 120000 }, JU));

  /* Vijf tickets op deze klant. Vijf is geen willekeurig getal: onder die grens
     WEIGERT kern/command/kwaliteit.js een veld een verwijzing te noemen, en dan
     heeft de graaf geen randen. Met vijf gevulde klantId's is het veld voor
     100% raak en dus meetbaar. */
  for (let i = 1; i <= 5; i++) {
    await api('/ticket/maak', Object.assign({ onderwerp: 'Zending ' + i + ' zoek', klantId: KLANT.id,
      prioriteit: 'normaal' }, SV));
  }

  // Een afgeschermd artikel: alleen wie 'geld' heeft mag het zien.
  await api('/kennis/schrijf', Object.assign({ titel: 'Fjordlijn: marge en kortingsafspraken',
    tekst: 'De afgesproken staffel per kwartaal.', soort: 'procedure', recht: 'geld', geldigTot: '2027-01-01' }, HR));

  /* Een project, want project/maak is een van de handelingen die het
     WERKJOURNAAL wel noteert. Daar hangt bewering 7 aan. */
  PROJECT = (await api('/project/maak', Object.assign({ naam: 'Herinrichting Fjordlijn',
    werkvorm: 'algemeen' }, PL))).body.project;

  // Dezelfde naam in de tweede werkruimte, om de grens te kunnen toetsen.
  await api('/klant/zet', Object.assign({ naam: 'Fjordlijn Transport Zuid', branche: 'logistiek' }, VK2));
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het recht laat een soort weg: dezelfde term, twee leden, twee registers', async () => {
  const vera = (await api('/zoek', Object.assign({ q: 'fjordlijn' }, VK))).body;
  const joris = (await api('/zoek', Object.assign({ q: 'fjordlijn' }, JU))).body;

  assert.ok(typen(vera).includes('klant'), 'verkoop hoort de klant te vinden');
  assert.ok(!typen(vera).includes('contract'), 'verkoop heeft geen recht "recht" en vindt het contract dus niet');
  assert.ok(typen(joris).includes('contract'), 'de jurist hoort het contract te vinden');
  assert.ok(!typen(joris).includes('klant'), 'de jurist heeft geen recht "klant" en vindt de klant dus niet');

  /* WEGLATEN EN NIET FILTEREN: de soort staat ook niet in het bereik. Een
     bereik dat "contract: 0 treffers" meldt, is de afscherming al kwijt. */
  const bereikVera = vera.bereik.map(b => b.type);
  assert.ok(bereikVera.includes('klant'), 'de klant hoort in het bereik van verkoop te staan');
  assert.ok(!bereikVera.includes('contract'), 'de contractsoort hoort in het bereik van verkoop te ONTBREKEN');
  assert.ok(!bereikVera.includes('besluit'), 'idem voor besluiten');
});

test('2. de werkruimte is de grens: dezelfde term, twee organisaties', async () => {
  const hier = (await api('/zoek', Object.assign({ q: 'fjordlijn' }, VK))).body;
  const daar = (await api('/zoek', Object.assign({ q: 'fjordlijn' }, VK2))).body;

  assert.deepEqual(titels(hier), ['Fjordlijn Transport'], 'werkruimte 1 ziet alleen haar eigen klant');
  assert.deepEqual(titels(daar), ['Fjordlijn Transport Zuid'], 'werkruimte 2 ziet alleen haar eigen klant');

  // En het dossier van een vreemde sleutel bestaat niet, ook niet met het id.
  const gestolen = await api('/dossier', Object.assign({ type: 'klant', id: KLANT.id }, VK2));
  assert.equal(gestolen.status, 404, 'het id van een andere werkruimte opent daar niets');
});

test('3. de afscherming van de kennisbank geldt ook in dit register', async () => {
  const hanna = (await api('/zoek', Object.assign({ q: 'fjordlijn' }, HR))).body;
  assert.ok(!titels(hanna).some(t => /marge/i.test(t)),
    'HR heeft "kennis" maar niet "geld"; het afgeschermde artikel hoort niet in de uitslag te staan');

  /* Het beheer-token is directie en draagt alle rechten -- dus hier MOET het
     artikel wel verschijnen. Zonder deze helft bewijst de regel hierboven
     niets: dan kon het net zo goed nergens staan. */
  const directie = (await api('/zoek', { werkruimte: W, beheerToken: B, q: 'fjordlijn' })).body;
  assert.ok(titels(directie).some(t => /marge/i.test(t)),
    'wie het recht wel heeft, hoort het artikel te vinden');
});

test('4. de samenhang wordt gemeten: het klantdossier vindt zijn tickets', async () => {
  const d = (await api('/dossier', Object.assign({ type: 'klant', id: KLANT.id }, SV))).body;
  assert.equal(d.object.titel, 'Fjordlijn Transport');

  const groep = (d.afhankelijkheden || []).find(g => g.type === 'ticket');
  assert.ok(groep, 'de vijf tickets dragen het klant-id en horen als samenhang te verschijnen');
  assert.equal(groep.totaal, 5, 'alle vijf, en niet alleen de eerste pagina');
  assert.equal(groep.rijen[0].via, 'klantId', 'en het antwoord zegt VIA WELK VELD hij ze vond');

  /* Verkoop mag de klant zien maar de servicedesk niet: dan is er geen
     ticket-soort in het register en dus ook geen samenhang. Geen lege groep --
     helemaal geen groep. */
  const vera = (await api('/dossier', Object.assign({ type: 'klant', id: KLANT.id }, VK))).body;
  assert.ok(!(vera.afhankelijkheden || []).some(g => g.type === 'ticket'),
    'zonder recht "service" bestaat de ticketsoort niet in dit register');
});

test('5. een wandeling loopt niet door een gesloten module', async () => {
  const sam = (await api('/wandel', Object.assign({ type: 'klant', id: KLANT.id, diepte: 2 }, SV))).body;
  const gevonden = sam.lagen.flatMap(l => l.objecten).filter(o => o.type === 'ticket');
  assert.equal(gevonden.length, 5, 'de servicedesk wandelt van de klant naar zijn vijf tickets');
  assert.equal(gevonden[0].via, 'klantId', 'de rand is gemeten uit het veld, niet uit een schema');

  const joris = await api('/wandel', Object.assign({ type: 'klant', id: KLANT.id, diepte: 2 }, JU));
  assert.equal(joris.status, 404, 'de jurist komt niet eens bij de klant: die soort staat niet in zijn register');
});

/* De tijdlijn van het dossier komt uit het WERKjournaal en niet uit het
   Command-journaal. Die twee dekken verschillende handelingen, dus een regel
   die 'command' heet terwijl hij uit een werkruimte komt, laat een lezer de
   dekking van het ene journaal aanzien voor die van het andere. */
test('7. een regel in de tijdlijn draagt het journaal waar hij vandaan komt', async () => {
  const d = (await api('/dossier', Object.assign({ type: 'project', id: PROJECT.id }, PL))).body;
  const uitJournaal = d.tijdlijn.filter(r => r.bron !== 'record');
  assert.ok(uitJournaal.length, 'het aanmaken van een project staat in het werkjournaal');
  assert.equal(uitJournaal[0].bron, 'werkruimte', 'en die regel heet naar het journaal dat hem leverde');
  assert.equal(uitJournaal[0].door, 'Pia', 'met de mens die het deed erbij');
  assert.ok(d.tijdlijn.some(r => r.bron === 'record'), 'naast het journaal staan de tijdstempels van de rij zelf');
});

test('6. een jong register zegt dat het niets MOCHT meten, niet dat er niets is', async () => {
  const uit = (await api('/samenhang', { werkruimte: W2, beheerToken: B2 })).body;
  assert.ok(uit.vorm.knopen.some(k => k.type === 'klant' && k.aantal === 1), 'werkruimte 2 heeft één klant');
  assert.ok(uit.nietGemeten.includes('klant'),
    'met één rij mag er geen verwijzing gemeten worden, en dat hoort er te staan');
  assert.match(uit.let, /niet gemeten/i, 'en het verschil met "geen samenhang" staat er met zoveel woorden');
});

/* DE MENS IN HET REGISTER. Hij is als laatste toegevoegd omdat er eerst twee
   dingen moesten kloppen: de gevoelige velden moesten dicht, en er moest een
   manier zijn om een mens te VINDEN. Dat tweede kon alleen op naam, en dat is
   een risico dat de laag zelf hoort te melden. */
test('8. de mens staat in het register, achter het recht "mens"', async () => {
  const hanna = (await api('/zoek', Object.assign({ q: 'pia' }, HR))).body;
  assert.ok(typen(hanna).includes('lid'), 'HR heeft het recht "mens" en vindt de medewerker');

  const vera = (await api('/zoek', Object.assign({ q: 'pia' }, VK))).body;
  assert.ok(!vera.bereik.map(b => b.type).includes('lid'),
    'verkoop heeft geen recht "mens"; de soort staat niet eens in haar bereik');
});

test('9. het dossier van een mens vindt zijn werk, en zegt waarop het matcht', async () => {
  /* Met het beheer-token, want dit vraagt TWEE rechten tegelijk: "mens" om de
     persoon te zien en "project" om zijn werk te zien. HR heeft alleen de
     eerste -- en dat is precies het gedrag dat toets 1 eist, dus die vraag hoort
     hier door iemand gesteld te worden die allebei draagt. */
  const d = (await api('/dossier', { werkruimte: W, beheerToken: B, type: 'lid', id: PIA_ID })).body;
  assert.equal(d.object.titel, 'Pia');

  const groep = (d.afhankelijkheden || []).find(g => g.type === 'project');
  assert.ok(groep, 'het project waar Pia eigenaar van is, hoort hier te staan');
  /* Sinds bedrijf/wieis.js draagt het project een `eigenaarId`, en de scan
     trekt een treffer op de SLEUTEL voor boven een treffer op de naam -- ook
     als het naamveld eerder op de rij staat. Zonder die voorkeur zou een
     exacte match als naamgok geteld worden. */
  assert.equal(groep.rijen[0].via, 'eigenaarId', 'gevonden via het lid-id en niet via de naam');
  assert.equal(d.naamgrens.gevonden.opNaam, 0, 'geen enkele rij rust hier nog op een naam');
  assert.ok(d.naamgrens.gevonden.opId >= 1, 'en minstens een via het id');
  assert.match(d.naamgrens.gevonden.let, /geen naamgok/i);
});

test('10. een naamgenoot wordt geteld en gemeld, niet weggemoffeld', async () => {
  const tweede = await lid(W, B, 'Pia', ['projectleider']);
  assert.ok(tweede.lidToken, 'er werkt nu een tweede Pia');

  const d = (await api('/dossier', Object.assign({ type: 'lid', id: PIA_ID }, HR))).body;
  assert.equal(d.naamgrens.naamgenoten, 1, 'de laag telt de naamgenoot');
  assert.match(d.naamgrens.let, /kan werk van een ander bevatten/i,
    'en waarschuwt dat de samenhang hieronder van iemand anders kan zijn');
});

test('11. de sleutels van een mens staan niet in zijn dossier', async () => {
  const d = (await api('/dossier', Object.assign({ type: 'lid', id: PIA_ID }, HR))).body;
  const token = d.feiten.find(f => f.veld === 'token');
  assert.ok(token && token.kluis, 'het lid-token staat als kluisveld en niet als waarde');
  assert.ok(!JSON.stringify(d.feiten).includes(PIA_TOKEN), 'nergens staat het echte token');

  /* `rtgKey` ONTSTAAT pas als een medewerker zijn persoonlijke RTG-account
     koppelt, en daar is een echte ledensessie voor nodig. Een route-toets die
     hem hier zoekt, kijkt dus naar een veld dat niet bestaat -- en die kan niet
     zakken. Een mutatie liet dat zien: rtgKey uit de VERBORGEN-lijst halen
     veranderde niets aan de uitslag hierboven. Daarom staat de bewering waar
     hij WEL kan zakken: op de functie zelf. */
  const { feiten } = require('../server/kern/command/object');
  const rij = feiten({ id: 'x9', naam: 'Pia', rtgKey: 'GEHEIME-ACCOUNTSLEUTEL', functie: 'projectleider' });
  const rtg = rij.find(f => f.veld === 'rtgKey');
  assert.ok(rtg, 'het veld hoort in het dossier voor te komen');
  assert.equal(rtg.kluis, true, 'maar als kluisveld');
  assert.ok(!JSON.stringify(rij).includes('GEHEIME-ACCOUNTSLEUTEL'),
    'de koppeling tussen de medewerker en zijn persoonlijke RTG-account verlaat de kluis niet');
});
