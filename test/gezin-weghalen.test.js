/* ============================================================================
   HET GEZIN: DE KANT WAAR DINGEN VERDWIJNEN -- 7 endpoints.

   De waargenomen dekkingsmeting wees eenentwintig foundation-routes aan als
   nooit aangeroepen, en daar zat een patroon in: het gezinsdeel was wel
   beproefd op AANMAKEN en TONEN, en niet op WEGHALEN. Dat is de verkeerde
   helft om over te slaan. Bij toevoegen is de ergste fout een regel te veel;
   bij weghalen is de ergste fout dat andermans gegevens weg zijn.

   WAT HIER IS GEVONDEN

   Het gezin kent al een duidelijke regel voor "van wie is dit". ochtend.js
   schrijft hem op en handhaaft hem:

       magBeheer(s, doelPid) -- je eigen ritme, of dat van een gezinslid als
       je ouder of beheerder bent. "Je kunt alleen je eigen ritme aanpassen."

   De GEZONDHEIDSKAART had die regel niet. doelVan() in gezondheid.js keek
   alleen of het doelprofiel geen gast was, en liet verder iedereen bij de
   kaart van iedereen. Een KIND kon dus de doktersafspraken en de groeicurve
   van zijn ouder wissen -- terwijl datzelfde kind het ochtendritme van die
   ouder niet mocht aanraken. De gevoeligste kaart van de hele module had de
   zwakste controle.

   Dat is nu rechtgezet met exact dezelfde regel, niet met een nieuwe: een
   ouder beheert de kaart van een kind, een kind beheert alleen die van
   zichzelf. Toets 4 rekent het af.

   Draai los: node --test test/gezin-weghalen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-weghalen-'));

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const haal = (pad, code, token) => fetch(BASE + '/api/foundation/gezin/' + code + pad + '?token=' + token)
  .then(r => r.json());
const morgen = n => new Date(Date.now() + (n || 1) * 86400000).toISOString().slice(0, 10);

/* Een gezin met een beheerder, een tweede ouder, een kind en een gast. De
   tweede ouder is er niet voor de sier: zonder twee volwassenen wist het
   AVG-verzoek het gezin meteen, en dan valt er niets in te trekken. */
async function gezin() {
  const g = (await api('/gezin/maak', { gezinsnaam: 'De Wit', naam: 'Ouder Een', pin: '2468' })).body;
  const mk = async (naam, rol) => {
    const p = (await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam, rol })).body;
    const t = (await api('/gezin/profiel/kies', { code: g.code, profielId: p.profiel.id })).body.token;
    return { id: p.profiel.id, token: t };
  };
  const ouder2 = await mk('Ouder Twee', 'ouder');
  const kind = await mk('Noor', 'kind');
  const gast = await mk('Oma', 'gast');
  const mij = await haal('/mij', g.code, g.token);
  const mijnId = (mij.profiel || mij).id;
  assert.ok(mijnId, 'de beheerder heeft een profiel-id: ' + JSON.stringify(mij).slice(0, 160));
  return { code: g.code, token: g.token, mijnId, ouder2, kind, gast };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de gezinsagenda: het gezin plant en haalt weg, de oppas niet', async () => {
  const G = await gezin();
  const mk = await api('/gezin/agenda', { code: G.code, token: G.token, titel: 'Tandarts Noor', datum: morgen(3) });
  assert.equal(mk.status, 200);
  const id = mk.body.item.id;

  /* De oppas mag de planning LEZEN (dat hoort bij oppassen) maar er niets uit
     halen. Dat onderscheid is de hele reden dat familieVan naast sessieVan
     bestaat. */
  const oppas = await api('/gezin/agenda/verwijder', { code: G.code, token: G.gast.token, itemId: id });
  assert.equal(oppas.status, 403, 'een gast haalt niets uit de gezinsagenda');
  assert.match(oppas.body.error, /oppas|familie|prive/i);

  const bereik = await api('/gezin/agenda/bereik', { code: G.code, token: G.gast.token, van: morgen(0), tot: morgen(10) });
  assert.equal(bereik.status, 200, 'lezen mag de oppas wel: hij moet weten wat er die dag speelt');

  assert.equal((await api('/gezin/agenda/verwijder', { code: G.code, token: G.kind.token, itemId: id })).status, 200,
    'binnen het gezin haalt iedereen iets uit de gedeelde agenda: het is een gezamenlijke planning');
  const na = await api('/gezin/agenda/bereik', { code: G.code, token: G.token, van: morgen(0), tot: morgen(10) });
  assert.ok(!(na.body.punten || na.body.items || []).some(p => p.id === id), 'en het punt is echt weg');

  // een id dat niet bestaat is geen fout: het eindresultaat is hetzelfde
  assert.equal((await api('/gezin/agenda/verwijder', { code: G.code, token: G.token, itemId: 'bestaatniet' })).status, 200);
});

