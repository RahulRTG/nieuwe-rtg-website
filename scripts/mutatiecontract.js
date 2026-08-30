#!/usr/bin/env node
/* ============================================================================
   HET MUTATIECONTRACTREGISTER -- afgeleid, nooit met de hand geschreven.

   WAT DIT IS. Per schrijfroute een regel met vijf assen: wat de mutatie is, wat
   "hetzelfde verzoek" betekent, wat er is gemeten, wie er binnen mag, en hoe
   hard onze kennis is. De vocabulaires staan in server/kern/mutatiecontract.js;
   dit script vult ze in uit de bronnen en telt het resultaat.

   WAAROM AFGELEID EN NIET EEN JSON DIE IEMAND BIJHOUDT. De kop van
   kern/mutatie.js zegt het al: "een register naast de code loopt achter op de
   dag dat iemand een route verplaatst". Daarom komt hier alles uit een bron:

     de routes        uit de draaiende router      (scripts/lib/routes.js)
     de deur          uit dezelfde router          (scripts/lib/bewakers.js)
     de duplicaatregel uit de verklaringen         (server/lib/idemsleutels.js)
     het bewijs       uit de laatste meting        (IDEMPROEF.json)
     de BEDOELING     uit de verklaringen bij de route (server/lib/mutatiecontracten.js)

   Alleen die laatste is mensenwerk, en dat hoort: de bedoeling van een route is
   geen waarneming.

   DE REGEL DIE DIT REGISTER EERLIJK HOUDT. Een stand wordt NOOIT afgeleid uit
   bewijs alleen. Het bewijs kan hooguit een VOORSTEL dragen; de stand komt uit
   een verklaring van een mens. Zou dit script zelf mogen indelen, dan stond er
   binnen een uur 100% geclassificeerd en wist niemand meer wat dat betekende --
   en dan is het register precies de schijnzekerheid die het moest voorkomen.

   Draaien:  node scripts/mutatiecontract.js [--vastleggen] [--open]
             --open toont de eerste vijftig regels die nog een besluit vragen
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { alleRoutes, isSchakel, bewakerskaart } = require('./lib/routes');
const { handlersUit } = require('./lib/schrijfanalyse');
const handlerpoorten = require('../server/kern/handlerpoorten');
const contract = require('../server/kern/mutatiecontract');
const { stempel } = require('./lib/stempel');
const { PUBLIEK } = require('./lib/publiekeroutes');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'MUTATIECONTRACT.json');
const vastleggen = process.argv.includes('--vastleggen');
const toonOpen = process.argv.includes('--open');

const sleutelVan = (methode, pad) => String(methode || 'POST').toUpperCase() + ' ' + pad;

/* ---------------------------------------------------------------------------
   DE BRONNEN
   ------------------------------------------------------------------------- */
const routes = alleRoutes()
  .filter(r => r.pad.startsWith('/api/') && String(r.methode).toUpperCase() !== 'GET')
  .filter(r => !isSchakel(r.pad));

let verklaringen = {};
try { verklaringen = require('../server/lib/idemsleutels').SLEUTELS; } catch (e) {}

let bedoelingen = {};
try { bedoelingen = require('../server/lib/mutatiecontracten').CONTRACTEN; } catch (e) {}
/* De afgeleide helft: alleen BLOCKED_BY_TEST_FIXTURE, en met opzet in een eigen
   bestand. Wie het opent moet meteen zien dat er geen mens over heeft nagedacht;
   ze door elkaar zetten zou de twee soorten kennis laten versmelten. */
let afgeleid = {};
try {
  afgeleid = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIECONTRACT-AFGELEID.json'), 'utf8')).contracten || {};
} catch (e) {}
const alleBedoelingen = Object.assign({}, afgeleid, bedoelingen);   // een mens wint van een script

