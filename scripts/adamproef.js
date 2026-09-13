#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE ADAMPROEF -- de vierde gouden keten, en de eerste waarin de hoofdpersoon
   geen klant is maar een MENS die iets nodig heeft.

   WAAROM DEZE, NA TAFEL, RIT EN TOELATING. Die drie beantwoordden samen de
   vraag of er een gedeelde ketenvorm bestaat; KETENVORM.json zegt van niet
   (0 van 13 actoren gedeeld, 2 van 10 beloftethema's in alle drie, en die twee
   gaan over de machine en niet over het domein). Deze vierde keten stelt een
   andere vraag, en hij komt uit het voorstel voor RTFoundation als
   mensinfrastructuur:

       KAN EEN JONGERE VAN ZEVENTIEN, DIE GEEN HULPVRAAG HEEFT EN GEEN
       RTG-ACCOUNT, VIA DIT HUIS EEN MOGELIJKHEID BEREIKEN DIE ZIJN WERELD
       WEER GROTER MAAKT -- EN ZIET HIJ DAT ZELF?

   HIJ IS MET OPZET MAXIMAAL ANDERS DAN DE DRIE ANDERE. De klant is minderjarig
   en heeft geen eigen account (hij is een profiel in een RTF-gezin), er wordt
   niets betaald, en de uitkomst is een MOGELIJKHEID in plaats van een geleverde
   dienst. Waar de tafelketen eindigt bij een afrekening en de ritketen bij een
   afgeronde rit, eindigt deze bij de vraag of de uitkomst terugkomt bij de mens
   die hem aanging.

   ER IS GEEN GEDEELDE KETENMODULE, en dat is dezelfde keuze als bij de
   ritproef: een gedeelde ketenklasse eroverheen zou de `Asset`-fout zijn
   (DEVELOPERCLOUD.md par. 2). De VORM lijkt bewust op scripts/ritproef.js --
   schakels met een van/naar, storingen met een belofte -- en wat de ketens
   werkelijk delen telt scripts/ketenvorm.js achteraf uit de registers.

   WAT DEZE KETEN METEEN AL ANDERS DOET, en dat is de reden dat hij bestaat:

     - de hoofdpersoon heeft GEEN lidsessie. Elke schakel moet dus zeggen welke
       DEUR hij gebruikt, en een deur die dicht is, is hier een bevinding en
       geen defect;
     - de leeftijd is niet een detail maar de as waar alles om draait: 17 is
       oud genoeg om te werken (16+) en te jong voor de 18+-poort;
     - er komt geen geld aan te pas, dus de klassieke "is het betaald"-schakel
       bestaat hier niet. Wat ervoor in de plaats komt is BEREIKBAARHEID: kan
       de mens de motor die voor hem gemaakt is uberhaupt aanroepen?

   Draaien:  npm run adamproef            (print, zakt op een open schakel)
             npm run adamproef:vast       (schrijft ADAMPROEF.json)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
/* Het volle stempel (commit + boomVuil) en niet een kale datum: zonder
   waartegen-is-dit-gemeten is een register niet na te lopen. */
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'ADAMPROEF.json');
const WERKGEVER = 'BRISA';                 // Cafe Brisa uit de seed: een zaak met keukenwerk

/* De geboortedatum van een zeventienjarige, GEREKEND en niet ingetypt. Een
   vaste datum in een proef verloopt: hij is over een jaar achttien en dan meet
   deze keten stilletjes iets anders. */
function geborenJaarGeleden(jaren) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - jaren);
  d.setDate(d.getDate() - 30);             // ruim binnen het jaar, nooit op de rand
  return d.toISOString().slice(0, 10);
}

async function post(basis, pad, lijf, tok) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

function schakel(nr, van, naar, wat, bekend) { return { nr, van, naar, wat, bekend: bekend || null }; }

/* EEN OPEN SCHAKEL MET EEN UITGESCHREVEN REDEN IS EEN BEVINDING, GEEN DEFECT.

   Overgenomen uit scripts/ritproef.js, dat hem weer uit MET_REDEN in
   scripts/tikken.js heeft. Zonder die uitweg heeft een proef die iets echts
   vindt maar twee uitgangen: altijd zakken (dan zet iemand hem uit) of de
   bevinding wegpoetsen (dan meet hij niets meer). Met deze uitweg blijft de
   bevinding staan, in de uitslag, met het adres waar het besluit hoort te
   vallen.

   DE GRENS IS STRENGER DAN BIJ DE RITPROEF, en dat moest wel: deze keten gaat
   over een mens en niet over een rit, dus de verleiding om een gat "bewust" te
   noemen is groter. `bekend` moet daarom zeggen WAT er ontbreekt, WAAROM dat
   vandaag zo is, en WIE erover gaat. test/adamproef.test.js eist alle drie. */

/* Wat ADAM zelf ziet van zijn sollicitaties. Deze vorm staat hier een keer,
   want anders staat hij in elke schakel -- en dan meet een wijziging in die
   route drie schakels tegelijk zonder dat iemand weet welke. */
async function sollicitatiesVanAdam(basis, code, token) {
  const r = await post(basis, '/api/foundation/gezin/sollicitaties', { code, token });
  return (r.data && r.data.sollicitaties) || [];
}

