/* WAAR STAAT DEZE ROUTE? -- de bronverrijking van scripts/lib/routes.js.

   Die module verdeelt het werk in tweeen: de ROUTER bepaalt wat er bestaat, de
   BRON voegt toe waar het staat. Dat tweede mag mislukken zonder dat er iets
   verdwijnt -- een route zonder bron blijft gewoon in de lijst -- en juist
   daarom kan het stil misgaan. Twee proeven die dat tegenhouden, en ze meten
   tegengestelde dingen:

     DEKKING       hoeveel /api-routes hebben geen bron? Dat waren er 138, en het
                   was geen rariteit maar een blinde vlek: de uitdrukking eiste
                   een letterlijke tekenreeks als eerste argument en zag daarmee
                   niets van `app.post(p.pad + '/alias')` (de rtmail-lus),
                   `app.post('/api/member/spel/' + naam)` (de spellen-lus) of
                   een fabriek die EEN registratie veertig keer aanroept
                   (server/routes/verzorging.js). En een uitgecommentarieerd
                   voorbeeld telde net zo hard mee als echte code.

     JUISTHEID     wijst elke toewijzing naar een bestand waar dat pad ook
                   werkelijk in voorkomt? Dit is de gevaarlijkste faalvorm van
                   de reparatie hierboven: een ruimere zoektocht vindt meer, en
                   wat hij te ruim vindt wijst een melding naar het VERKEERDE
                   bestand. Dat is erger dan geen bestand, want het leest als een
                   antwoord.

   De eerste zonder de tweede is een vergiftigd getal. Ze staan hier daarom naast
   elkaar, en ze zakken los van elkaar.

   Draai los: node --test test/routesbron.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { alleRoutes, enigBestand } = require('../scripts/lib/routes.js');
const { zonderCommentaar } = require('../scripts/lib/bron.js');

const WORTEL = path.join(__dirname, '..');

/* De vier die er met reden buiten vallen: geen /api-routes maar de gebundelde
   stukken die de bundelaar zelf ophangt. Ze staan hier bij NAAM en niet als een
   getal -- een uitzondering die je niet kunt opnoemen is geen uitzondering maar
   een marge. */
const BUITEN = new Set(['/scriptblok.js', '/scriptbundel.js', '/stijlblok.css', '/stijlbundel.css']);

let _routes = null;
const routes = () => (_routes || (_routes = alleRoutes()));

test('elke /api-route heeft een bron', () => {
  const zonder = routes().filter(r => r.pad.startsWith('/api/') && !r.bestand);
  assert.deepEqual(zonder.map(r => r.methode + ' ' + r.pad), [],
    'deze routes bestaan wel maar zijn nergens in server/ terug te vinden; ' +
    'elke proef die per route iets over de BRON wil zeggen, slaat ze over');
});

test('de routes buiten /api zijn alleen de vier bundelstukken', () => {
  const zonder = routes().filter(r => !r.bestand);
  const paden = [...new Set(zonder.map(r => r.pad))].sort();
  for (const p of paden) {
    assert.ok(BUITEN.has(p), p + ' heeft geen bron en staat niet in de benoemde lijst; ' +
      'zet hem erbij met een reden, of maak hem vindbaar');
  }
});

test('elke toewijzing wijst naar een bestand waar het pad ook echt in staat', () => {
  const bestanden = new Map();
  const lees = (f) => {
    if (!bestanden.has(f)) bestanden.set(f, zonderCommentaar(fs.readFileSync(path.join(WORTEL, f), 'utf8'), { regelsHeel: true }));
    return bestanden.get(f);
  };
  const mis = [];
  let gekeken = 0;
  for (const r of routes()) {
    if (!r.bestand) continue;
    gekeken++;
    const t = lees(r.bestand);
    const delen = r.pad.split('/');
    /* Drie manieren waarop een pad in zijn bestand kan staan, en ze horen bij de
       drie manieren waarop de index hem kan hebben gevonden: heel, als staart
       (een sub-router), of als voorvoegsel (een lus of een fabriek). */
    let spoor = t.includes(r.pad);
    for (let i = 1; !spoor && i < delen.length; i++) spoor = t.includes('/' + delen.slice(i).join('/'));
    for (let i = delen.length; !spoor && i >= 3; i--) spoor = t.includes(delen.slice(0, i).join('/'));
    if (!spoor) mis.push(r.methode + ' ' + r.pad + ' -> ' + r.bestand + ':' + r.regel);
  }
  assert.ok(gekeken > 4000, 'er zijn echt routes gewogen: ' + gekeken);
  assert.deepEqual(mis.slice(0, 20), [],
    'deze routes wijzen naar een bestand waarin geen enkel spoor van hun pad staat -- ' +
    'een verkeerd bronbestand is erger dan geen bronbestand');
});