test('2. klusjes weghalen is voor een ouder, niet voor het kind dat ze moet doen', async () => {
  const G = await gezin();
  const mk = await api('/gezin/klus', { code: G.code, token: G.token, titel: 'Tafel dekken', sterren: 2, voor: G.kind.id });
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const klusId = (mk.body.klus || mk.body.item || {}).id;
  assert.ok(klusId, 'het klusje heeft een id');

  /* Zou een kind zijn eigen klusje kunnen weghalen, dan is de sterrenkaart een
     lijst met alleen de klusjes die het kind leuk vond. */
  const poging = await api('/gezin/klus/verwijder', { code: G.code, token: G.kind.token, klusId });
  assert.equal(poging.status, 403, 'het kind haalt zijn eigen klusje niet van de lijst');
  assert.equal((await api('/gezin/klus/verwijder', { code: G.code, token: G.gast.token, klusId })).status, 403);

  assert.equal((await api('/gezin/klus/verwijder', { code: G.code, token: G.token, klusId })).status, 200);
  const lijst = await haal('/klussen', G.code, G.token);
  assert.ok(!(lijst.klussen || []).some(k => k.id === klusId), 'en het klusje staat er niet meer');
});

test('3. het verjaardagsboek: wie iemand toevoegde haalt hem weg, of een ouder', async () => {
  const G = await gezin();
  const mk = await api('/gezin/verjaardag/persoon', { code: G.code, token: G.kind.token, naam: 'Opa Jan', dag: 12, maand: 4, jaar: 1955 });
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const persoonId = ((await haal('/verjaardagen', G.code, G.token)).mensen.find(m => m.naam === 'Opa Jan') || {}).id;
  assert.ok(persoonId, 'de persoon staat in het boek');

  const w = await api('/gezin/verjaardag/wens', { code: G.code, token: G.kind.token, voorId: persoonId, tekst: 'Een nieuwe hengel' });
  assert.equal(w.status, 200, JSON.stringify(w.body));

  assert.equal((await api('/gezin/verjaardag/persoon/verwijder', { code: G.code, token: G.ouder2.token, persoonId })).status, 200,
    'een ouder mag ook weghalen wat een kind toevoegde');

  const boek = await haal('/verjaardagen', G.code, G.token);
  assert.ok(!(boek.mensen || []).some(m => m.id === persoonId), 'de persoon is weg');

  /* De route ruimt ook de wensen van die persoon op. Dat is van BUITENAF niet
     te zien -- het overzicht toont wensen alleen onder een persoon, dus een
     wees-wens is sowieso onzichtbaar. Mijn eerste versie beweerde het toch, en
     die bewering bleef staan toen ik het opruimen eruit sloopte: een toets die
     niet kan falen. Wat er hieronder WEL staat is de losse wens-verwijderroute,
     want die is gewoon te zien. */
  const tweede = await api('/gezin/verjaardag/persoon', { code: G.code, token: G.token, naam: 'Tante Rosa', dag: 3, maand: 9, jaar: 1962 });
  assert.equal(tweede.status, 200, JSON.stringify(tweede.body));
  const rosaId = ((await haal('/verjaardagen', G.code, G.token)).mensen.find(m => m.naam === 'Tante Rosa') || {}).id;
  assert.ok(rosaId, 'Tante Rosa staat in het boek');

  assert.equal((await api('/gezin/verjaardag/wens', { code: G.code, token: G.kind.token, voorId: rosaId, tekst: 'Een goed boek' })).status, 200);
  const metWens = (await haal('/verjaardagen', G.code, G.token)).mensen.find(m => m.id === rosaId);
  const wensId = ((metWens.wensen || [])[0] || {}).id;
  assert.ok(wensId, 'de wens staat onder haar naam: ' + JSON.stringify(metWens).slice(0, 200));

  /* Een gast haalt niets uit het verjaardagsboek: dat is een privezaak van het
     gezin, net als de agenda hierboven. */
  assert.equal((await api('/gezin/verjaardag/wens/verwijder', { code: G.code, token: G.gast.token, wensId })).status, 403);

  assert.equal((await api('/gezin/verjaardag/wens/verwijder', { code: G.code, token: G.kind.token, wensId })).status, 200,
    'wie de wens opschreef haalt hem ook weg');
  const na2 = (await haal('/verjaardagen', G.code, G.token)).mensen.find(m => m.id === rosaId);
  assert.ok(!(na2.wensen || []).some(w => w.id === wensId), 'en hij staat niet meer onder haar naam');
  assert.equal((await api('/gezin/verjaardag/wens/verwijder', { code: G.code, token: G.token, wensId: 'bestaatniet' })).status, 200,
    'een wens die er niet is weghalen is geen fout');

  assert.equal((await api('/gezin/verjaardag/persoon/verwijder', { code: G.code, token: G.token, persoonId: 'bestaatniet' })).status, 404);
});

