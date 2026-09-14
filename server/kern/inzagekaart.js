/* DE INZAGEKAART: wie heeft er in mijn gegevens gekeken.

   Dit is de andere helft van de vraag die het Consent Center stelt. Dat scherm
   gaat over wat er OPENSTAAT ("wie mag er nu bij, en waar zet ik dat stop");
   dit gaat over wat er IS GEBEURD ("wie heeft er gekeken, wanneer, waarom").
   Twee vragen, twee schermen -- ze door elkaar halen levert een lijst waarop
   een afgeronde inzage eruitziet als een openstaande toegang.

   WAAROM DIT MOEST BESTAAN. Identiteit komt in dit huis uit vier lagen, en elke
   laag hield zijn eigen spoor bij: RTG iD in db.data.rtgid.logs, de
   paspoortlaag in db.data.paspoortLog, en de kluisopvragingen (personeel,
   afdelingen, metier) in server/inzagelog.js. Elk spoor klopte; samen
   beantwoordden ze de vraag niet, want een lid moest op drie plekken kijken en
   kon nergens zien dat er een vierde was. Een antwoord dat je zelf moet
   samenstellen uit drie lijsten is geen antwoord.

   DEZE LAAG BEWAART NIETS EN SCHRIJFT NIETS, en dat is hier scherper dan bij
   het Consent Center. Zou het opvragen van je eigen kaart zelf een regel
   maken, dan groeit de lijst door het lezen ervan en staat er na tien keer
   kijken tien keer "u keek". Zelf-inzage is geen inzage; server/inzagelog.js
   zegt dat zelf ook (zie `zelf()` daar).

   DE KIJKER KRIJGT GEEN NAAM. Welke ZAAK of DIENST keek, staat er -- die kende
   u al, want u kreeg er bericht van. Welke MEDEWERKER daar keek, staat er niet.
   Dat is de persoonsdata van een ander, en die komt niet open omdat u vraagt.
   server/inzagelog.js liet die naam om precies die reden al weg; deze laag doet
   voor de paspoortlaag hetzelfde, want anders zou dezelfde naam via de ene weg
   wel en via de andere niet naar buiten komen.

   HET ZORGPROFIEL KWAM ER LATER BIJ, en precies zoals hieronder voorspeld: het
   voorbehoud zei dat een vierde weg er niet vanzelf op komt en dat het
   mensenwerk blijft. Dat was het ook. Allergieen, dieet en medische
   aandachtspunten reisden mee naar een zaak zonder dat een lid ooit kon zien
   welke zaak ze had gelezen; kern/gastzorg.js schrijft die lezingen nu in
   hetzelfde journaal als de kluisopvragingen, en daarmee staan ze hier vanzelf.

   WAT ER NIET IN KAN, en dat staat op de kaart zelf. Een ID-check met het Zegel
   (public/shared/zegelcheck.js) wordt bij de ZAAK vastgelegd en niet bij het
   lid: het Zegel draagt een paarsgewijs pseudoniem, dus de server kan een
   controle niet aan uw account terugkoppelen. Dat is een gevolg van hoe het
   Zegel privacy bewaart, en de kaart hoort dat te zeggen in plaats van te doen
   alsof de lijst compleet is. */

'use strict';

const inzagelog = require('../inzagelog');
const { idVanKey } = require('../lib/lidsleutel');

const { PASPOORT_TEKST, EIGEN_HANDELING } = require('./inzagekaart-woorden');

const MAX = 200;