/* De regelnummers moeten in het BESTAND passen. Ze worden geteld op de
   platgeslagen bron; zou die vorm ooit regels inkorten, dan wijst elke melding
   een stukje omhoog en merkt niemand het. */
test('elk regelnummer bestaat in het bestand waar het bij hoort', () => {
  const lengte = new Map();
  const mis = [];
  for (const r of routes()) {
    if (!r.bestand || !r.regel) continue;
    if (!lengte.has(r.bestand)) {
      lengte.set(r.bestand, fs.readFileSync(path.join(WORTEL, r.bestand), 'utf8').split('\n').length);
    }
    if (r.regel < 1 || r.regel > lengte.get(r.bestand)) mis.push(r.pad + ' -> ' + r.bestand + ':' + r.regel);
  }
  assert.deepEqual(mis.slice(0, 20), [], 'deze regelnummers liggen buiten hun bestand');
});

/* DE REGEL DIE JE AAN DE UITKOMST NIET ZIET.

   De toets hierboven ("wijst naar een bestand waar het pad ook echt in staat")
   is met opzet zwak op EEN punt, en dat hoort hier te staan in plaats van
   verzwegen: claimen twee bestanden hetzelfde voorvoegsel, dan bevatten ze het
   allebei, en dan slaagt die controle ook als de verkeerde is gekozen. Ik heb
   dat nagemeten met een mutatie -- de dubbelzinnigheidsregel eruit, en de toets
   bleef groen.

   Wat de mis-toewijzing werkelijk tegenhoudt is dus niet een controle achteraf
   maar de regel zelf: bij meer dan een bestand geeft de index NIETS terug. Die
   regel wordt daarom hier los aangeroepen. Dit is precies het geval dat het een
   keer echt fout deed: server/routes/spellen.js registreert
   `app.post('/api/rtf/spel/' + naam)`, en server/kern/handlerpoorten/buiten.js
   CITEERT diezelfde regel in een commentaarblok. Twee claims, twee bestanden --
   en 42 spelroutes zonder bron. */
test('een claim die op twee bestanden wijst, levert niets op', () => {
  const kaart = new Map();
  kaart.set('/api/een', [{ bestand: 'server/a.js', regel: 12 }]);
  kaart.set('/api/twee', [{ bestand: 'server/a.js', regel: 30 }, { bestand: 'server/a.js', regel: 9 }]);
  kaart.set('/api/drie', [{ bestand: 'server/a.js', regel: 5 }, { bestand: 'server/b.js', regel: 5 }]);

  assert.equal(enigBestand(kaart, '/api/een').regel, 12, 'een kandidaat: gewoon die');
  assert.equal(enigBestand(kaart, '/api/twee').regel, 9,
    'twee claims uit HETZELFDE bestand blijven een ondubbelzinnig antwoord op de vraag WAAR; ' +
    'de vroegste regel wint. Zou dit null geven, dan straft de kaart een bestand voor duidelijkheid ' +
    '-- en dat kostte de 42 rtf-spelroutes hun bron');
  assert.equal(enigBestand(kaart, '/api/drie'), null,
    'twee VERSCHILLENDE bestanden: zwijgen. Een verkeerd bronbestand is erger dan geen, ' +
    'want het leest als een antwoord');
  assert.equal(enigBestand(kaart, '/api/bestaat-niet'), null);
});