/* ZOEKEN OP FUNCTIE EN NIET OP ID, EN DAT IS EEN MEETFOUT DIE HIER IS GEMAAKT.

   De tweede ronde van deze proef meldde bij schakel 10 "de uitkomst is weg".
   Dat was onwaar. `/gezin/sollicitaties` geeft per rij
   { bedrijf, func, land, landNaam, at, status, chatId } terug en GEEN `appId`
   -- die sleutel bestaat wel in de opslag maar niet in het antwoord. Er werd
   dus gezocht op een veld dat er niet is, en de uitslag las als een verdwenen
   uitkomst.

   Dat verdient de noot die LAT.md regel 11 bedoelt: een verdict is een
   BESCHULDIGING. "De uitkomst is weg" zegt dat dit huis een aangenomen
   zeventienjarige kwijtraakt, en dat mag niet in een register belanden omdat
   een proef de verkeerde sleutel gebruikte. Schakel 9 stond op dat moment
   trouwens op GROEN via een `|| mijn[0]`-terugval -- een fallback die een
   mismatch verbergt is erger dan geen fallback. Beide zijn hier weg. */
const rijVan = (lijst, func) => lijst.find(x => x.func === func) || null;

/* Het BORD van het gezin, waar een bericht van RTG landt. LET OP DE METHODE:
   /gezin/:code/berichten is een GET en niet een POST, net als /gezin/:code/mij.
   Dat kostte een ronde: schakel 10 postte naar /mij, kreeg een antwoord zonder
   `ongelezen`, las dat als 0 en meldde dat Adam niets hoorde -- terwijl het
   bericht er gewoon stond. Een verkeerde methode geeft hier geen fout maar een
   ANDER antwoord, en dat is precies hoe een meetfout als uitslag passeert. */
async function berichtenVanAdam(basis, code, token) {
  const r = await fetch(basis + '/api/foundation/gezin/' + code + '/berichten',
    { headers: { Authorization: 'Bearer ' + token } }).catch(() => null);
  if (!r) return [];
  const d = await r.json().catch(() => null);
  return (d && d.berichten) || [];
}

/* Wat de WERKGEVER van zijn sollicitaties ziet. Let op dat dit /api/supplier/
   state is en niet /api/supplier/apply: die tweede is de PUBLIEKE route waarmee
   iemand van buiten solliciteert, en hij heeft geen leverancierssessie nodig.
   De eerste ronde van deze proef las die route en kreeg "Bedrijf niet
   gevonden" -- een fout in het instrument die er als een kapotte keten uitzag.
   De projectie erachter is `werkgeverSollicitatie` (kern/werk.js), en die is
   precies de plek waar schakel 7 naar kijkt. */
async function sollicitatiesBijZaak(basis, S) {
  const r = await post(basis, '/api/supplier/state', {}, S);
  return (r.data && r.data.state && r.data.state.applications) || [];
}

/* Het id waarop de werkgever zijn besluit neemt. EEN BENOEMDE FUNCTIE EN GEEN
   IIFE, en dat is niet cosmetisch: toets 9 in test/adamproef.test.js bakent de
   zie-functies af op `async (...) => {` tot de eerstvolgende `return {`, en een
   `async () => { ... }()` ertussen laat die afbakening doorlopen tot voorbij de
   volgende schrijfroute. De toets meldde daardoor terecht dat een zie-functie
   `apply/decide` aanriep -- dat deed hij niet, maar zo zag het eruit, en een
   heuristiek die je omzeilt met een vorm is geen bewaker meer. Dezelfde les als
   in test/ritproef.test.js toets 2, waar de blokgrens ook al een keer te ver
   doorliep. */
async function idBijZaak(basis, S, func) {
  const lijst = await sollicitatiesBijZaak(basis, S);
  const rij = lijst.find(a => a.name === 'Adam' && a.func === func);
  return rij && rij.id;
}

/* Het gezin, Adam, zijn jongere zus en de oppas. De wereld klaarzetten is geen
   valsspelen; een uitslag klaarzetten wel (scripts/lib/herstelwereld.js). */
async function wereld(basis) {
  const P = (pad, lijf) => post(basis, '/api/foundation' + pad, lijf);
  const g = await P('/gezin/maak', { gezinsnaam: 'Familie Adam', naam: 'Ouder Adam', pin: '1234',
    bevoegdGezin: true, privacyAkkoord: true });
  if (!g.data || !g.data.code) throw new Error('geen gezin aan te maken (status ' + g.status + ')');
  const code = g.data.code, ouderToken = g.data.token;

  const maak = async (naam, jaren, rol) => {
    const p = await P('/gezin/profiel/maak',
      { code, token: ouderToken, naam, rol: rol || 'kind', geboortedatum: geborenJaarGeleden(jaren) });
    const id = p.data && p.data.profiel && p.data.profiel.id;
    if (!id) throw new Error('geen profiel "' + naam + '" (status ' + p.status + ': ' +
      ((p.data && p.data.error) || '') + ')');
    const kies = await P('/gezin/profiel/kies', { code, profielId: id });
    return { id, token: kies.data && kies.data.token, groep: p.data.profiel.groep,
      codenaam: kies.data && kies.data.profiel && kies.data.profiel.codenaam };
  };

  const adam = await maak('Adam', 17);
  const zus = await maak('Zus van Adam', 15);
  return { code, ouderToken, adam, zus };
}

/* Het cv dat Adam meestuurt. Klein en echt: de RTF-route eist naam, contact en
   inhoud, en weigert terecht een leeg cv (storing 5 meet dat). */