let proef = { perRoute: [] };
try { proef = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8')); } catch (e) {}

/* DE TWEEDE BEWIJSLIJN, EN ALLEEN ALS VETO. SCHRIJFANALYSE.json zegt per route
   of de CODE kan schrijven. Zijn schrijfvormenlijst is met opzet te ruim, dus
   een 'ja' bewijst niets over wat er gebeurde -- maar hij weerlegt wel dat een
   route niets verandert. Zie de kop van scripts/schrijfanalyse.js. */
let statisch = new Map();
try {
  const sa = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SCHRIJFANALYSE.json'), 'utf8'));
  statisch = new Map((sa.perRoute || []).map(r => [r.route, r]));
} catch (e) {}
const meting = new Map((proef.perRoute || []).map(r => [sleutelVan(r.methode, r.pad), r]));
const gemetenOp = (proef.stempel && proef.stempel.op) || null;

/* ---------------------------------------------------------------------------
   DE WAARNEMING AAN DE DEUR -> een TOEGANG-klasse.

   Dit is met opzet een WAARNEMING en geen bedoeling. Hij zegt wat er in de
   router staat, en niets over wat iemand wilde. Waar de waarneming en de
   verklaarde bedoeling uiteenlopen, is dat een bevinding -- en dat is de enige
   manier waarop een verkeerd bedoelde deur ooit opvalt.

   `geenBewaker` en een lege bewakerslijst leveren met opzet NIETS op. Zo'n route
   kan met opzet open staan (PUBLIC) of in zijn handler bewaakt zijn
   (CAPABILITY_GATED), en die twee door elkaar halen is precies het gat dat de
   612 routes zonder laag vandaag vormen. Raden zou het gat onzichtbaar maken.
   ------------------------------------------------------------------------- */
const SOORT_NAAR_TOEGANG = {
  rol: 'AUTHENTICATED',
  eigenrol: 'AUTHENTICATED',
  objectpoort: 'OBJECT_SCOPED',
  lichaamssleutel: 'OBJECT_SCOPED',
  omgeving: 'SYSTEM_INTERNAL'
};

/* DE POORTEN DIE IN DE HANDLER STAAN.

   Voor 660 schrijfroutes staat de deur niet in de router maar in het lichaam, en
   dan ziet `r.bewakers` niets. server/kern/handlerpoorten.js draagt wat die
   poorten werkelijk doen -- gelezen, niet geraden -- en de sleutel is BESTAND EN
   NAAM, want `profiel`, `beheerVan` en `lidVan` betekenen elders iets anders.
   Een map op naam alleen zou een rekenfunctie als bewaker tellen. */
const uitHandler = new Map();
let meerdereTreffers = 0;
{
  const volledigePaden = routes.map(r => ({ methode: String(r.methode).toUpperCase(), pad: r.pad }));
  const VORMEN = [
    /* `const s = poort(req, res), t = ...` -- een samengestelde declaratie. Die
       eindigt op een KOMMA en niet op een puntkomma, en viel daarmee buiten de
       eerste vorm. Gemeten: vier handlers, waaronder de mailpoort van de
       RTFoundation (server/foundation/leden-mail.js). Vier is weinig, en een
       poort die je niet ziet is er een die als "geen deur" in het register
       belandt -- dat is de dure kant van deze fout, niet het aantal. */
    /* EN MET MEER DAN TWEE ARGUMENTEN. `const g = werkPoort(req, res, 'it');`
       is dezelfde poort met een derde argument dat zegt WELK recht binnen die
       werkruimte -- en die viel buiten deze vorm, want die eiste precies
       (req, res). Gemeten: 171 handlers erbij, waaronder vrijwel heel
       /api/bedrijf. De naam wordt nog steeds tegen het handgelezen register
       gehouden, dus een rekenfunctie die toevallig req en res krijgt, wordt
       hier geen deur. */
    /const\s+\w+\s*=\s*(\w+)\s*\(\s*req\s*,\s*res[^)]*\)\s*[;,]\s*(?:if\s*\(\s*!|\w)/,
    /const\s+\w+\s*=\s*(\w+)\s*\(\s*req\s*,\s*res\s*\)\s*;\s*if\s*\(\s*!/,
    /if\s*\(\s*!\s*(\w+)\s*\(\s*req\s*,\s*res[^)]*\)\s*\)\s*return/,
    /if\s*\(\s*(\w+)\s*\(\s*req\s*,\s*res[^)]*\)\s*\)\s*return/,
    /* EEN POORT VIA EEN NAMESPACE. `const s = sctx.lidVan(req, res); if (!s) return;`
       is dezelfde poort, alleen bereikt via het gedeelde contextobject. De naam
       die telt is die NA de punt; de namespace zelf zegt niets. Gemeten: veertien
       handlers, waarvan er dertien een poort noemen die het register al kent. */
    /\w+\.(\w+)\s*\(\s*req\s*,\s*res[^)]*\)/,
    /* EEN POORT DIE HET WERK OMHULT. `(req, res) => metPartner(req, res, p => ...)`:
       de poort controleert eerst en roept dan het werk aan met wat hij vond. De
       handler heeft geen eigen lichaam, dus geen van de vormen hierboven ziet
       hem. Gemeten: 39 handlers, drie poorten -- en 36 daarvan zitten al achter
       een bewaker op de router, dus dit levert er drie op. Weinig, maar een poort
       die je niet ziet, belandt als "geen deur" in het register. */
    /\)\s*=>\s*(?:\{\s*(?:return\s+)?)?(\w+)\s*\(\s*req\s*,\s*res\s*,/,
    /* EN EEN POORT DIE ALLEEN `req` KRIJGT. `const wie = wieScant(req); if (!wie)
       return res.status(401)...` -- de poort leest de kop zelf en antwoordt niet
       zelf, dus hij heeft geen `res` nodig. Gemeten: 136 handlers, waarvan 90 een
       poort noemen die het register al kent.

       Dit is de vorm waar de naamcontrole het zwaarst telt: `(req)` nemen doet
       elke hulpfunctie. `mij` uit routes/veiligheid.js is er zo een -- die LEEST
       req.session.key en controleert niets -- en staat daarom als `geen-deur` in
       het register. Zonder die regel kregen 23 routes hun klasse van een
       leesfunctie. */
    /const\s+\w+\s*=\s*(\w+)\s*\(\s*req\s*\)\s*;\s*if\s*\(\s*!/
  ];
  /* Het voorvoegsel waarmee dit bestand gemount is, afgeleid uit zijn EIGEN
     handlers die wel uniek matchen. Eén uitkomst of niets: twee verschillende
     voorvoegsels uit één bestand betekent dat we het niet weten. */
  const voorvoegselVan = (rel, handlers) => {
    const gezien = new Set();
    for (const h of handlers) {
      const k = volledigePaden.filter(v =>
        v.methode === h.methode && (v.pad === h.pad || v.pad.endsWith(h.pad)));
      if (k.length !== 1) continue;
      gezien.add(k[0].pad.slice(0, k[0].pad.length - h.pad.length));
      if (gezien.size > 1) return null;
    }
    return gezien.size === 1 ? [...gezien][0] : null;
  };

  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const pad = path.join(map, naam);
      const st = fs.statSync(pad);
      if (st.isDirectory()) { if (naam !== 'data' && naam !== 'node_modules') loop(pad); continue; }
      if (!naam.endsWith('.js')) continue;
      let hs = [];
      try { hs = handlersUit(fs.readFileSync(pad, 'utf8')); } catch (e) { continue; }
      const rel = path.relative(WORTEL, pad);
      for (const h of hs) {
        let g = null;
        for (const re of VORMEN) { const m = re.exec(h.lichaam); if (m) { g = m[1]; break; } }
        if (!g) continue;
        const poort = handlerpoorten.poortVan(rel, g);
        if (!poort) continue;
        /* HET PAD IN DE BRON IS NIET HET PAD IN DE ROUTER, en dat kostte hier
           een ronde. Een submodule schrijft `router.post('/school/aandacht')` en
           hangt via app.use('/api/foundation', ...) op
           /api/foundation/school/aandacht. De sleutel matchte dus 627 keer niet.

           Koppelen op ACHTERVOEGSEL, en alleen als er precies EEN route zo
           eindigt. Twee treffers betekent dat we niet weten welke het is, en dan
           is niets toewijzen het enige eerlijke -- een verkeerde toegangsklasse
           is erger dan geen. */
        const kandidaten = volledigePaden.filter(v =>
          v.methode === h.methode && (v.pad === h.pad || v.pad.endsWith(h.pad)));
        if (kandidaten.length === 1) { uitHandler.set(kandidaten[0].methode + ' ' + kandidaten[0].pad, poort); continue; }
        if (kandidaten.length < 2) continue;
        /* TWEE OF MEER TREFFERS: HET MONTAGEPAD BESLIST, EN DAT IS AF TE LEIDEN.

           `router.post('/agenda')` in server/foundation/onderwijs/schrift.js past
           op zeven routes -- /api/foundation/agenda, /api/genootschap/agenda,
           /api/supplier/care/agenda en nog vier. Niets toewijzen was tot nu toe
           het enige eerlijke, en dat kostte veertien routes een klasse die ze wel
           degelijk hebben.

           Het montagepad hoeft niet geraden te worden: het staat in de ANDERE
           handlers van hetzelfde bestand. Die matchen wel uniek, en het stuk dat
           bij hun bronpad wordt geplakt is het voorvoegsel van dat bestand. Zijn
           die het niet eens (of is er geen), dan blijft het bij niets toewijzen.

           Gemeten: veertien routes erbij, en NUL die daarna nog dubbelzinnig
           zijn -- de afleiding kiest dus nooit tussen twee kandidaten, hij vindt
           er precies een of geen. Dat is het verschil met een gok. */
        const prefix = voorvoegselVan(rel, hs);
        if (!prefix) { meerdereTreffers++; continue; }
        const exact = kandidaten.filter(v => v.pad === prefix + h.pad);
        if (exact.length === 1) uitHandler.set(exact[0].methode + ' ' + exact[0].pad, poort);
        else meerdereTreffers++;
      }
    }
  };
  try { loop(path.join(WORTEL, 'server')); } catch (e) {}
}

