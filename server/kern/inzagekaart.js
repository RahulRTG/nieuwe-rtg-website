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

   WAT ER NIET IN KAN, en dat staat op de kaart zelf. Een ID-check met het Zegel
   (public/shared/zegelcheck.js) wordt bij de ZAAK vastgelegd en niet bij het
   lid: het Zegel draagt een paarsgewijs pseudoniem, dus de server kan een
   controle niet aan uw account terugkoppelen. Dat is een gevolg van hoe het
   Zegel privacy bewaart, en de kaart hoort dat te zeggen in plaats van te doen
   alsof de lijst compleet is. */

'use strict';

const inzagelog = require('../inzagelog');
const { idVanKey } = require('../lib/lidsleutel');

const MAX = 200;

/* Wat er in de paspoortlaag gebeurde, in de woorden van het lid. De sleutel is
   de `soort` die kern/paspoort logt; een soort die hier niet staat, krijgt zijn
   eigen naam te zien en verdwijnt niet stilletjes van de kaart. */
const PASPOORT_TEKST = {
  bevestiging: 'controleerde of u RTG-geverifieerd bent (ja/nee, geen gegevens gedeeld)',
  aanvraag: 'vroeg uw identiteitsbewijs op',
  goedgekeurd: 'u keurde die aanvraag goed',
  geweigerd: 'u weigerde die aanvraag',
  ingetrokken: 'u trok de toegang weer in',
  inzage: 'opende uw identiteitsbewijs',
  'incident-ingediend': 'eiste uw identiteit op na een incident',
  'incident-vrijgegeven': 'RTG gaf uw identiteit vrij na beoordeling van dat incident',
  'incident-afgewezen': 'RTG wees dat incident af; er is niets gedeeld'
};

/* Regels die over uw EIGEN handeling gaan in plaats van over een kijker. Ze
   staan wel op de kaart -- zonder uw goedkeuring is een inzage erboven niet te
   begrijpen -- maar ze tellen niet mee als "er is in mijn gegevens gekeken". */
const EIGEN_HANDELING = new Set(['goedgekeurd', 'geweigerd', 'ingetrokken']);

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
    const kluis = lidId == null ? [] : pak('Ledendossier', () => inzagelog.voorBetrokkene(lidId));
    for (const r of kluis || []) {
      uit.push({ om: r.at, bron: 'Ledendossier', wie: r.bron || 'RTG',
        wat: 'haalde uw naam uit de kluis', waarom: r.waarom || null, gekeken: true });
    }

    uit.sort((a, b) => String(b.om || '').localeCompare(String(a.om || '')));
    const kaart = uit.slice(0, MAX);
    return {
      ok: true, kaart, storingen,
      gekeken: kaart.filter(r => r.gekeken).length,
      bronnen: ['RTG iD', 'Identiteitsbewijs', 'Ledendossier'],
      nietZichtbaar: [
        { naam: 'Een ID-/leeftijdscheck met het Zegel',
          reden: 'Het Zegel draagt een pseudoniem dat per partner verschilt, zodat zaken u niet aan elkaar kunnen herkennen. Diezelfde bescherming maakt dat RTG een controle niet aan uw account kan terugkoppelen; de controle staat wel in het activiteitenlog van de zaak zelf.' }
      ],
      voorbehoud: 'Deze kaart brengt drie sporen samen. Een vierde weg die iemand morgen bouwt, staat er niet vanzelf op -- dat blijft mensenwerk, en test/inzagekaart.test.js zegt bij welke bronnen het is gebleven.'
    };
  }

  return { inzagekaartVan: kaartVan };
};

module.exports.PASPOORT_TEKST = PASPOORT_TEKST;