const CV = { name: 'Adam', contact: 'adam@voorbeeld.nl', headline: 'Wil graag in de keuken werken',
  skills: ['koken', 'afwassen'], about: 'Ik kook thuis veel en wil het vak leren.' };

async function loop(basis, uit) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const stap = async (s, doe, zien) => {
    const t0 = Date.now();
    let r, gezien = null, fout = null;
    try {
      r = await doe();
      if (!r || r.status < 200 || r.status >= 300) {
        /* EEN GEWEIGERDE DEUR IS NIET HETZELFDE ALS EEN KAPOTTE ROUTE, en dat
           onderscheid is bij deze keten de hele winst. Draagt de schakel een
           uitgeschreven reden, dan is een 4xx de MEETUITSLAG ("hier komt deze
           mens niet langs, en het huis zegt waarom") en geen storing.

           DE GRENS LIGT BIJ 4xx EN NIET HOGER, en dat is geen willekeur: een
           4xx is dit huis dat met opzet weigert en dat uitlegt, een 5xx of een
           0 is iets dat stuk is. Een proef die ook een 500 als "bekend" zou
           accepteren, kan een crash wegschrijven als een besluit.

           De eerste versie stond op 401/403. Schakel 4 liet zien dat dat te
           smal was: de knelpuntmotor weigert een kaal doel met een 400, en dat
           is net zo goed een uitgelegde weigering als een dichte deur. */
        const deur = (r && r.status >= 400 && r.status < 500) && s.bekend;
        uit.schakels.push(Object.assign({}, s, { stand: deur ? 'openBekend' : 'stuk',
          status: r ? r.status : 0, antwoord: r && r.data && (r.data.error || null), ms: Date.now() - t0 }));
        return null;
      }
      gezien = zien ? await zien(r) : null;
    } catch (e) { fout = String(e && e.message || e); }
    let stand = fout ? 'stuk' : (!zien ? 'gesloten' : (gezien && gezien.klopt ? 'gesloten' : 'open'));
    if (stand === 'open' && s.bekend) stand = 'openBekend';
    uit.schakels.push(Object.assign({}, s, { stand, status: r ? r.status : 0,
      ziet: gezien ? gezien.wat : null, fout, ms: Date.now() - t0 }));
    return r;
  };

  const w = await wereld(basis);
  uit.wereld = { gezin: 'via /api/foundation/gezin/maak', adam: 'profiel, 17 jaar, rol kind',
    zus: 'profiel, 15 jaar -- voor storing 1', werkgever: WERKGEVER };

  const zaak = await P('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  if (!zaak.data || !zaak.data.token) throw new Error('geen werkgeverssessie (status ' + zaak.status +
    ') -- draait de server met DEMO_SUPPLIER=' + WERKGEVER + '?');
  const S = zaak.data.token;
  const lid = await P('/api/login', { tier: 'rtg' });
  const M = lid.data && lid.data.token;

  /* 1 -- HET GEZIN ZET ADAM NEER. De leeftijdsgroep wordt BEREKEND uit de
     geboortedatum en niet gekozen (foundation/gezinshulp.js), en daar hangt
     alles aan wat hierna komt. Wie hier een groep zou mogen intypen, kan zich
     ouder maken en langs de vacature-eis lopen. */
  await stap(
    schakel(1, 'gezin', 'Adam', 'zet Adam neer; zijn leeftijdsgroep wordt berekend, niet gekozen'),
    async () => ({ status: 200, data: w.adam }),
    async () => ({ klopt: w.adam.groep === 'jong',
      wat: 'groep "' + w.adam.groep + '" (17 jaar -> jong, 16 t/m 21), codenaam ' + (w.adam.codenaam || '?') }));

  /* 2 -- ADAM NAAR DE KNELPUNTMOTOR. Dit is de schakel waar deze hele proef om
     draait, en de verwachting is dat hij NIET sluit.

     kern/knelpunt/ is de enige motor in dit huis die precies doet wat het
     Adam-verhaal vraagt: welke wegen zijn er, wat blokkeert ze, en wat is niet
     nagegaan. Zijn eigen kop noemt het voorbeeld waar hij voor gebouwd is --
     *de bottleneck is niet motivatie, de bottleneck is kinderopvang.* Maar
     routes/knelpunt.js hangt hem achter `auth`, en `auth` eist een LIDsessie
     (een account of een demo-persona). Een RTF-gezinsprofiel heeft die niet.

     De motor die voor deze mens gemaakt is, is voor deze mens niet bereikbaar.
     Dat is geen defect -- elke regel code klopt -- en daarom draagt hij een
     reden in plaats van een rood kruis. */
  await stap(
    schakel(2, 'Adam', 'knelpuntmotor', 'legt zijn doel voor en vraagt welke wegen openliggen',
      'WAT ONTBREEKT: een ingang op /api/knelpunt voor een RTF-gezinsprofiel. ' +
      'WAAROM: routes/knelpunt.js hangt achter `auth` (opzet/diensten2.js), en dat eist een lidsessie ' +
      'met een account of een demo-persona; een gezinstoken van /api/foundation is een andere sessie. ' +
      'De motor is dus bereikbaar voor wie een RTG-account heeft en niet voor het gezin waar hij voor ' +
      'beschreven is. WIE EROVER GAAT: de eigenaar -- dit is dezelfde vraag als de ouderingang op de ' +
      'kinderopvang (kern/verzorging/opvangleden.js), die er kwam als BESLUIT en niet als functie.'),
    () => P('/api/knelpunt', { doel: 'weer aan het werk of aan het leren' }, w.adam.token));

  /* 3 -- DEZELFDE VRAAG ALS LID. Zonder deze schakel is schakel 2 niet te
     lezen: een dichte deur en een kapotte motor zien er van buiten hetzelfde
     uit. Hier wordt bewezen dat de motor WERKT en zijn regels houdt -- dus dat
     wat Adam mist een deur is en geen functie. */
  await stap(
    schakel(3, 'lid', 'knelpuntmotor', 'stelt dezelfde vraag met een lidsessie; de motor werkt en rangschikt niet'),
    () => P('/api/knelpunt', {
      doel: 'weer aan het werk of aan het leren',
      randvoorwaarden: [
        { id: 'vervoer', wat: 'kan ik er komen', stand: 'vervuld' },
        { id: 'leeftijd', wat: 'ben ik oud genoeg', stand: 'vervuld' },
        { id: 'diploma', wat: 'heb ik een startkwalificatie', stand: 'ontbreekt' }
      ],
      manieren: [
        { id: 'bijbaan', wat: 'een bijbaan in de horeca', nodig: ['vervoer', 'leeftijd'] },
        { id: 'bbl', wat: 'een bbl-opleiding', nodig: ['vervoer', 'leeftijd', 'diploma'] },
        { id: 'vrijwillig', wat: 'vrijwilligerswerk', nodig: ['vervoer'] }
      ]
    }, M),
    async r => {
      const wegen = (r.data && r.data.manieren) || [];
      const bbl = wegen.find(x => x.id === 'bbl');
      // regel 1: de geblokkeerde weg BLIJFT staan, met wat hem zou openen
      const blijft = !!bbl && bbl.stand === 'geblokkeerd' && (bbl.zouOpenenAls || []).length > 0;
      // regel 4: de volgorde is de aangeleverde volgorde, er wordt niets gesorteerd
      const ongesorteerd = wegen.map(x => x.id).join(',') === 'bijbaan,bbl,vrijwillig';
      return { klopt: wegen.length === 3 && blijft && ongesorteerd,
        wat: wegen.length + ' wegen, volgorde ongewijzigd: ' + ongesorteerd +
          ', geblokkeerde weg blijft staan met "' + ((bbl && bbl.zouOpenenAls) || []).join(', ') + '"' };
    });

  /* 4 -- DE AANVOER. Dit is de schakel die door een MUTATIE is gevonden en niet
     door na te denken, en hij is belangrijker dan schakel 2.

     Bij het natrekken van schakel 2 is `auth` er tijdelijk afgehaald, om te
     bewijzen dat daar een DEUR zit en geen kapotte motor. Met de deur open
     sloot de schakel niet alsnog: hij werd `stuk` met een 400. De reden staat
     in kern/knelpunt/index.js zelf -- `reken()` eist `manieren`, en zonder
     manieren valt er niets te vergelijken. Dat is een eerlijke motor.

     Maar het betekent dat de AANROEPER de wegen al moet kennen. En niemand
     levert ze: /api/knelpunt heeft in dit huis nul aanroepers -- geen scherm in
     public/, geen module in server/, alleen de route zelf, twee registers en
     een regel in de functielijst.

     Een mens zegt "ik wil weer aan het werk". Dat is een DOEL zonder wegen.
     Deze schakel meet precies dat geval, met een lidsessie, zodat de deur van
     schakel 2 er niet tussen zit: wat gebeurt er als er alleen een doel is?

     DIT IS DE WORLD OPPORTUNITY GRAPH-VRAAG, en het antwoord is dat de
     rekenmachine er staat en de aanvoer niet. */
  await stap(
    schakel(4, 'mens', 'knelpuntmotor', 'noemt alleen een doel; iets in dit huis levert de mogelijke wegen aan',
      'WAT ONTBREEKT: een bron die uit een doel de MANIEREN samenstelt. kern/knelpunt/ rekent ze door, ' +
      'maar krijgt ze van de aanroeper -- en /api/knelpunt heeft nul aanroepers (geen scherm in public/, ' +
      'geen module in server/; alleen de route, lib/mutatiecontracten-knelpunt.js, ' +
      'lib/idemsleutels-bescherming.js en functies/register/cat-life.js noemen het pad). ' +
      'WAAROM: de motor is met opzet een rekenmachine en geen zoeker -- hij mag niet rangschikken en niets ' +
      'weglaten (regel 1 en 4), dus zelf wegen VERZINNEN zou precies die grens breken. De aanvoer hoort ' +
      'ernaast te staan en niet erin. WIE EROVER GAAT: de eigenaar. Dit is de kern van het voorstel voor ' +
      'een kansengraaf: kern/knelpunt/openingen-kaart.js dekt vandaag 5 terreinen (werk, opleiding, opvang, ' +
      'vervoer, wonen) en die kaart geeft INGANGEN bij een knelpunt, geen wegen bij een doel.'),
    () => P('/api/knelpunt', { doel: 'ik wil weer aan het werk' }, M),
    async r => ({ klopt: !!(r.data && r.data.manieren && r.data.manieren.length),
      wat: 'de motor gaf ' + (((r.data && r.data.manieren) || []).length) + ' wegen bij een kaal doel' }));

  /* 5 -- DE WERKGEVER ZET EEN BIJBAAN OPEN, met een minimumleeftijd. Vanaf hier
     loopt de keten over routes die Adam WEL kan bereiken (/api/rtf/...), en dat
     contrast met schakel 2 is zelf een bevinding: solliciteren kan hij wel,
     uitzoeken welke wegen er zijn niet. */
  const vac = await stap(
    schakel(5, 'werkgever', 'huis', 'zet een bijbaan open met een minimumleeftijd van 16'),
    () => P('/api/supplier/vacature', { func: 'Keukenhulp', soort: 'bijbaan', minLeeftijd: 16,
      omschrijving: 'Meehelpen in de keuken, woensdagmiddag en zaterdag.' }, S),
    async r => {
      const v = ((r.data && r.data.vacatures) || []).find(x => x.func === 'Keukenhulp');
      return { klopt: !!v && v.open === true && v.minLeeftijd === 16,
        wat: v ? 'vacature ' + v.id + ', minimumleeftijd ' + v.minLeeftijd : 'geen vacature terug' };
    });
  const vacId = (() => {
    const l = (vac && vac.data && vac.data.vacatures) || [];
    const v = l.find(x => x.func === 'Keukenhulp');
    return v && v.id;
  })();
  if (!vacId) throw new Error('geen vacature-id -- zonder vacature meet de rest van de keten de opstelling');

  /* 6 -- ADAM ZIET DE VACATURE. En belangrijker: het huis zegt hem of hij mag
     solliciteren, in plaats van hem te laten proberen en dan te weigeren. */
  await stap(
    schakel(6, 'huis', 'Adam', 'toont de vacature en zegt of hij mag solliciteren'),
    () => P('/api/rtf/vacatures', { leeftijd: 17 }),
    async r => {
      const lijst = (r.data && r.data.vacatures) || [];
      return { klopt: lijst.some(v => v.id === vacId) && r.data.magSolliciteren === true,
        wat: lijst.length + ' vacatures zichtbaar, magSolliciteren: ' + r.data.magSolliciteren };
    });

  /* 7 -- ADAM SOLLICITEERT vanuit zijn gezinsprofiel. De leeftijd komt uit het
     PROFIEL en niet uit het verzoek; storing 2 hieronder trekt dat na. */
  await stap(
    schakel(7, 'Adam', 'werkgever', 'solliciteert vanuit zijn gezinsprofiel, met zijn cv'),
    () => P('/api/rtf/solliciteer', { code: w.code, token: w.adam.token, supplierCode: WERKGEVER,
      vacatureId: vacId, cv: CV, note: 'Ik kook thuis veel.' }),
    async r => ({ klopt: r.data && r.data.ok === true, wat: 'aangenomen door de route: ' + !!(r.data && r.data.ok) }));

  /* 8 -- DE WERKGEVER ZIET HEM, en ziet NIET dat hij via de Foundation komt.
     Dat is een privacygrens en geen detail: een werkgever die weet dat een
     sollicitant uit een RTF-gezin komt, weet iets over zijn thuissituatie. */
  await stap(
    schakel(8, 'werkgever', 'huis', 'ziet de sollicitatie, zonder dat de Foundation-herkomst zichtbaar is'),
    () => P('/api/supplier/state', {}, S),
    async () => {
      const lijst = await sollicitatiesBijZaak(basis, S);
      const mijn = lijst.find(a => a.name === 'Adam' && a.func === 'Keukenhulp');
      /* De projectie hoort `viaRTF`, `rtf` en `key` te hebben WEGGELATEN en er
         `viaRTG` voor in de plaats te zetten: een sollicitant uit een gezin
         lijkt op een gewoon RTG-lid. Wie dat weglekt, vertelt een werkgever
         iets over de thuissituatie van een zeventienjarige. */
      const lekt = !!mijn && ('viaRTF' in mijn || 'rtf' in mijn || 'key' in mijn);
      return { klopt: !!mijn && !lekt && mijn.viaRTG === true,
        wat: mijn ? 'sollicitatie ' + mijn.id + ', status "' + mijn.status + '", lekt herkomst: ' + lekt +
          ', ziet viaRTG: ' + (mijn.viaRTG === true)
          : 'de werkgever ziet geen sollicitatie van Adam' };
    });
  const sollId = await idBijZaak(basis, S, 'Keukenhulp');
  if (!sollId) throw new Error('geen sollicitatie-id -- zonder sollicitatie meet de rest van de keten de opstelling');

  /* 9 -- DE WERKGEVER NODIGT UIT, en Adam kan het gesprek lezen. */
  await stap(
    schakel(9, 'werkgever', 'Adam', 'nodigt uit voor een kennismaking; Adam ziet de stand veranderen'),
    () => P('/api/supplier/apply/decide', { id: sollId, action: 'uitnodigen' }, S),
    async () => {
      const s = rijVan(await sollicitatiesVanAdam(basis, w.code, w.adam.token), 'Keukenhulp');
      return { klopt: !!s && s.status === 'uitgenodigd',
        wat: s ? 'Adam ziet status "' + s.status + '" bij ' + (s.bedrijf || '?') : 'Adam ziet zijn sollicitatie niet' };
    });

  /* 10 -- DE WERKGEVER NEEMT AAN, EN ADAM WORDT GEHAALD.

     DIT WAS DE DERDE BEVINDING VAN DE EERSTE RONDE, EN ZIJ IS GEREPAREERD.
     `notifyApplicant` in kern/werk.js stopte met `if (!a.key) return`; `a.key`
     is een LIDsessiesleutel en de rij die routes/member/werk/rtf.js aanmaakt
     draagt `rtf: { code, profielId }`. Een aangenomen zeventienjarige hoorde
     dus niets -- zijn stand werd wel bijgewerkt, dus hij kon het zien als hij
     keek, maar hij werd niet gehaald.

     De reparatie is met opzet GEEN tweede tak voor RTF: kern/ontvanger.js stelt
     de vraag zelf (welke wegen heeft deze ontvanger, en wat gebeurde er met
     elk), zodat de volgende vorm niet opnieuw stil wegvalt. De gezinsweg loopt
     via foundation/systeembericht.js naar het gezinsbord en NIET naar
     db.data.notifications -- die bak heeft aan de foundation-kant nul lezers,
     en daarheen schrijven zou het dode spoor een deur verder verplaatsen.

     Deze schakel meet de UITKOMST en niet de code: staat er een bericht van
     RTG op het bord van Adam, ongelezen, en is het aan hem gericht? */
  await stap(
    schakel(10, 'werkgever', 'Adam', 'neemt hem aan; Adam hoort dat, en hoeft er niet zelf naar te zoeken'),
    () => P('/api/supplier/apply/decide', { id: sollId, action: 'aannemen' }, S),
    async () => {
      const s2 = rijVan(await sollicitatiesVanAdam(basis, w.code, w.adam.token), 'Keukenhulp');
      const bord = await berichtenVanAdam(basis, w.code, w.adam.token);
      /* Aan HEM gericht en niet aan het gezin: of een zeventienjarige is
         aangenomen is zijn nieuws. `vanMij` vals bewijst dat de afzender het
         huis is en geen gezinslid. */
      const bericht = bord.find(b => b.naar === w.adam.id && b.vanMij === false && /aangenomen/i.test(b.tekst || ''));
      return { klopt: s2 && s2.status === 'aangenomen' && !!bericht && bericht.gelezen === false,
        wat: 'stand bij Adam: "' + (s2 && s2.status) + '", bericht op zijn bord: ' +
          (bericht ? '"' + String(bericht.tekst).slice(0, 60) + '..." van ' + bericht.vanNaam +
            ', ongelezen: ' + (bericht.gelezen === false) : 'geen') };
    });

  /* 11 -- DE UITKOMST KOMT TERUG BIJ ADAM. De laatste schakel van elke keten in
     dit huis stelt dezelfde vraag: staat het er ook nog als iedereen weg is? */
  await stap(
    schakel(11, 'huis', 'Adam', 'houdt de uitkomst vast in zijn eigen beeld, ook na afloop'),
    async () => ({ status: 200, data: null }),
    async () => {
      const s = rijVan(await sollicitatiesVanAdam(basis, w.code, w.adam.token), 'Keukenhulp');
      return { klopt: !!s && s.status === 'aangenomen' && !!s.bedrijf,
        wat: s ? 'blijft staan: ' + s.func + ' bij ' + s.bedrijf + ' (' + s.status + ')' : 'de uitkomst is weg' };
    });

  return { w, S, M, vacId };
}

