/* DE SEC-LOCK-INVARIANTEN -- software mag beveiliging automatisch verhogen,
   maar nooit zelfstandig verlagen.

   WAAROM DEZE VIER VOOR ELKE FEATURE UIT GAAN. RTG heeft de standen al
   (kern/incidentcontrole.js) en het centrale profiel al (kern/beschermstand.js).
   Wat ontbrak is de regel eromheen: niets hield tegen dat een pad de stand stil
   verlaagt, en niets hield vast dat de AI er niet bij kan. Dat is vandaag waar
   omdat niemand het heeft opgeschreven -- dat is toeval, geen grens. Een grens
   die alleen in een document staat, is over een half jaar weg.

   SEC-LOCK-001  Geen verlaging zonder ceremonie.
   SEC-LOCK-002  Geen AI-bereikbaar pad kan de beveiliging opheffen of verzwakken.
   SEC-LOCK-003  Een lagere drager neutraliseert de beperking van een hogere niet.
   SEC-LOCK-004  Een onbekende stand loopt niet door als `normaal`.

   WAT DEZE TOETS NIET BEWIJST, en dat hoort er even groot bij te staan: de
   ceremonie van 001 is vandaag een getypte zin ("HERSTEL RTG") van een
   eigenaar-only route. Dat is een drempel en geen passkey, geen apparaatbinding
   en geen vier ogen. De toets legt de drempel vast die er IS; hij zegt niet dat
   die genoeg is. Zie ISOLATIEPROEF.json, waar dit als schuld staat.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `verlaagt()` laten teruggeven dat `onvergelijkbaar` GEEN verlaging is
     -> 001-a ZAKT (RAAK).
   - de bevestigingszin uit de herstel-tak van routes/techniek/controle.js gehaald
     -> 001-b ZAKT (RAAK).
   - /api/techniek/controle/incident aan de LEZEN-lijst van beleid.js toegevoegd
     -> 002-a EN 002-b ZAKKEN (RAAK; de een leest de kaart, de ander de regexen).
   - /api/isolatie/mijn/zet aan de KLEIN-lijst van beleid.js toegevoegd
     -> 002-b ZAKT (RAAK). Deze mutatie zakte de EERSTE keer NIET: 002-b liep
     toen over een handgetypt rijtje van zeven paden waar de isolatielaag niet
     in stond. De proeflijst wordt sindsdien afgeleid uit alleRoutes(); pas
     daarna zag de toets zijn eigen onderwerp. Zonder die tweede ronde had hier
     een groene toets gestaan boven een gat.
   - `strengste()` de fijnste drager laten winnen in plaats van de join
     -> 003 ZAKT (RAAK), 001-a zakt niet mee.
   - de fail-closed in incidentcontrole.js terug op 'normaal'
     -> 004 ZAKT (RAAK).

   Draai los: node --test test/seclock.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ordening = require('../server/kern/isolatie/ordening');
const beleid = require('../server/kern/stuur/beleid');
const maakIncident = require('../server/kern/incidentcontrole');
const functies = require('../server/functies');
const { alleRoutes } = require('../scripts/lib/routes');

const root = path.join(__dirname, '..');

/* De paden die de beveiliging van dit huis ZETTEN. Niet met de hand
   opgeschreven maar herkend aan hun vorm, zodat een nieuw pad met dezelfde
   strekking er vanzelf onder valt. Wie hier iets bij zet, moet kunnen uitleggen
   waarom de AI het wel mag. */
const BEVEILIGINGSPAD = [
  /^\/api\/techniek\//,                    // de hele techniekhoek is eigenaar-only bediening
  /incident/i, /zekering/i, /schakel/i,
  /\/functie(\/|$)/i,                      // functieschakelaars
  /\/sso(\/|$)/i, /\/eigenaar(\/|$)/i,
  /bevoegdheid/i, /codewoord/i, /machtiging/i,
  /* DE ISOLATIELAAG ZELF, en die ontbrak hier -- een gat in de invariant die de
     laag moest bewaken. /api/techniek/isolatie/ viel toevallig onder de eerste
     regel, maar /api/isolatie/mijn/ontsluiting/commit onder geen enkele: de AI
     zou de bescherming van een lid dus mogen opheffen als iemand dat pad ooit op
     de allowlist zette. Precies wat SEC-LOCK-002 verbiedt, en precies wat een
     regel op "de techniekhoek" niet ziet omdat de ledenkant daar niet woont.

     Hij staat hier onderaan zodat zichtbaar blijft dat hij later is toegevoegd:
     de laag die de invariant bewaakt, was zelf niet bewaakt. */
  /^\/api\/isolatie\//
];
function isBeveiligingspad(pad) { return BEVEILIGINGSPAD.some(r => r.test(pad)); }

