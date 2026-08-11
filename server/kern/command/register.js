/* HET OBJECTREGISTER van RTG Command -- de ene plek die zegt welke soorten
   objecten het platform kent, waar ze staan en hoe ze heten.

   WAAROM DIT EEN REGISTER IS EN GEEN VEERTIG IF-TAKKEN. Een commandolaag die
   "ieder object platformbreed kan openen" en "een zoekbalk voor letterlijk
   alles" belooft, kan dat op twee manieren bouwen: per soort een eigen tak, of
   een tabel die zegt waar een soort woont. Bij de eerste vorm groeit de
   zoekbalk niet mee met het platform -- er komt een collectie bij, niemand
   raakt de zoekbalk aan, en de belofte is stil onwaar geworden. Dat is precies
   het soort stille onwaarheid waar LAT.md regel 4 over gaat: dezelfde waarheid
   (welke soorten bestaan er) zou dan op twee plekken staan.

   Dus: EEN tabel. Zoeken, het objectdossier, de tijdlijn, de afhankelijkheden
   en de kennisgraaf lezen hem allemaal. Een soort erbij is een regel erbij.

   WAT ER BEWUST NIET IN STAAT. Echte namen. Elk object dat een mens is draagt
   hier zijn codenaam en niets anders; de kluis (accounts.js) blijft de enige
   ingang naar de naam erachter, met inzagelog. Het register kent dus wel het
   BESTAAN van een lid, maar niet wie het is. */
'use strict';

/* Een veld dat er niet is levert '' en geen crash: de collecties van dit
   platform zijn niet allemaal even netjes gevuld, en een zoekbalk die
   struikelt over een ontbrekend veld is erger dan een die niets vindt. */
const s = (v) => (v == null ? '' : String(v));
const eerste = (r, ...namen) => { for (const n of namen) if (r && r[n] != null && r[n] !== '') return s(r[n]); return ''; };

/* SOORTEN.

   collectie = de sleutel in db.data. sleutel = het veld waarmee je hem
   aanspreekt. zoek = de velden die de zoekbalk leest (alleen wat een mens ook
   echt intypt: naam, code, kenteken, plaats -- geen vrije tekstvelden, want
   die maken elke zoekterm een treffer).

   domein = onder welke koepel hij in de puls hangt. Dat is niet cosmetisch: de
   puls telt per domein, en een soort zonder domein zou nergens meetellen. */
const SOORTEN = [
  { type: 'zaak', label: 'Zaak', meervoud: 'zaken', domein: 'handel', collectie: 'suppliers', sleutel: 'code',
    zoek: ['code', 'name', 'city', 'type'],
    titel: r => eerste(r, 'name', 'code'),
    sub: r => [s(r.type), s(r.city)].filter(Boolean).join(' · ') },

  { type: 'bestelling', label: 'Bestelling', meervoud: 'bestellingen', domein: 'handel', collectie: 'orders', sleutel: 'id',
    zoek: ['id', 'code', 'supplierCode', 'status'],
    titel: r => 'Bestelling ' + eerste(r, 'id'),
    sub: r => [s(r.status), s(r.supplierCode || r.code)].filter(Boolean).join(' · '),
    bedrag: r => Number(r.total || r.amount || 0) },

  { type: 'rit', label: 'Rit', meervoud: 'ritten', domein: 'mobiliteit', collectie: 'rides', sleutel: 'id',
    zoek: ['id', 'code', 'supplierCode', 'status', 'from', 'to'],
    titel: r => 'Rit ' + eerste(r, 'id'),
    sub: r => [s(r.status), [s(r.from), s(r.to)].filter(Boolean).join(' → ')].filter(Boolean).join(' · '),
    bedrag: r => Number(r.total || r.amount || 0) },

  { type: 'boeking', label: 'Boeking', meervoud: 'boekingen', domein: 'reizen', collectie: 'boekingen', sleutel: 'id',
    zoek: ['id', 'code', 'status', 'bestemming', 'plaats'],
    titel: r => 'Boeking ' + eerste(r, 'id', 'code'),
    sub: r => [s(r.status), eerste(r, 'bestemming', 'plaats')].filter(Boolean).join(' · '),
    bedrag: r => Number(r.centen || r.bedrag || 0) },

  { type: 'reservering', label: 'Reservering', meervoud: 'reserveringen', domein: 'horeca', collectie: 'reserveringen', sleutel: 'id',
    zoek: ['id', 'code', 'status', 'zaak', 'supplierCode'],
    titel: r => 'Reservering ' + eerste(r, 'id'),
    sub: r => [s(r.status), eerste(r, 'zaak', 'supplierCode')].filter(Boolean).join(' · ') },

  { type: 'voertuig', label: 'Voertuig', meervoud: 'voertuigen', domein: 'mobiliteit', collectie: 'ovVoertuigen', sleutel: 'id',
    zoek: ['id', 'kenteken', 'lijn', 'soort', 'staat'],
    titel: r => eerste(r, 'kenteken', 'id'),
    sub: r => [s(r.soort), s(r.lijn), s(r.staat)].filter(Boolean).join(' · ') },

  { type: 'rijksvoertuig', label: 'Rijksvoertuig', meervoud: 'rijksvoertuigen', domein: 'overheid', collectie: 'rijkVoertuigen', sleutel: 'id',
    zoek: ['id', 'kenteken', 'dienst', 'soort'],
    titel: r => eerste(r, 'kenteken', 'id'),
    sub: r => [s(r.soort), s(r.dienst)].filter(Boolean).join(' · ') },

  { type: 'sollicitatie', label: 'Sollicitatie', meervoud: 'sollicitaties', domein: 'mensen', collectie: 'applications', sleutel: 'id',
    zoek: ['id', 'name', 'func', 'status', 'company'],
    titel: r => eerste(r, 'name', 'id'),
    sub: r => [s(r.func), s(r.status)].filter(Boolean).join(' · ') },

  { type: 'vacature', label: 'Vacature', meervoud: 'vacatures', domein: 'mensen', collectie: 'vacatures', sleutel: 'id',
    zoek: ['id', 'titel', 'plaats', 'code'],
    titel: r => eerste(r, 'titel', 'id'),
    sub: r => [s(r.plaats), s(r.code)].filter(Boolean).join(' · ') },

  { type: 'salonpost', label: 'Salon-post', meervoud: 'salon-posts', domein: 'salon', collectie: 'posts', sleutel: 'id',
    zoek: ['id', 'author', 'place'],
    titel: r => 'Post van ' + eerste(r, 'author'),
    sub: r => [s(r.place), s(r.tier)].filter(Boolean).join(' · ') },

  { type: 'melding', label: 'Melding', meervoud: 'meldingen', domein: 'stad', collectie: 'hulp', sleutel: 'id',
    zoek: ['id', 'soort', 'status', 'plaats'],
    titel: r => eerste(r, 'soort', 'id'),
    sub: r => [s(r.plaats), s(r.status)].filter(Boolean).join(' · ') }
];