/* ---- STORINGEN: houdt de keten zijn belofte als het misgaat? Een gebroken
   belofte is hier WEL een defect -- een grens die niet houdt is geen bevinding
   maar een gat. ---- */
async function storingen(basis, uit, ctx) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const { w, S, M, vacId } = ctx;
  const noteer = (naam, belofte, gehouden, wat) =>
    uit.storingen.push({ naam, belofte, stand: gehouden ? 'gehouden' : 'gebroken', wat });

  /* Elke storing die over solliciteren gaat krijgt zijn EIGEN vacature. Zonder
     dat loopt hij tegen de dubbel-tak aan in plaats van tegen de grens die hij
     wil meten -- zie de noot bij storing 4. */
  const maakVacature = async func => {
    const r = await P('/api/supplier/vacature',
      { func, soort: 'bijbaan', minLeeftijd: 16, omschrijving: 'Werk voor een scholier.' }, S);
    const v = ((r.data && r.data.vacatures) || []).find(x => x.func === func);
    if (!v) throw new Error('geen vacature "' + func + '" (status ' + r.status + ')');
    return v.id;
  };

  /* 1. DE JONGERE ZUS. Vijftien, dus onder de grens van zestien. Een weigering
     hoort de reden te dragen EN de weg eromheen -- anders is het een muur. */
  const tejong = await P('/api/rtf/solliciteer', { code: w.code, token: w.zus.token,
    supplierCode: WERKGEVER, vacatureId: vacId, cv: CV });
  noteer('een gezinslid van vijftien solliciteert',
    'wordt geweigerd met de leeftijd erbij en met wat er voor hem WEL is',
    tejong.status === 403 && /16/.test(String(tejong.data && tejong.data.error)) &&
      /leer|groei/i.test(String(tejong.data && tejong.data.error)),
    'status ' + tejong.status + ': "' + String((tejong.data && tejong.data.error) || '').slice(0, 90) + '"');

  /* 2. DE CLIENT LIEGT OVER DE LEEFTIJD. Dit is de reparatie die in rtf.js
     beschreven staat: de leeftijd kwam ooit uit het VERZOEK. Als die tak ooit
     terugkomt, komt de zus er met een getal doorheen. */
  const gelogen = await P('/api/rtf/solliciteer', { code: w.code, token: w.zus.token,
    supplierCode: WERKGEVER, vacatureId: vacId, cv: CV, leeftijd: 25 });
  noteer('de client stuurt een hogere leeftijd mee dan het profiel draagt',
    'verandert niets: de leeftijd komt uit het profiel op de server',
    gelogen.status === 403,
    'status ' + gelogen.status + ' (met leeftijd:25 in het verzoek)');

  /* 3. TWEE KEER DEZELFDE VACATURE. Niet omdat dubbel solliciteren erg is, maar
     omdat een tweede rij bij de werkgever een tweede mens suggereert. */
  const nog = await P('/api/rtf/solliciteer', { code: w.code, token: w.adam.token,
    supplierCode: WERKGEVER, vacatureId: vacId, cv: CV });
  const aantalAdam = (await sollicitatiesBijZaak(basis, S)).filter(a => a.name === 'Adam' && a.func === 'Keukenhulp').length;
  noteer('Adam solliciteert een tweede keer op dezelfde vacature',
    'wordt geweigerd, en er staat er bij de werkgever nog steeds maar EEN',
    nog.status === 409 && aantalAdam === 1,
    'status ' + nog.status + ', rijen bij de werkgever: ' + aantalAdam);

  /* 4. SOLLICITEREN ZONDER CV. Een weigering mag geen half spoor achterlaten --
     dezelfde fout als de vacaturelijst die werd aangemaakt voor de keuring
     (routes/supplier/werving/sollicitaties.js).

     OP EEN VERSE VACATURE, en dat is geen detail. De eerste ronde deed dit op
     dezelfde vacature als storing 3, en kreeg toen een 409 van de DUBBEL-tak in
     plaats van van de cv-tak -- dezelfde status, een andere reden, en de proef
     stond op groen voor iets dat hij niet had gemeten. Een volgordefout in het
     instrument leest als een uitslag. */
  const vacCv = await maakVacature('Bezorger');
  const voor = (await sollicitatiesBijZaak(basis, S)).length;
  const zonderCv = await P('/api/rtf/solliciteer', { code: w.code, token: w.adam.token,
    supplierCode: WERKGEVER, vacatureId: vacCv, cv: { name: 'Adam' } });
  const na = (await sollicitatiesBijZaak(basis, S)).length;
  noteer('Adam solliciteert zonder een afgemaakt cv',
    'wordt geweigerd met needCv, en laat geen rij achter bij de werkgever',
    zonderCv.status === 409 && zonderCv.data && zonderCv.data.needCv === true && voor === na,
    'status ' + zonderCv.status + ', needCv: ' + !!(zonderCv.data && zonderCv.data.needCv) +
      ', rijen voor/na: ' + voor + '/' + na);

  /* 5. EEN TOKEN VAN EEN ANDER GEZIN. De sollicitatieroute leest het profiel
     achter het token en niet de code uit het verzoek; wie die twee door elkaar
     kan halen, solliciteert namens een kind dat hij niet kent. */
  const vreemd = await P('/api/rtf/solliciteer', { code: w.code, token: 'nep-token-van-iemand-anders',
    supplierCode: WERKGEVER, vacatureId: vacId, cv: CV });
  noteer('iemand solliciteert met de gezinscode van Adam en een vreemd token',
    'wordt geweigerd: het profiel achter het token beslist, niet de code in het verzoek',
    vreemd.status === 403,
    'status ' + vreemd.status + ': "' + String((vreemd.data && vreemd.data.error) || 'doorgelaten').slice(0, 70) + '"');

  /* 6. EEN AFGEWEZEN SOLLICITATIE BLIJFT STAAN. Dit is het patroon dat
     TRAVELCOMMERCE.md par. 9a bij de reisaanvraag vond: `afgewezen` hoort op de
     tijdlijn te BLIJVEN, want er hangt vervolg aan (daar: de reisoplosser die
     alternatieven zoekt). Een afwijzing die verdwijnt laat de mens denken dat
     er niets is gebeurd. */
  const vac2 = await maakVacature('Afwasser');
  await P('/api/rtf/solliciteer', { code: w.code, token: w.adam.token, supplierCode: WERKGEVER,
    vacatureId: vac2, cv: CV });
  const afw = (await sollicitatiesBijZaak(basis, S)).find(a => a.func === 'Afwasser');
  if (afw) await P('/api/supplier/apply/decide', { id: afw.id, action: 'afwijzen' }, S);
  const staatEr = rijVan(await sollicitatiesVanAdam(basis, w.code, w.adam.token), 'Afwasser');
  noteer('een sollicitatie van Adam wordt afgewezen',
    'blijft bij Adam staan met de stand erbij, in plaats van te verdwijnen',
    !!staatEr && staatEr.status === 'afgewezen',
    staatEr ? 'staat er, stand "' + staatEr.status + '"' : 'de afwijzing is uit zijn lijst verdwenen');

  /* 7. DE KNELPUNTMOTOR TELT GEEN MENSEN. Regel 5 van kern/knelpunt/index.js:
     een knelpunt is een eigenschap van een RANDVOORWAARDE en nooit van een
     mens. Deze storing bestaat omdat het voorstel voor de mensinfrastructuur
     precies hier omvalt als niemand hem handhaaft: "wordt mijn wereld groter of
     kleiner" is een score op een mens tenzij de telling over wegen gaat. */
  const telling = await P('/api/knelpunt', {
    doel: 'weer aan het werk',
    randvoorwaarden: [{ id: 'diploma', wat: 'startkwalificatie', stand: 'ontbreekt' },
      { id: 'vervoer', wat: 'vervoer', stand: 'ontbreekt' }],
    manieren: [{ id: 'a', nodig: ['diploma'] }, { id: 'b', nodig: ['diploma', 'vervoer'] }]
  }, M);
  const knel = (telling.data && telling.data.knelpunten) || [];
  const overWegen = knel.length > 0 && knel.every(k => typeof k.blokkeertWegen === 'number');
  const geenMens = !/score|niveau|risico|profiel/i.test(JSON.stringify(telling.data || {}));
  noteer('de knelpuntmotor telt wat er in de weg staat',
    'telt WEGEN per voorwaarde, en zet geen enkel getal op de mens',
    overWegen && geenMens,
    knel.map(k => k.id + ':' + k.blokkeertWegen).join(', ') + '; geen mensgetal: ' + geenMens);

  /* 8. NIET NAGEGAAN IS NIET VERVULD. Regel 2. Een weg waarvan niets bekend is
     heet `onbepaald` en nooit `open` -- want "open" leest als een uitnodiging. */
  const onbekend = await P('/api/knelpunt', {
    doel: 'weer aan het werk',
    randvoorwaarden: [],
    manieren: [{ id: 'a', wat: 'een bijbaan', nodig: ['vervoer', 'diploma'] }]
  }, M);
  const weg = ((onbekend.data && onbekend.data.manieren) || [])[0];
  noteer('een weg waarvan geen enkele voorwaarde is nagegaan',
    'heet "onbepaald" en nooit "open", en de aannames zeggen waarom',
    !!weg && weg.stand === 'onbepaald' && ((onbekend.data && onbekend.data.aannames) || []).length >= 2,
    weg ? 'stand "' + weg.stand + '", ' + ((onbekend.data && onbekend.data.aannames) || []).length + ' aannames'
      : 'geen weg terug');

  /* 9. DE 18+-POORT. Adam is zeventien, en dat hoort hem NIETS te kosten aan de
     kant waar het niet om leeftijd gaat. Deze storing meet dat de grens staat
     waar hij hoort: solliciteren mag (16+), maar wat een prestatie buiten het
     potje bewaart mag niet (18+, met een gezien identiteitsbewijs). Het gezin
     haalt die poort per definitie niet -- een RTF-profiel heeft geen account. */
  const lijn = await P('/api/leven/lijn', {}, w.adam.token);
  noteer('Adam vraagt zijn eigen levenslijn op met zijn gezinstoken',
    'de deur is dicht EN zegt dat, in plaats van een lege lijn te tonen',
    lijn.status === 401 || lijn.status === 403,
    'status ' + lijn.status + ': "' + String((lijn.data && lijn.data.error) || '').slice(0, 60) + '"');
}