/* ---------------- SEC-LOCK-001: geen verlaging zonder ceremonie ---------------- */

test('SEC-LOCK-001-a: elke overgang naar een zwakkere of niet te ordenen stand telt als verlaging', () => {
  /* Vier standen op de ladder plus de eigenschap ernaast. Elke overgang wordt
     ingedeeld; er blijft er geen een over die als "niets aan de hand" wegvalt. */
  assert.equal(ordening.verlaagt('isolatie', 'normaal').verlaagt, true);
  assert.equal(ordening.verlaagt('beperkt', 'waakzaam').verlaagt, true);
  assert.equal(ordening.verlaagt('normaal', 'isolatie').verlaagt, false);
  assert.equal(ordening.verlaagt('waakzaam', 'waakzaam').verlaagt, false);

  /* DE BELANGRIJKSTE REGEL VAN DE VIER. `beschermd` is met opzet geen trede op
     de ladder, dus de overgang beschermd -> beperkt is NIET te ordenen. Wie die
     uitkomst als "geen verlaging" leest, heeft in de praktijk een verlaging
     goedgekeurd zonder het op te schrijven. Hij telt daarom als verlaging, met
     `zeker: false` erbij zodat een mens ziet dat het een indeling mist. */
  const dwars = ordening.verlaagt('beschermd', 'beperkt');
  assert.equal(dwars.uitslag, 'onvergelijkbaar');
  assert.equal(dwars.verlaagt, true, 'een niet te ordenen overgang mag nooit als "geen verlaging" tellen');
  assert.equal(dwars.zeker, false);
  assert.match(dwars.waarom, /niet te ordenen/);
});

test('SEC-LOCK-001-b: de enige verlagende handeling vraagt een ceremonie', () => {
  const bron = fs.readFileSync(path.join(root, 'server/routes/techniek/controle.js'), 'utf8');

  /* `herstel` is de enige actie die de stand terugzet naar normaal. Hij hoort
     achter een bevestiging te staan die niet per ongeluk te geven is. De toets
     leest de BRON en niet een vlag: een vlag die zichzelf goedkeurt, bewijst
     niets. */
  const herstelTak = bron.slice(bron.indexOf("body.actie === 'herstel'"));
  assert.match(herstelTak.slice(0, 400), /body\.bevestiging !== 'HERSTEL RTG'/,
    'herstel verlaagt de stand en moet een bevestigingszin eisen');

  /* En de route staat achter de eigenaar. Zonder die twee samen is de zin een
     formaliteit die iedereen met een sessie kan typen. */
  const incidentRegel = bron.split('\n').find(r => r.includes("'/api/techniek/controle/incident'"));
  assert.ok(incidentRegel && /techAuth/.test(incidentRegel) && /eigenaarAlleen/.test(incidentRegel),
    'de incidentroute hoort eigenaar-only te zijn');
});

/* ---------------- SEC-LOCK-002: de AI kan de beveiliging niet opheffen ---------------- */

test('SEC-LOCK-002-a: geen beveiligingspad is AI-bereikbaar volgens de executiekaart', () => {
  const kaart = require('../EXECUTION_MAP.json');
  const rijen = kaart.capabilities || [];
  assert.ok(rijen.length > 1000, 'de executiekaart hoort gevuld te zijn; leeg zou deze toets stil laten slagen');

  const lek = rijen.filter(r => isBeveiligingspad(r.pad) && r.bereik !== 'verboden');
  assert.deepEqual(lek, [], 'deze paden zetten de beveiliging en zijn toch AI-bereikbaar: ' +
    lek.map(r => r.rol + ' ' + r.pad + ' (' + r.bereik + ')').join(', '));
});