function waargenomenToegang(r) {
  const namen = Array.isArray(r.bewakers) ? r.bewakers : [];
  if (!r.bewakersBekend || !namen.length) {
    /* Geen deur in de router: staat hij in de handler? */
    const p = uitHandler.get(String(r.methode || 'POST').toUpperCase() + ' ' + r.pad);
    if (p && p.toegang) return p.toegang;
    /* EN DE LUSSEN. Een route die in een for-lus wordt aangemaakt heeft geen
       routeliteral in de brontekst, dus de lezer hierboven vindt hem niet -- ook
       al roept die lus wel degelijk een poort aan. Zie FAMILIES in
       server/kern/handlerpoorten/index.js: 43 routes stonden er zonder deur door. */
    const fam = handlerpoorten.poortVanRoute(r.pad);
    if (fam && fam.toegang) return fam.toegang;
    return publiekOfNiets(r);
  }
  /* scimAuth is een eigenrol in de bewakerskaart, maar het is geen mens: een
     eigen geheim per organisatie. Die uitzondering staat hier bij naam, want een
     kaart die hem als 'gewone rol' doorgeeft laat een koppeling eruitzien als
     een gebruiker. */
  if (namen.includes('scimAuth')) return 'SERVICE_TO_SERVICE';
  const RANG = { rol: 6, eigenrol: 5, lichaamssleutel: 4, objectpoort: 3, omgeving: 2, geenBewaker: 1, verfijner: 0, onbekend: 0 };
  const soorten = namen.map(n => bewakerskaart.soortVan(n));
  const zwaarste = soorten.slice().sort((a, b) => (RANG[b] || 0) - (RANG[a] || 0))[0];
  return SOORT_NAAR_TOEGANG[zwaarste] || publiekOfNiets(r);
}

