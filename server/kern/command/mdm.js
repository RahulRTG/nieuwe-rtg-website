/* MASTER DATA -- één gezaghebbend record per bedrijf en per locatie.

   VOOR HET LID BESTOND DIT AL (kern/eenaccount). Voor bedrijven en locaties
   niet, en dat is precies waar het scheef groeit: een zaak staat als
   leverancier én als partnerkanaal, een plaats heet "Ibiza", "ibiza" en
   "Santa Eularia, Ibiza". Elk van die rijen klopt op zichzelf; samen zeggen ze
   dat er drie plaatsen zijn waar er één is.

   DE KANDIDATEN WORDEN GEMETEN, DE VELDEN ZIJN AANGEGEVEN. Welke rijen op
   elkaar lijken, komt uit de gegevens: genormaliseerde naam, dezelfde plaats,
   coördinaten binnen een straal. Wélke velden de naam en de plaats dragen,
   staat in een tabel -- die kan niet gemeten worden en staat daarom als
   'aangegeven' in de uitslag, net als in ./herkomst.js.

   ER WORDT NOOIT VANZELF SAMENGEVOEGD, en dat is geen voorzichtigheid maar een
   grens. Twee bedrijven met dezelfde naam in dezelfde stad KUNNEN twee
   bedrijven zijn; dat verschil zit niet in de gegevens en is dus voor niemand
   uit deze cijfers af te leiden -- ook niet voor een machine die er zeker van
   klinkt. Samenvoegen is hier altijd mensenwerk.

   EN SAMENVOEGEN WIST NIETS. De verliezers blijven staan met een verwijzing
   naar het gouden record. Verwijderen zou elke bestelling, rit en factuur die
   naar zo'n rij wees tot wees maken -- precies wat ./kwaliteit.js meet -- en
   het is niet terug te draaien. Nu is terug() dezelfde handeling omgekeerd.

   DE PLAATSNORMALISATIE KOMT UIT server/functies/toegang.js. Daar bepaalt hij
   al of een functie in jouw woonplaats openstaat. Twee normalisaties van
   dezelfde plaatsnaam zouden betekenen dat de schakelkast en dit scherm het
   over een andere stad hebben. */
'use strict';

const { s } = require('./register');

const RECHTSVORMEN = /\b(b ?v|n ?v|v ?o ?f|ltd|limited|gmbh|s ?a|s ?l|inc|llc|plc|holding|group|groep)\b/g;
const STRAAL_M = 150;          // binnen deze straal is het vermoedelijk dezelfde plek
const MAX_RIJEN = 5000;        // per collectie

/* De naam als sleutel: kleine letters, accenten weg, leestekens weg,
   rechtsvorm weg. "Aguamarina Ibiza B.V." en "aguamarina ibiza" worden
   hetzelfde; "Aguamarina" en "Aguamarina Ibiza" NIET -- dat zou twee
   verschillende zaken samentrekken. */
function naamNorm(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(RECHTSVORMEN, ' ').replace(/\s+/g, ' ').trim();
}

/* Hemelsbrede afstand in meters. Genoeg voor "is dit dezelfde plek"; geen
   navigatie. */
function afstand(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const q = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(q)));
}