test('SEC-LOCK-002-b: geen enkele regex in de AI-allowlist raakt een beveiligingspad', () => {
  /* De kaart hierboven is een BOUWARTEFACT en kan een commit achterlopen. Deze
     tweede toets leest de bron zelf, zodat een nieuwe regel in beleid.js meteen
     zakt en niet pas na `npm run executionmap`.

     DE PROEFLIJST WORDT AFGELEID EN NIET GETYPT, en dat is een reparatie. Er
     stond hier een handgeschreven rijtje van zeven paden, en toen /api/isolatie/
     aan BEVEILIGINGSPAD werd toegevoegd, merkte deze toets dat niet: het pad
     stond niet in het rijtje. Een toets die zijn eigen onderwerp uit een tweede
     lijst haalt, groeit niet mee met de eerste -- LAT.md regel 4 in het klein. */
  const beveiligingspaden = alleRoutes()
    .map(r => r.pad)
    .filter(p => typeof p === 'string' && p.startsWith('/api/') && isBeveiligingspad(p));
  assert.ok(beveiligingspaden.length > 50,
    'er horen ruim beveiligingspaden te zijn; gevonden: ' + beveiligingspaden.length);

  for (const w of ['member', 'supplier', 'staff']) {
    for (const pad of beveiligingspaden) {
      const uit = beleid.beleidVoor(pad, w);
      assert.equal(uit.niveau, 'verboden', w + ' mag ' + pad + ' niet via de AI bereiken');
    }
  }

  /* En structureel: geen enkele opgenomen regex mag op een beveiligingspad
     passen. Dit vangt de indirecte weg -- een regex die per ongeluk breed is. */
  const lijsten = { LEZEN: beleid.LEZEN, KLEIN: beleid.KLEIN, VOORSTEL: beleid.VOORSTEL };
  const raak = [];
  for (const [naam, lijst] of Object.entries(lijsten)) {
    for (const [wereld, regexen] of Object.entries(lijst || {})) {
      for (const r of regexen || []) {
        for (const pad of beveiligingspaden) {
          if (r.test(pad)) raak.push(naam + '/' + wereld + ': ' + r + ' matcht ' + pad);
        }
      }
    }
  }
  assert.deepEqual(raak, [], raak.slice(0, 5).join('; '));
});

/* ---------------- SEC-LOCK-003: een kind neutraliseert zijn ouder niet ---------------- */

test('SEC-LOCK-003: een lagere drager kan de beperking van een hogere niet opheffen', () => {
  const standen = ['normaal', 'waakzaam', 'beperkt', 'beschermd', 'isolatie'];
  for (const ouder of standen) {
    for (const kind of standen) {
      assert.equal(ordening.neutraliseert(ouder, kind), false,
        'drager-stand "' + kind + '" verzwakt "' + ouder + '"');
    }
  }
  /* Concreet: huis in isolatie, sessie op normaal -> de sessie blijft isolatie. */
  const samen = ordening.strengste(['isolatie', 'normaal']);
  assert.equal(samen.trede, 'isolatie');
  /* En de eigenschap reist mee zodra EEN drager hem draagt. */
  assert.equal(ordening.strengste(['normaal', 'beschermd']).beschermd, true);
});

/* ---------------- SEC-LOCK-004: onbekend is niet normaal ---------------- */

test('SEC-LOCK-004: een onleesbare stand valt terug op beschermd en niet op normaal', () => {
  const meldingen = [];
  const db = { data: { techniek: { incidentcontrole: { modus: 'r0mmel', revisie: 3, actief: null, audit: [] } } } };
  const c = maakIncident({ db, save() {}, functies,
    beveilig: { meld: (bron, ernst, tekst) => meldingen.push({ bron, ernst, tekst }) } });

  const st = c.status();
  assert.equal(st.modus, 'beschermd', 'een onbekende stand mag niet als normaal doorlopen');
  assert.equal(st.bescherming.aan, true);
  assert.ok(st.standOnbepaald, 'de terugval hoort zichtbaar te zijn en niet alleen in een logregel');
  assert.equal(st.standOnbepaald.was, 'r0mmel');
  assert.ok(meldingen.some(m => m.ernst === 'kritiek'), 'de terugval hoort gemeld te worden');

  /* En de ordening leest dezelfde waarde op dezelfde manier -- een tweede
     oordeel op een andere plek is precies hoe twee schermen op een dag iets
     anders zeggen over dezelfde stand. */
  const paar = ordening.ontleed('r0mmel');
  assert.equal(paar.bekend, false);
  assert.equal(paar.beschermd, true);
  assert.equal(paar.trede, null);

  /* Een geldige stand raakt niet besmet door deze regel. */
  const db2 = { data: { techniek: { incidentcontrole: { modus: 'normaal', revisie: 0, actief: null, audit: [] } } } };
  assert.equal(maakIncident({ db: db2, save() {}, functies, beveilig: null }).status().modus, 'normaal');
});