async function meet() {
  const uit = {
    stempel: stempel(),
    uitleg: 'Een keten rond een jongere van 17 zonder RTG-account: van een doel naar een mogelijkheid die ' +
      'hij zelf ziet. Gemeten per SCHAKEL (handelt actor A, en ziet actor B dat?) en per STORING (houdt de ' +
      'keten zijn belofte als het misgaat?). Vierde keten naast tafel-, rit- en toelatingsproef; met opzet ' +
      'geen gedeelde module -- zie MAATSTAF.md par. 7 en scripts/ketenvorm.js.',
    grens: 'Dit is de WERK-weg naar een mogelijkheid (vacature -> sollicitatie -> aangenomen). De andere ' +
      'terreinen van kern/knelpunt/openingen-kaart.js (opleiding, opvang, vervoer, wonen) hebben eigen naden ' +
      'en zijn hier niet gelopen. Er komt geen browser aan te pas en geen AI: wat Rahul van dit alles zou ' +
      'MAKEN is niet gemeten, alleen wat de routes eronder doen. Adam is een gezinsprofiel en geen echt ' +
      'kind; deze proef zegt niets over of de mens dit ook zo beleeft.',
    schakels: [], storingen: [], wereld: null
  };
  const srv = await start({ naam: 'adamproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', DEMO_SUPPLIER: WERKGEVER, OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  try {
    const ctx = await loop(srv.basis, uit);
    await storingen(srv.basis, uit, ctx);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, openBekend: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  /* Twee velden en met opzet geen samengesteld cijfer: een proef die "sluit:
     true" meldt terwijl er een gat in staat, is precies de scorecard die
     LAT.md regel 11 verbiedt. */
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.openBekend === 0 && t.schakels >= 11;
  uit.sluitMetBevinding = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 11;
  uit.bevindingen = uit.schakels.filter(s => s.stand === 'openBekend')
    .map(s => ({ schakel: s.nr, van: s.van, naar: s.naar, wat: s.wat, gemeten: s.ziet || s.antwoord, reden: s.bekend }));
  return uit;
}

function druk(u) {
  console.log('adamproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.openBekend + ' open met reden, ' + u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' +
    u.telling.storingen + ' storingen (' + u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(24) +
      s.stand.padEnd(11) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.bekend ? '\n      BEVINDING: ' + s.bekend : '') +
      (s.antwoord ? '\n      antwoord: ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  console.log(u.sluit ? '\nDe keten sluit.'
    : u.sluitMetBevinding ? '\nDe keten loopt door, met ' + u.telling.openBekend + ' bevinding(en) die een besluit vragen.'
      : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL, WERKGEVER };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.sluitMetBevinding ? 0 : 1; return; }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: ADAMPROEF.json');
    }
    process.exit(u.sluitMetBevinding ? 0 : 1);
  }).catch(e => { console.error('de adamproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