/* STAAT HIJ MET REDEN OP DE PUBLIEKE LIJST?

   Geen poort is twee heel verschillende dingen: een gat, of een bewuste publieke
   deur. ./lib/publiekeroutes.js kent het verschil -- die lijst is door een mens
   geschreven, per route met de reden erbij, en keuringsregel 28 dwingt hem af.
   Een route die daar staat is niet "toegang onbekend" maar PUBLIC.

   HIJ STAAT OP ALLEBEI DE TAKKEN, en dat was eerst niet zo. De eerste versie
   keek alleen als er GEEN bewaker was -- maar /api/rtf/club/portaal heeft er
   twee, en het zijn allebei snelheidsremmen (ipRem, codeRem). Die tellen als
   bewaker, dus de publieke controle werd nooit bereikt en de route bleef
   "toegang niet af te leiden" terwijl zijn reden op regel 116 van die lijst
   staat. Een rem is geen deur; dat het er een LIJKT, is precies waarom deze
   vraag als laatste hoort te worden gesteld en niet als eerste. */
function publiekOfNiets(r) {
  return PUBLIEK.has(r.pad) ? 'PUBLIC' : null;
}

/* ---------------------------------------------------------------------------
   DE NAAM VAN DE MUTATIE.

   `POST /api/office/verificaties/goedkeuren` -> `office.verificaties.goedkeuren`.
   Een naam die los van het pad bestaat, zodat een route kan verhuizen zonder dat
   het contract een ander ding wordt. Dat is het verschil tussen een register van
   HANDELINGEN en een register van URL's.
   ------------------------------------------------------------------------- */