module.exports = ({ kern }) => {
  /* Elke bron apart, en een bron die het niet doet wordt gemeld. Op deze kaart
     leest een ontbrekende bron als "daar heeft niemand gekeken", en dat is de
     ene conclusie die niemand per ongeluk mag trekken. */
  function lees(naam, fn) {
    if (typeof fn !== 'function') return { fout: 'De bron ' + naam + ' is niet aangesloten.' };
    try { return { waarde: fn() }; } catch (e) { return { fout: 'De bron ' + naam + ' gaf een fout.' }; }
  }

  const zaakNaam = code => {
    try {
      const s = kern.findSupplier ? kern.findSupplier(code) : null;
      return (s && s.name) || code || 'een partner';
    } catch (e) { return code || 'een partner'; }
  };

  function kaartVan(key) {
    const uit = [];
    const storingen = [];
    const pak = (naam, fn) => { const r = lees(naam, fn); if (r.fout) storingen.push(r.fout); return r.waarde; };

    /* 1. RTG iD -- de dienst die met uw iD gegevens ophaalde. De laag houdt
          zijn eigen log per lid bij en levert het kant-en-klaar. */
    const id = pak('RTG iD', kern.rtgid && kern.rtgid.inzage && (() => kern.rtgid.inzage(key)));
    for (const l of (id && id.log) || []) {
      uit.push({ om: l.om, bron: 'RTG iD', wie: l.dienst,
        wat: l.soort + ((l.attributen || []).length ? ': ' + l.attributen.join(', ') : ''),
        waarom: null, gekeken: l.soort !== 'toegang ingetrokken' });
    }

    /* 2. De paspoortlaag -- de partner die uw identiteitsbewijs opvroeg of
          opende. Hier wordt de `door` (de medewerker) bewust NIET overgenomen;
          zie de kop. */
    const pas = pak('Identiteitsbewijs', kern.db && (() => (kern.db.data || {}).paspoortLog || []));
    for (const r of pas || []) {
      if (r.key !== key) continue;
      uit.push({ om: r.at, bron: 'Identiteitsbewijs', wie: zaakNaam(r.supplierCode),
        wat: (PASPOORT_TEKST[r.soort] || r.soort) + (r.niveau ? ' (' + r.niveau + ')' : ''),
        waarom: null, gekeken: !EIGEN_HANDELING.has(r.soort) });
    }

    /* 3. Het inzagejournaal -- wie uw naam uit de kluis haalde, met de reden
          die daar verplicht is. Dit is de enige bron met een WAAROM, en dat is
          geen toeval: het is de enige waar een mens een reden moet typen. */
    const lidId = idVanKey(key);
    /* HET ANTWOORD DRAAGT ZIJN EIGEN BELOFTE (besluit 6). Een kale lijst leest
       als "dit is alles" terwijl het "dit is alles binnen de termijn" is; de
       termijn komt daarom mee en gaat hieronder door naar `bewaring`. */
    const kluisAntwoord = lidId == null ? null : pak('Ledendossier', () => inzagelog.voorBetrokkene(lidId));
    const kluis = (kluisAntwoord && kluisAntwoord.regels) || [];
    for (const r of kluis || []) {
      /* Het journaal draagt twee soorten regels: een kluisopvraging (iemand haalde
         uw NAAM op) en een zorgprofiel-lezing (een zaak zag uw allergieen). Ze
         staan in dezelfde lijst omdat het dezelfde vraag is -- wie keek er in
         mijn gegevens -- maar ze zeggen iets anders, en dat hoort een lezer te
         zien zonder de reden te moeten ontcijferen. */
      const zorg = r.bron === 'zorgprofiel';
      uit.push({ om: r.at, bron: zorg ? 'Zorgprofiel' : 'Ledendossier',
        wie: zorg ? 'een zaak waar u besteld of verbleven heeft' : (r.bron || 'RTG'),
        wat: zorg ? 'las uw allergieen, dieet en medische aandachtspunten' : 'haalde uw naam uit de kluis',
        waarom: r.waarom || null, gekeken: true });
    }

    uit.sort((a, b) => String(b.om || '').localeCompare(String(a.om || '')));
    const kaart = uit.slice(0, MAX);
    return {
      ok: true, kaart, storingen,
      gekeken: kaart.filter(r => r.gekeken).length,
      bronnen: ['RTG iD', 'Identiteitsbewijs', 'Ledendossier', 'Zorgprofiel'],
      /* PER BRON, en met opzet niet als een getal over het geheel: een enkel
         getal over vier bronnen maakt de langste of de kortste tot waarheid, en
         allebei is onwaar. `null` is hier een uitspraak en geen leeg veld. */
      bewaring: {
        Ledendossier: (kluisAntwoord && kluisAntwoord.bewaardagen) || null,
        Zorgprofiel: (kluisAntwoord && kluisAntwoord.bewaardagen) || null,
        'RTG iD': null,
        Identiteitsbewijs: null,
        uitleg: kluisAntwoord && kluisAntwoord.bewaardagen
          ? 'Het ledendossier en het zorgprofiel kijken ' + kluisAntwoord.bewaardagen +
            ' dagen terug. Hoe lang RTG iD en de identiteitslaag bewaren, weet deze kaart niet; ' +
            'dat staat bij die lagen zelf.'
          : 'Hoe ver deze kaart terugkijkt, is hier niet vast te stellen.'
      },
      nietZichtbaar: [
        { naam: 'Een ID-/leeftijdscheck met het Zegel',
          reden: 'Het Zegel draagt een pseudoniem dat per partner verschilt, zodat zaken u niet aan elkaar kunnen herkennen. Diezelfde bescherming maakt dat RTG een controle niet aan uw account kan terugkoppelen; de controle staat wel in het activiteitenlog van de zaak zelf.' }
      ].concat(
        /* EEN TEKORT HOORT OP DE KAART EN NIET IN EEN LOGREGEL. Bijt de noodrem
           van het journaal, dan is de belofte aan dit lid niet waargemaakt, en
           dan hoort dat in dezelfde lijst als de rest van wat deze kaart niet
           kan tonen. Bijt hij niet, dan staat er niets. */
        kluisAntwoord && kluisAntwoord.volledig === false
          ? [{ naam: 'Een deel van het oudere ledendossier-spoor', reden: kluisAntwoord.tekort }]
          : []
      ),
      voorbehoud: 'Deze kaart brengt vier sporen samen. Een vijfde weg die iemand morgen bouwt, staat er niet vanzelf op -- dat blijft mensenwerk, en test/inzagekaart.test.js zegt bij welke bronnen het is gebleven.'
    };
  }

  return { inzagekaartVan: kaartVan };
};

/* De woordenlijst blijft hier bereikbaar, zodat een lezer die deze module al
   heeft niet ook nog het buurbestand moet kennen. EEN waarde, twee adressen --
   er wordt niets overgetypt (LAT.md regel 4). */
module.exports.PASPOORT_TEKST = PASPOORT_TEKST;