const OP_TYPE = new Map(SOORTEN.map(k => [k.type, k]));

/* De rijen van een soort, altijd een array -- ook als de collectie er nog niet
   is. Een collectie ontstaat hier pas als er iets in komt; een commandolaag die
   daarop crasht zou op een verse installatie niet opstarten. */
function rijen(db, soort) {
  /* Een soort MAG zijn eigen leesfunctie meebrengen. Dat lijkt een detail en is
     het scharnier van de hele scoping: een register waarvan de soorten zelf
     zeggen waar hun rijen vandaan komen, kan een BEPERKT venster op db.data
     zijn. De zaak-kant gebruikt dat om nooit iets buiten de eigen zaak te
     kunnen teruggeven -- niet doordat de aanroeper netjes filtert, maar doordat
     er geen pad bestaat waarlangs een ongefilterde rij naar buiten komt. */
  if (typeof soort.lees === 'function') { const v = soort.lees(db); return Array.isArray(v) ? v : []; }
  const v = db && db.data ? db.data[soort.collectie] : null;
  return Array.isArray(v) ? v : [];
}

function vindRij(db, type, id) {
  const soort = OP_TYPE.get(type);
  if (!soort) return null;
  const sleutel = String(id);
  return rijen(db, soort).find(r => r && s(r[soort.sleutel]) === sleutel) || null;
}

/* EEN REGISTER ALS OBJECT, en niet als module met vaste inhoud.

   Dit is wat het mogelijk maakt om dezelfde zoekbalk, hetzelfde objectdossier
   en dezelfde afhankelijkhedenscan op een ANDER stel soorten te draaien --
   bijvoorbeeld op alleen de objecten van een enkele zaak. zoek.js en object.js
   krijgen een register mee en importeren er geen; wie ze een beperkt register
   geeft, krijgt gegarandeerd een beperkt antwoord.

   Het RTG-register hieronder is er daar precies een van, en heeft verder geen
   voorrang. */
function maakRegister(soorten) {
  const perType = new Map(soorten.map(k => [k.type, k]));
  return {
    SOORTEN: soorten,
    OP_TYPE: perType,
    rijen: (db, soort) => rijen(db, soort),
    vindRij: (db, type, id) => {
      const soort = perType.get(String(type));
      if (!soort) return null;
      const sleutel = String(id);
      return rijen(db, soort).find(r => r && s(r[soort.sleutel]) === sleutel) || null;
    },
    kort, verwijzingen
  };
}

/* De korte vorm waarin een object overal in Command verschijnt: in de
   zoekuitslag, in de afhankelijkheden, in een plan en in het journaal. EEN
   vorm, want anders staat dezelfde waarheid straks in vier opmaakfuncties. */
function kort(soort, r) {
  return {
    type: soort.type, label: soort.label, domein: soort.domein,
    id: s(r[soort.sleutel]),
    titel: soort.titel(r) || s(r[soort.sleutel]),
    sub: soort.sub ? soort.sub(r) : '',
    bedrag: soort.bedrag ? soort.bedrag(r) : null
  };
}

/* De velden waarmee dit object door ANDERE records genoemd kan worden. Zo vindt
   de afhankelijkhedenscan een verwijzing zonder dat iemand per soortenpaar een
   relatie heeft moeten opschrijven: die lijst zou verouderen, deze niet. */
function verwijzingen(soort, r) {
  const w = new Set();
  const k = s(r[soort.sleutel]);
  if (k) w.add(k);
  for (const veld of ['code', 'supplierCode', 'key', 'codenaam', 'codename', 'kenteken']) {
    const v = s(r[veld]); if (v) w.add(v);
  }
  return [...w];
}

const RTG = maakRegister(SOORTEN);

module.exports = { SOORTEN, OP_TYPE, rijen, vindRij, kort, verwijzingen, s, eerste, maakRegister, RTG };