test('4. de gezondheidskaart is van wie hij is -- de vondst van dit bestand', async () => {
  const G = await gezin();
  assert.equal((await api('/gezin/gezondheid/afspraak',
    { code: G.code, token: G.token, wat: 'Controle bij de huisarts', datum: morgen(9) })).status, 200);
  assert.equal((await api('/gezin/gezondheid/meting', { code: G.code, token: G.token, gewicht: 78, lengte: 181 })).status, 200);

  /* De id's staan niet in het antwoord (de kaart geeft alleen ok terug); we
     lezen ze van de kaart zelf, zoals het scherm dat ook doet. */
  const mijnKaart = () => haal('/gezondheid', G.code, G.token)
    .then(k => (k.personen || []).find(x => x.pid === G.mijnId || x.naam === 'Ouder Een') || {});
  const kaart0 = await mijnKaart();
  const afspraakId = (kaart0.afspraken || []).find(a => /huisarts/.test(a.wat) || true).id;
  const metingId = (kaart0.metingen || [])[0].id;
  assert.ok(afspraakId && metingId, 'de kaart van de ouder is gevuld: ' + JSON.stringify(kaart0).slice(0, 200));

  /* HIER ZAT HET GAT. Het kind mocht met "voor" de kaart van zijn ouder
     aanwijzen en er zonder verdere controle uit wissen -- terwijl datzelfde
     kind het ochtendritme van die ouder niet mocht aanraken. */
  const kindWist = await api('/gezin/gezondheid/afspraak/verwijder',
    { code: G.code, token: G.kind.token, voor: G.mijnId, afspraakId });
  assert.equal(kindWist.status, 403, 'een kind wist de doktersafspraak van zijn ouder niet');
  assert.equal((await api('/gezin/gezondheid/meting/verwijder',
    { code: G.code, token: G.kind.token, voor: G.mijnId, metingId })).status, 403,
    'en zijn groeicurve al helemaal niet');

  // dezelfde regel als bij het ochtendritme, en die stond er al:
  assert.equal((await api('/gezin/ochtend/stap/verwijder',
    { code: G.code, token: G.kind.token, voor: G.mijnId, stapId: 'x' })).status, 403,
    'precies de controle die de gezondheidskaart nu ook heeft');

  assert.ok(((await mijnKaart()).afspraken || []).some(a => a.id === afspraakId), 'er is niets gewist');

  // andersom mag wel: een ouder beheert de kaart van een kind
  assert.equal((await api('/gezin/gezondheid/afspraak',
    { code: G.code, token: G.token, voor: G.kind.id, wat: 'Prik bij het consultatiebureau', datum: morgen(14) })).status, 200,
    'een ouder zet een afspraak op de kaart van het kind');
  const kindKaart = (await haal('/gezondheid', G.code, G.token)).personen.find(x => x.naam === 'Noor');
  assert.equal((await api('/gezin/gezondheid/afspraak/verwijder',
    { code: G.code, token: G.token, voor: G.kind.id, afspraakId: kindKaart.afspraken[0].id })).status, 200,
    'en haalt hem er ook weer af');

  // je eigen kaart blijft gewoon van jou
  assert.equal((await api('/gezin/gezondheid/afspraak/verwijder', { code: G.code, token: G.token, afspraakId })).status, 200);
  assert.equal((await api('/gezin/gezondheid/meting/verwijder', { code: G.code, token: G.token, metingId })).status, 200);

  // en een gast heeft helemaal geen gezondheidskaart
  assert.equal((await api('/gezin/gezondheid/afspraak/verwijder',
    { code: G.code, token: G.token, voor: G.gast.id, afspraakId: 'x' })).status, 400,
    'een gast heeft geen kaart om iets van te wissen');
});