function mutatieIdVan(pad) {
  return pad.replace(/^\/api\//, '').replace(/\/:?/g, '.').replace(/[^A-Za-z0-9.\-_]/g, '');
}

/* ---------------------------------------------------------------------------
   HET VOORSTEL UIT HET BEWIJS.

   Geen stand -- een VOORSTEL, met de grond erbij. Wat hier uitkomt is wat een
   mens zou moeten bevestigen, en het bewijs waarop hij dat doet.

   Het leunt op de RONDE ZONDER SLEUTEL, want dat is de dubbeltik. De ronde MET
   sleutel meet server/middleware/idempotentie.js, en die staat voor elke
   /api-POST: daar "beschermd" uit lezen is de platformlaag verwarren met de
   route (nagemeten op 29 augustus 2026; zie scripts/idemvoorstel.js).
   ------------------------------------------------------------------------- */
function voorstelUitBewijs(m, sleutel) {
  if (!m) return { voorstel: null, grond: 'niet gemeten' };
  const z = m.zonderSleutel;
  if (!z) return { voorstel: null, grond: 'geen kale ronde in deze meting' };
  if (z.stand === 'beschermd') {
    /* DRIE GRONDEN, EN MAAR TWEE ERVAN ZIJN IDEMPOTENTIE.

       `opslag`  de eerste kale oproep deed werk, de herhaling niet. Dat IS het.
       `gemerkt` de server zei zelf `herhaald: true` zonder dat er een sleutel
                 meeging -- dat kan alleen de idem-poort zijn, op grond van een
                 verklaring.
       `geweigerd` de herhaling kreeg een 409 of een 403. Dat is een
                 TOESTANDSCONTROLE en geen herkende herhaling, en het verschil is
                 duur: een `zelfdeVerzoek` legt daar het eerste antwoord over een
                 bewuste weigering heen. Precies de fout die de kop van
                 server/middleware/idempotentie.js beschrijft, waar zestien
                 toetsen op zakten. */
    if (z.grond === 'geweigerd') {
      return { voorstel: null, grond: 'kale ronde: de herhaling werd GEWEIGERD (' + (z.statussen || []).join('/') +
        ') -- dat is een toestandscontrole en geen idempotentie; welke van de twee dit is, leest geen meter af' };
    }
    if (z.grond === 'opslag') {
      /* EEN VERSCHIL IN DE OPSLAG IS NIET ALTIJD WERK. Gemeten geval:
         POST /api/metier/zoek is een pure zoekroute, en toch bewoog er bij de
         eerste kale oproep iets ("wacht") en bij de tweede niet. Dat was geen
         gededupliceerde handeling maar een REM die zijn emmer bijwerkte. Een
         voorstel PROTECTED zou daar de verkeerde semantiek vastleggen: die route
         is NOT_APPLICABLE, hij verandert niets.

         De ruisijking van de idemproef vangt alleen wat bij ELKE oproep beweegt;
         een rem die alleen de eerste keer aanslaat glipt er per definitie langs.
         Daarom draagt dit voorstel de collecties met zich mee, zodat de mens die
         bevestigt ziet WAARIN het verschil zat. */
      const waar = Object.keys((z.opslag && z.opslag.d) || {}).join(', ');
      return { voorstel: 'PROTECTED', grond: 'kale ronde (opslag): het verschil zat in ' + (waar || 'onbekend') +
        '. NA TE KIJKEN: is dat werk van deze route, of een rem/meter die alleen de eerste keer aansloeg? ' +
        'In dat laatste geval is de juiste stand NOT_APPLICABLE en niet PROTECTED.' };
    }
    return { voorstel: 'PROTECTED', grond: 'kale ronde (' + (z.grond || 'grond niet vastgelegd') + '): ' + z.reden };
  }
  if (z.stand === 'onbeschermd') {
    /* Met opzet GEEN voorstel. Dit is precies het punt waar twee keer {} naar
       een dobbelworp twee worpen zijn en twee keer {} naar "maak een concern"
       een dubbeltik: het verschil zit in wat de handeling betekent, en dat leest
       geen meter af. */
    return { voorstel: null, grond: 'kale ronde: de herhaling deed het werk OPNIEUW -- ' +
      'of dat een dubbeltik is of een tweede handeling, beantwoordt geen meting' };
  }
  const st = z.statussen || [];
  const kaalOk = st.length === 2 && st.every(x => x >= 200 && x < 300);
  const leeg = (d) => !d || !Object.keys(d).length;
  if (kaalOk && z.opslag && leeg(z.opslag.d) && leeg(z.opslag.e)) {
    /* HET VETO. Twee onafhankelijke methodes die elkaar tegenspreken is een
       BEVINDING en geen voorstel: de opslagmeter zag niets veranderen, en de
       code zegt dat er wel iets kan veranderen. Dan gebeurt er iets dat de meter
       NIET ziet -- een bestand, een bericht, een teller buiten de gemeten
       collecties -- en dat is precies het gat waar NOT_APPLICABLE om `nagekeken`
       vraagt. Gemeten op 29 augustus 2026: 185 routes. */
    /* HET DERDE MEETPUNT (server/effectmeter.js), en het spreekt VOOR de
       statische analyse. Die laatste kan in dit huis niet ver kijken -- de
       routelaag krijgt haar modules via een contextobject uit server/opzet/, dus
       een aanroep als bank.bankOverboek() staat nergens als afhankelijkheid.
       Gemeten: een resolver over de modulegrens won 28 routes op 4.400.

       De effectmeter meet niet wat de code KAN maar wat dit verzoek HEEFT
       gedaan, op drie choke points (een schrijfpoging, een mail, een sms). Twee
       kale oproepen die allebei `geen` melden zijn daarmee een echte tweede
       bewijslijn onder NOT_APPLICABLE, in plaats van een tweede stilte. */
    const ef = z.effect;
    const kaalEffect = ef && ef.d != null && ef.e != null ? [ef.d, ef.e] : null;
    if (kaalEffect && kaalEffect.some(x => x !== 'geen')) {
      /* Hetzelfde veto als hieronder, maar nu GEMETEN in plaats van uit de
         brontekst gelezen: de opslagmeter zag niets en er gebeurde toch iets. */
      return { voorstel: null, grond: 'TEGENSPRAAK: de opslagmeter zag niets, maar de effectmeter telde ' +
        kaalEffect.join(' en ') + ' op de twee kale oproepen. Er verandert iets buiten de gemeten collecties; ' +
        'NOT_APPLICABLE zou hier bewijs voorwenden dat er niet is.' };
    }
    /* HET STATISCHE VETO WEEGT NIET MEER MEE ALS DE EFFECTMETER HEEFT GESPROKEN,
       en dat is een verscherping en geen versoepeling.

       De schrijfanalyse is met opzet te ruim ("uitstekend om iets te weerleggen,
       waardeloos om iets te bewijzen"). Haar bewijs loopt van `save()` -- een
       echte schrijfaanroep -- tot `Object.assign` en "toewijzing aan een veld",
       wat elke route doet die een antwoord samenstelt. Gemeten op de routes die
       hier stranden: 178 van de 194 worden geveto'd, en de treffers zijn
       `Object.assign`, een lijst-mutatie, of een variabele die `antwoord` heet.

       Zij bestond om te dekken wat de OPSLAGMETER niet ziet. Voor twee van die
       drie dingen -- een schrijfactie via save() en een bericht -- doet de
       effectmeter dat nu rechtstreeks, en beter: hij meet wat er GEBEURDE in
       plaats van wat de vorm van de code suggereert. Wat hij niet ziet (een
       bestand, een externe aanroep) noemt hij bij naam, en dat staat in elk
       contract dat op hem leunt.

       Dus: heeft de effectmeter een METING, dan wint die van een vorm. Zwijgt
       hij (geen kop), dan blijft het veto onverkort staan -- dan is de analyse
       weer de enige die het gat afdekt. */
    const sa = statisch.get(sleutel);
    if (sa && sa.schrijft === 'ja' && !kaalEffect) {
      return { voorstel: null, grond: 'TEGENSPRAAK: de opslagmeter zag niets, maar ' + sa.bestand +
        ' bevat een schrijfvorm (' + sa.waarom.replace(/^schrijfvorm gevonden: /, '') + '). ' +
        'Er verandert iets dat deze meter niet ziet; NOT_APPLICABLE zou hier bewijs voorwenden dat er niet is.' };
    }
    if (kaalEffect) {
      /* Twee meters, allebei nul, en de tweede kijkt buiten de collecties. Wat
         hij NIET ziet gaat mee in de grond en niet eronder: een bestand en een
         externe aanroep hebben geen choke point, en dat hoort een mens te lezen
         voordat hij dit aftekent. */
      return { voorstel: 'NOT_APPLICABLE', grond: 'kale ronde: twee geslaagde oproepen zonder spoor in de opslag, ' +
        'EN de effectmeter telde op allebei `geen` (geen schrijfpoging, geen mail, geen sms). Twee meters, ' +
        'twee keer nul. Wat geen van beide ziet: ' + (ef.nietGemeten || 'onbekend') + '.' };
    }
    return { voorstel: 'NOT_APPLICABLE', grond: 'kale ronde: twee geslaagde oproepen zonder spoor in de opslag' +
      (sa && sa.schrijft === 'nee' ? ', EN de statische analyse vindt geen enkele schrijfvorm in de handler ' +
        '(twee onafhankelijke methodes, dezelfde uitkomst)' : ', en de statische analyse kon de handler niet ' +
        'volgen -- na te kijken of hij buiten de gemeten collecties schrijft') };
  }
  if (m.hindernis) {
    return { voorstel: 'BLOCKED_BY_TEST_FIXTURE', grond: 'de proef kwam er niet bij: "' + m.hindernis + '"' };
  }
  return { voorstel: null, grond: z.reden || 'geen uitspraak' };
}

/* ---------------------------------------------------------------------------
   DE RONDE
   ------------------------------------------------------------------------- */
const rijen = [];
const tegenspraken = [];

for (const r of routes) {
  const sleutel = sleutelVan(r.methode, r.pad);
  const bedoeld = alleBedoelingen[sleutel] || null;
  const m = meting.get(sleutel) || null;
  const dup = verklaringen[sleutel] || null;
  const waargenomen = waargenomenToegang(r);
  const { voorstel, grond } = voorstelUitBewijs(m, sleutel);

  const rij = {
    mutatieId: (bedoeld && bedoeld.mutatieId) || mutatieIdVan(r.pad),
    route: sleutel,
    /* AS 1 + 2 -- uit hun eigen huizen, hier alleen samengebracht. */
    semantiek: bedoeld ? bedoeld.semantiek : null,
    duplicaatregel: dup ? Object.keys(dup)[0] : null,
    /* AS 4 -- waarneming en bedoeling apart, zodat een verschil opvalt. */
    toegang: {
      waargenomen,
      uitHandler: uitHandler.has(sleutel) ? (uitHandler.get(sleutel).veld ? 'object: ' + uitHandler.get(sleutel).veld :
        (uitHandler.get(sleutel).versmalt || uitHandler.get(sleutel).genre || 'ja')) : null,
      bedoeld: (bedoeld && bedoeld.toegang && bedoeld.toegang.klasse) || null,
      bewakers: Array.isArray(r.bewakers) ? r.bewakers : []
    },
    /* AS 3 */
    bewijs: m ? {
      op: gemetenOp,
      metSleutel: m.idempotentie,
      zonderSleutel: m.zonderSleutel ? m.zonderSleutel.stand : null,
      grond: m.zonderSleutel ? m.zonderSleutel.grond || null : null,
      hindernis: m.hindernis || null
    } : null,
    /* AS 5 -- alleen uit een verklaring. Nooit uit bewijs. */
    stand: (bedoeld && bedoeld.stand) || 'LEGACY_PENDING_CLASSIFICATION',
    herkomst: (bedoeld && bedoeld.herkomst) || null,
    voorstel: bedoeld ? null : voorstel,
    voorstelGrond: bedoeld ? null : grond
  };

  if (bedoeld && waargenomen && bedoeld.toegang && bedoeld.toegang.klasse &&
      bedoeld.toegang.klasse !== waargenomen) {
    tegenspraken.push({ route: sleutel, bedoeld: bedoeld.toegang.klasse, waargenomen,
      wat: 'de verklaarde toegang en de deur in de router zeggen niet hetzelfde' });
  }
  rijen.push(rij);
}

const t = contract.telling(rijen);

/* ---------------------------------------------------------------------------
   HET BORD
   ------------------------------------------------------------------------- */
const rij = (n, wat) => String(n).padStart(6) + '  ' + wat;
const pct = (n) => (t.totaal ? (100 * n / t.totaal).toFixed(1) : '0.0') + '%';

console.log('\n=== HET MUTATIECONTRACTREGISTER ===\n');
console.log(rij(t.totaal, 'schrijfroutes in de mutatie-inventaris'));
const openLegacy = t.perStand.LEGACY_PENDING_CLASSIFICATION || 0;
const doorMens = rijen.filter(r => r.herkomst === 'mens').length;
const doorScript = rijen.filter(r => r.herkomst === 'afgeleid').length;
console.log(rij(t.totaal - openLegacy, 'GECLASSIFICEERD  (' + pct(t.totaal - openLegacy) + ')'));
console.log(rij(doorMens, '   waarvan VASTGESTELD door een mens (een uitspraak over gedrag)'));
console.log(rij(doorScript, '   waarvan AFGELEID door een script (alleen: wij weten het niet, en waarom)'));
console.log('');
for (const naam of contract.STATUSNAMEN) {
  const n = t.perStand[naam] || 0;
  const d = contract.STATUS[naam];
  console.log(rij(n, naam + (d.naarNul ? '   <- de enige stand die naar NUL moet' : (d.eindstand ? '' : '   <- hoort te slinken'))));
}

console.log('\n  TOEGANG (waargenomen aan de router OF in de handler)\n');
console.log(rij(uitHandler.size, 'daarvan uit een poort IN de handler (server/kern/handlerpoorten.js)'));
if (meerdereTreffers) console.log(rij(meerdereTreffers, 'niet toegewezen: het bronpad past op meer dan een route'));
console.log('');
const waarTelling = {};
for (const r of rijen) { const k = r.toegang.waargenomen || '(niet af te leiden -- vraagt een verklaring)'; waarTelling[k] = (waarTelling[k] || 0) + 1; }
for (const [k, n] of Object.entries(waarTelling).sort((a, b) => b[1] - a[1])) console.log(rij(n, k));

console.log('\n  BEWIJS\n');
const bewijsTelling = { 'kale ronde: beschermd': 0, 'kale ronde: onbeschermd': 0, 'kale ronde: geen uitspraak': 0, 'niet gemeten': 0 };
for (const r of rijen) {
  if (!r.bewijs) bewijsTelling['niet gemeten']++;
  else if (r.bewijs.zonderSleutel === 'beschermd') bewijsTelling['kale ronde: beschermd']++;
  else if (r.bewijs.zonderSleutel === 'onbeschermd') bewijsTelling['kale ronde: onbeschermd']++;
  else bewijsTelling['kale ronde: geen uitspraak']++;
}
for (const [k, n] of Object.entries(bewijsTelling)) console.log(rij(n, k));

console.log('\n  VOORSTELLEN DIE KLAARLIGGEN (een mens bevestigt, deze meter niet)\n');
const voorstelTelling = {};
for (const r of rijen) if (r.voorstel) voorstelTelling[r.voorstel] = (voorstelTelling[r.voorstel] || 0) + 1;
if (!Object.keys(voorstelTelling).length) console.log('       geen');
for (const [k, n] of Object.entries(voorstelTelling).sort((a, b) => b[1] - a[1])) console.log(rij(n, k));

if (tegenspraken.length) {
  console.log('\n  TEGENSPRAAK -- verklaarde toegang tegen de deur in de router\n');
  for (const x of tegenspraken.slice(0, 20)) console.log('       ' + x.route + ': verklaard ' + x.bedoeld + ', router zegt ' + x.waargenomen);
}

if (toonOpen) {
  console.log('\n  DE EERSTE VIJFTIG DIE EEN BESLUIT VRAGEN\n');
  const open = rijen.filter(r => r.stand === 'LEGACY_PENDING_CLASSIFICATION');
  /* Eerst wat een voorstel draagt: die kosten seconden. */
  open.sort((a, b) => (b.voorstel ? 1 : 0) - (a.voorstel ? 1 : 0) || a.route.localeCompare(b.route));
  for (const r of open.slice(0, 50)) {
    console.log('       ' + (r.voorstel ? '[' + r.voorstel + '] ' : '[-] ') + r.route);
    console.log('             ' + (r.voorstelGrond || ''));
  }
}

/* ---------------------------------------------------------------------------
   DE AFLEIDGANG: schrijf BLOCKED_BY_TEST_FIXTURE uit voor elke route waar de
   proef aantoonbaar niet bij kwam. Alleen die stand, want alleen die doet geen
   uitspraak over gedrag -- zie de kop van kern/mutatiecontract/index.js.
   ------------------------------------------------------------------------- */
if (process.argv.includes('--afleiden')) {
  const uitContracten = {};
  for (const r of rijen) {
    /* NIET OP `stand` KIJKEN, MAAR OP DE MENSELIJKE LIJST -- en dit is een
       valstrik die deze gang stilletjes leeg zou maken.

       Na de eerste afleidgang staan die routes op BLOCKED_BY_TEST_FIXTURE. Een
       tweede gang die op `stand === LEGACY` filtert, slaat ze dus allemaal over,
       schrijft nul regels, en OVERSCHRIJFT het register met een lege lijst -- 2722
       regels weg zonder dat er iets veranderde, en de volgende meting zou het als
       vooruitgang lezen.

       De juiste vraag is dus niet "staat hij nog op LEGACY" maar "heeft een MENS
       hem al vastgesteld". Een afgeleide regel mag zichzelf opnieuw schrijven; een
       menselijke nooit overschrijven. */
    if (bedoelingen[r.route]) continue;
    const h = r.bewijs && r.bewijs.hindernis;
    if (!h) continue;
    const toeg = r.toegang.waargenomen;
    if (!toeg) continue;                       // zonder waargenomen deur geen geldig contract
    const toegang = { klasse: toeg };
    /* PUBLIC ZONDER REDEN IS EEN GAT, en de keuring weigert het terecht. De
       reden staat al geschreven, door een mens, in ./lib/publiekeroutes.js --
       dus die reist mee in plaats van dat er hier een nieuwe wordt bedacht. */
    if (toeg === 'PUBLIC') toegang.waarom = PUBLIEK.get(r.route.replace(/^\S+ /, '')) || null;
    if (toeg === 'OBJECT_SCOPED') {
      const p = uitHandler.get(r.route) || handlerpoorten.poortVanRoute(r.pad);
      /* En anders: staat de objectpoort op de ROUTER? De bewakerskaart weet dat
         het er een is, maar niet welk veld het object aanwijst. Zie
         ROUTERPOORTEN in server/kern/handlerpoorten/index.js. */
      const viaBewaker = (r.bewakers || []).map(n => handlerpoorten.veldVanBewaker(n)).find(Boolean);
      toegang.objectVeld = (p && p.veld) || viaBewaker || 'nog af te leiden uit de handler';
    }
    uitContracten[r.route] = {
      mutatieId: r.mutatieId,
      herkomst: 'afgeleid',
      semantiek: { klasse: 'onbekend' },
      toegang,
      stand: 'BLOCKED_BY_TEST_FIXTURE',
      /* De aftekening zegt hier precies wat zij is: een script, op grond van de
         hindernis die de route zelf teruggaf. Geen mens heeft gekeken, en dat
         hoort te blijven staan -- het is de hele reden dat deze regels apart van
         de menselijke contracten wonen. */
      afgetekend: { door: 'scripts/mutatiecontract.js --afleiden, op grond van de gemeten hindernis; ' +
        'geen mens heeft deze route gelezen', op: new Date().toISOString().slice(0, 10) },
      watErMoetKomen: 'de proef kwam hier niet bij: "' + h + '". Bouw die toestand in ' +
        'scripts/lib/idemwereld.js voordat deze route iets over zijn duplicaatgedrag kan zeggen.'
    };
  }
  fs.writeFileSync(path.join(WORTEL, 'MUTATIECONTRACT-AFGELEID.json'), JSON.stringify({
    stempel: stempel(),
    uitleg: 'Afgeleide mutatiecontracten -- GEEN MENS HEEFT HIER OVER NAGEDACHT. Geschreven door ' +
      'node scripts/mutatiecontract.js --afleiden, en overschreven bij elke volgende gang.',
    grens: 'Alleen BLOCKED_BY_TEST_FIXTURE. Vijf van de zes standen doen een uitspraak over GEDRAG en ' +
      'die mag geen script zetten -- geen meting leest de bedoeling van een handeling af. Deze stand doet ' +
      'de omgekeerde uitspraak: wij weten het niet, en dit is waarom de proef er niet bij kwam. De grond ' +
      'is hard: de route gaf zijn eigen hindernis terug. Wie een regel wil verbeteren, verhuist hem naar ' +
      'server/lib/mutatiecontracten.js -- een mens wint van een script.',
    waardeloosVoor: 'Een regel hier zegt NIETS over veiligheid en niets over idempotentie. Alleen: deze ' +
      'route bestaat, hij is niet gemeten, en dit moet er in scripts/lib/idemwereld.js komen voordat hij ' +
      'iets kan zeggen. Het is de wachtrij met per regel de reden -- beter dan diezelfde routes ongeteld ' +
      'op een hoop onder LEGACY.',
    aantal: Object.keys(uitContracten).length,
    contracten: uitContracten
  }, null, 1) + '\n');
  console.log('\n  MUTATIECONTRACT-AFGELEID.json geschreven: ' + Object.keys(uitContracten).length + ' regels.');
  console.log('  Draai daarna opnieuw met --vastleggen om ze in het register te krijgen.');
}

if (vastleggen) {
  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Per schrijfroute vijf assen: semantiek (kern/mutatie.js), duplicaatgedrag ' +
      '(lib/idemsleutels.js), bewijs (IDEMPROEF.json), toegang en stand ' +
      '(kern/mutatiecontract.js). Afgeleid uit die bronnen; alleen de BEDOELING komt uit ' +
      'server/lib/mutatiecontracten.js, want die is geen waarneming.',
    grens: 'Een stand wordt nooit afgeleid uit bewijs. Het bewijs draagt hooguit een VOORSTEL; ' +
      'de stand komt uit een verklaring van een mens. Zonder die regel staat dit register binnen ' +
      'een uur op 100% en weet niemand meer wat dat betekent.',
    gemeten: {
      totaal: t.totaal,
      geclassificeerd: t.totaal - (t.perStand.LEGACY_PENDING_CLASSIFICATION || 0),
      perStand: t.perStand,
      vastgesteldDoorMens: doorMens,
      afgeleidDoorScript: doorScript,
      toegangWaargenomen: waarTelling,
      bewijs: bewijsTelling,
      voorstellen: voorstelTelling,
      metingVan: gemetenOp
    },
    tegenspraken,
    rijen
  }, null, 1) + '\n');
  console.log('\n  MUTATIECONTRACT.json geschreven.');
} else {
  console.log('\n  (niets weggeschreven -- draai met --vastleggen)');
}