function maakMdm({ db, save, journaal, partijen, plaatsNorm, opslag }) {
  const PARTIJEN = Array.isArray(partijen) ? partijen : [];
  const plaats = typeof plaatsNorm === 'function' ? plaatsNorm : (v => String(v || '').toLowerCase().trim());

  const rijen = (p) => {
    const v = opslag.vak()[p.collectie] || null;
    return Array.isArray(v) ? v.slice(0, MAX_RIJEN) : [];
  };

  function partijen0() {
    const uit = [];
    for (const p of PARTIJEN) {
      for (const r of rijen(p)) {
        if (!r) continue;
        const naam = s(r[p.naam]);
        if (!naam) continue;
        uit.push({ soort: p.type, collectie: p.collectie, id: s(r[p.sleutel]), naam,
          sleutelNaam: naamNorm(naam), plaats: plaats(r[p.plaats]),
          loc: p.loc && r[p.loc] && r[p.loc].lat != null ? r[p.loc] : null,
          samengevoegdIn: r.mdmSamengevoegdIn || null, velden: r });
      }
    }
    return uit;
  }

  /* Groepen van rijen die vermoedelijk dezelfde partij zijn. Alleen de
     genormaliseerde naam bindt; plaats en afstand versterken of verzwakken het
     vermoeden en staan in de uitslag zodat een mens ze kan wegen. */
  function bedrijven() {
    const per = new Map();
    for (const r of partijen0()) {
      if (r.samengevoegdIn) continue;
      if (!per.has(r.sleutelNaam)) per.set(r.sleutelNaam, []);
      per.get(r.sleutelNaam).push(r);
    }
    const uit = [];
    for (const [sleutel, groep] of per) {
      if (groep.length < 2) continue;
      const plaatsen = new Set(groep.map(g => g.plaats).filter(Boolean));
      const m = afstandBinnen(groep);
      uit.push({
        sleutel, soort: 'bedrijf', aantal: groep.length,
        leden: groep.map(g => ({ soort: g.soort, id: g.id, naam: g.naam, plaats: g.plaats })),
        zelfdePlaats: plaatsen.size <= 1,
        afstandM: m,
        zekerheid: plaatsen.size <= 1 ? (m != null && m <= STRAAL_M ? 'hoog' : 'midden') : 'laag',
        waarom: 'dezelfde genormaliseerde naam' +
          (plaatsen.size <= 1 ? ', dezelfde plaats' : ', maar verschillende plaatsen') +
          (m != null ? ', ' + m + ' m uit elkaar' : ''),
        let: 'twee bedrijven met dezelfde naam in dezelfde stad KUNNEN twee bedrijven zijn; ' +
          'dat verschil zit niet in deze gegevens'
      });
    }
    return uit.sort((a, b) => b.aantal - a.aantal);
  }

  function afstandBinnen(groep) {
    const met = groep.filter(g => g.loc);
    if (met.length < 2) return null;
    let max = 0;
    for (let i = 0; i < met.length; i++) {
      for (let j = i + 1; j < met.length; j++) {
        const d = afstand(met[i].loc, met[j].loc);
        if (d != null && d > max) max = d;
      }
    }
    return max;
  }

  /* Locaties: de plaatsen zoals ze in de partijrijen staan. Twee schrijfwijzen
     van dezelfde plaats vallen samen op de normalisatie; twee plaatsen die
     dicht bij elkaar liggen maar anders heten, worden GEMELD en niet
     samengetrokken -- "Santa Eularia" en "Ibiza" zijn niet hetzelfde, ook al
     staan ze op vier kilometer. */
  function locaties() {
    const per = new Map();
    for (const r of partijen0()) {
      if (!r.plaats) continue;
      if (!per.has(r.plaats)) per.set(r.plaats, { plaats: r.plaats, schrijfwijzen: new Set(), rijen: [] });
      const g = per.get(r.plaats);
      g.schrijfwijzen.add(s(r.velden[(PARTIJEN.find(p => p.type === r.soort) || {}).plaats]));
      g.rijen.push(r);
    }
    const lijst = [...per.values()].map(g => ({
      plaats: g.plaats, aantal: g.rijen.length,
      schrijfwijzen: [...g.schrijfwijzen].filter(Boolean),
      meerdereSchrijfwijzen: g.schrijfwijzen.size > 1,
      loc: (g.rijen.find(r => r.loc) || {}).loc || null
    }));
    /* Dichtbij elkaar, maar met een andere naam: een vermoeden en geen groep. */
    const dichtbij = [];
    for (let i = 0; i < lijst.length; i++) {
      for (let j = i + 1; j < lijst.length; j++) {
        const d = afstand(lijst[i].loc, lijst[j].loc);
        if (d != null && d <= STRAAL_M) {
          dichtbij.push({ a: lijst[i].plaats, b: lijst[j].plaats, afstandM: d,
            let: 'ze liggen dicht bij elkaar maar heten anders; dit is een vraag, geen samenvoeging' });
        }
      }
    }
    return { plaatsen: lijst.sort((a, b) => b.aantal - a.aantal), dichtbij, straalM: STRAAL_M };
  }

  /* Het gouden record en het samenvoegen staan in ./mdmsamen.js: hier wordt
     GEMETEN wie op elkaar lijkt, daar wordt er iets mee gedaan. Die twee horen
     uit elkaar omdat de meting altijd mag draaien en het samenvoegen nooit
     vanzelf. */
  const samen = require('./mdmsamen').maakSamen({ db, save, journaal, PARTIJEN, bedrijven, partijen0, s, opslag });

  function meet() {
    const b = bedrijven();
    const l = locaties();
    const samengevoegd = partijen0().filter(r => r.samengevoegdIn).length;
    return {
      bedrijven: b, locaties: l, samengevoegd,
      tel: { groepen: b.length, rijen: b.reduce((n, g) => n + g.aantal, 0),
        plaatsen: l.plaatsen.length, schrijfwijzen: l.plaatsen.filter(p => p.meerdereSchrijfwijzen).length },
      bronnen: PARTIJEN.map(p => ({ type: p.type, collectie: p.collectie, naamVeld: p.naam, plaatsVeld: p.plaats })),
      let: 'er wordt hier nooit vanzelf samengevoegd. Twee bedrijven met dezelfde naam in dezelfde stad ' +
        'kunnen twee bedrijven zijn, en dat verschil zit niet in deze gegevens.'
    };
  }

  return { meet, bedrijven, locaties, naamNorm, afstand,
    gouden: samen.gouden, voegSamen: samen.voegSamen, terug: samen.terug };
}

module.exports = { maakMdm, naamNorm, afstand, STRAAL_M };