test('5. een ochtendstap haalt weg wie hem mag beheren', async () => {
  const G = await gezin();
  const mk = await api('/gezin/ochtend/stap', { code: G.code, token: G.kind.token, tekst: 'Tanden poetsen' });
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const stapId = (mk.body.stap || mk.body.item || {}).id;

  assert.equal((await api('/gezin/ochtend/stap/verwijder',
    { code: G.code, token: G.token, voor: G.kind.id, stapId })).status, 200,
    'een ouder mag het ritme van een kind aanpassen');

  const na = await haal('/ochtend', G.code, G.kind.token);
  assert.ok(!(na.stappen || []).some(s => s.id === stapId), 'de stap is weg');
});

test('6. het wisverzoek is in te trekken zolang er nog niemand tekende', async () => {
  const G = await gezin();
  /* Twee volwassenen, dus wissen is een verzoek en geen daad. Dat vierogen-
     principe is precies waarom intrekken moet bestaan: tussen het verzoek en
     de tweede handtekening zit tijd om je te bedenken. */
  const vraag = await api('/gezin/wissen', { code: G.code, token: G.token, pin: '2468' });
  assert.equal(vraag.status, 200, JSON.stringify(vraag.body));
  assert.equal(vraag.body.wachtOpToestemming, true, 'met twee volwassenen is wissen een verzoek');

  assert.equal((await api('/gezin/wissen/intrekken', { code: G.code, token: G.kind.token })).status, 403,
    'een kind trekt het verzoek niet in');
  assert.equal((await api('/gezin/wissen/intrekken', { code: G.code, token: G.gast.token })).status, 403);

  const terug = await api('/gezin/wissen/intrekken', { code: G.code, token: G.token, pin: '2468' });
  assert.equal(terug.status, 200, JSON.stringify(terug.body));

  /* En daarna is er niets meer om te bevestigen: de tweede volwassene kan het
     gezin niet alsnog wissen op een verzoek dat is teruggenomen. */
  const alsnog = await api('/gezin/wissen/bevestig', { code: G.code, token: G.ouder2.token });
  assert.equal(alsnog.status, 400, 'er is geen verzoek meer om te bevestigen');
  assert.equal((await api('/gezin/agenda', { code: G.code, token: G.token, titel: 'Nog steeds hier', datum: morgen(2) })).status, 200,
    'het gezin bestaat gewoon nog');
});
