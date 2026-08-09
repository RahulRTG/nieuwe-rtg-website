/* RTG Wereld -- EEN PROFIEL MET LAGEN. Niet vier accounts, en ook geen vijfde
   profiel naast de vier die er al zijn.

   WAT HIER HET ONTWERP DRAAGT, en het is dezelfde keuze als bij de feed.
   Alle vier de lagen bestaan al ergens, met een eigenaar en een poort:

     persoonlijk    De Salon      db.data.salon.bio[key]      (bio + plaats)
     professioneel  RTG Zakelijk  db.data.zakelijk.profielen  (kop, sector, ...)
     creator        de zaak       s.creator van een zaak met de cap 'creator'
     ondernemer     de zaak       db.data.accountRollen[key], rol 'zaak'

   Dit bestand maakt daar GEEN kopie van. Het leest de vier op hun eigen plek en
   zet ze onder een gedeelde noemer. Een eigen `db.data.wereld.profielen` zou de
   vijfde plek zijn die dezelfde waarheid vasthoudt (LAT-regel 4), en de eerste
   keer dat iemand zijn Salon-bio wijzigt zou hier de oude blijven staan.

   Bewerken loopt hier dan ook nooit langs: je bio zet je in De Salon, je kop in
   RTG Zakelijk. Die routes houden hun 9+-keuring en hun rem.

   WAT DE WERELDLAAG WEL BEZIT, en dat is precies het stuk dat nergens bestond:
   WIE WAT MAG ZIEN, per veld. Dat is de enige eigen opslag hier
   (db.data.wereld.zicht) en de reden dat dit bestand meer is dan een optelsom.

   EN EEN CORRECTIE OP MEZELF. In rechten.js stonden eerst ZES zichtbaarheden,
   waaronder 'vrienden' NAAST 'contacten'. Bij het bouwen bleek dat een lege
   belofte: dit huis heeft EEN vriendengraaf, dus die twee zouden precies
   dezelfde mensen aanwijzen. Twee knoppen met hetzelfde gevolg is een leugen in
   de interface. Er staan er nu vijf, en elk van de vijf wijst aantoonbaar een
   andere groep aan (test/wereldprofiel.test.js zet ze naast elkaar). */
'use strict';

const rechten = require('./rechten');

/* De velden, met per stuk waar de waarde vandaan komt en wat de standaard-
   zichtbaarheid is. Standaarden zijn een besluit en geen smaak: wat je over
   jezelf schrijft staat standaard bij je contacten, en wat je professioneel
   bent staat standaard open -- een zakelijk netwerk waarin niemand elkaar kan
   vinden is geen netwerk. Niets staat standaard op 'iedereen' in de
   persoonlijke laag. */
const VELDEN = [
  { pad: 'persoonlijk.over', laag: 'persoonlijk', naam: 'Over mij', standaard: 'contacten' },
  { pad: 'persoonlijk.plaats', laag: 'persoonlijk', naam: 'Plaats', standaard: 'contacten' },
  { pad: 'professioneel.kop', laag: 'professioneel', naam: 'Functiekop', standaard: 'iedereen' },
  { pad: 'professioneel.sector', laag: 'professioneel', naam: 'Sector', standaard: 'iedereen' },
  { pad: 'professioneel.vaardigheden', laag: 'professioneel', naam: 'Vaardigheden', standaard: 'iedereen' },
  { pad: 'professioneel.ervaring', laag: 'professioneel', naam: 'Ervaring', standaard: 'zakelijk' },
  { pad: 'professioneel.openVoorWerk', laag: 'professioneel', naam: 'Open voor werk', standaard: 'zakelijk' },
  { pad: 'creator.niche', laag: 'creator', naam: 'Niche', standaard: 'iedereen' },
  { pad: 'creator.platforms', laag: 'creator', naam: 'Platforms', standaard: 'iedereen' },
  { pad: 'creator.bereik', laag: 'creator', naam: 'Bereik', standaard: 'zakelijk' },
  { pad: 'ondernemer.zaken', laag: 'ondernemer', naam: 'Mijn zaken', standaard: 'iedereen' }
];

module.exports = ({ db, zijnVrienden }) => {
  const Z = () => {
    if (!db.data.wereld || typeof db.data.wereld !== 'object') db.data.wereld = {};
    if (!db.data.wereld.zicht || typeof db.data.wereld.zicht !== 'object') db.data.wereld.zicht = {};
    return db.data.wereld.zicht;
  };

  /* ---------- de vier bronnen, alleen lezen ---------- */
  const salonBio = (key) => ((db.data.salon || {}).bio || {})[key] || {};
  const zakProfiel = (key) => ((db.data.zakelijk || {}).profielen || {})[key] || null;
  // de zaken waar dit account als ZAAK aan gekoppeld is (kern/eenaccount.js)
  const zakenVan = (key) => (((db.data.accountRollen || {})[key]) || [])
    .filter(r => r.rol === 'zaak' && r.code)
    .map(r => ({ code: r.code, naam: r.zaakNaam || r.naam || r.code }));
  // de creator-kaart hangt aan zo'n zaak, niet aan het lid; we pakken de eerste
  // gekoppelde zaak die de creator-laag echt heeft opgezet
  function creatorVan(key) {
    for (const z of zakenVan(key)) {
      const s = (db.data.suppliers || []).find(x => x.code === z.code);
      if (s && s.creator && s.creator.opgezet) return s.creator;
    }
    return null;
  }

  // de rauwe waarde van een veld; null/leeg betekent "niet ingevuld"
  function waarde(pad, key) {
    const zak = zakProfiel(key), cre = creatorVan(key);
    switch (pad) {
      case 'persoonlijk.over': return salonBio(key).bio || null;
      case 'persoonlijk.plaats': return salonBio(key).plaats || null;
      case 'professioneel.kop': return zak && zak.kop || null;
      case 'professioneel.sector': return zak && zak.sector || null;
      case 'professioneel.vaardigheden': return zak && (zak.vaardigheden || []).length ? zak.vaardigheden : null;
      case 'professioneel.ervaring': return zak && (zak.ervaring || []).length ? zak.ervaring : null;
      case 'professioneel.openVoorWerk': return zak && zak.openVoorWerk ? true : null;
      case 'creator.niche': return cre && cre.niche || null;
      case 'creator.platforms': return cre && (cre.platforms || []).length
        ? cre.platforms.map(p => ({ platform: p.platform, handle: p.handle })) : null;
      case 'creator.bereik': return cre && (cre.platforms || []).length
        ? cre.platforms.reduce((n, p) => n + (p.volgers || 0), 0) : null;
      case 'ondernemer.zaken': return zakenVan(key).length ? zakenVan(key) : null;
      default: return null;
    }
  }

  /* De vijf zichtbaarheden staan in ./zicht.js -- wie welke groep aanwijst is
     een vraag op zichzelf, en dit bestand zat vlak onder de 10 kB-grens. */
  const { magZien } = require('./zicht')({ db, zijnVrienden, zakProfiel });

  /* ---------- de eigen opslag: wie mag wat zien ---------- */
  const zichtVan = (key, pad) => {
    const eigen = (Z()[key] || {})[pad];
    const veld = VELDEN.find(v => v.pad === pad);
    return rechten.ZICHTBAARHEDEN.includes(eigen) ? eigen : (veld ? veld.standaard : 'alleenik');
  };

  /* Een zichtbaarheid zetten. Drie dingen worden echt gecontroleerd en niet op
     vorm: het veld moet bestaan, de LAAG moet bij deze pas horen (anders zet je
     zichtbaarheid op iets wat je niet eens hebt), en het niveau moet uit de
     lijst komen -- geen `typeof`, maar lidmaatschap van de echte verzameling
     (LAT-regel 8). */
  function zetZicht(key, tier, pad, niveau) {
    const veld = VELDEN.find(v => v.pad === pad);
    if (!veld) return { error: 'Dit veld ken ik niet.' };
    if (!rechten.lagenVoor(tier).some(l => l.id === veld.laag))
      return { error: 'Deze laag hoort bij een andere pas.' };
    if (!rechten.ZICHTBAARHEDEN.includes(niveau)) return { error: 'Deze zichtbaarheid ken ik niet.' };
    const z = Z();
    if (!z[key] || typeof z[key] !== 'object') z[key] = {};
    z[key][pad] = niveau;
    return { ok: true, pad, niveau };
  }

  /* Mijn eigen profiel: elk veld dat bij mijn pas hoort, met de waarde, waar hij
     vandaan komt en wie hem mag zien. `bron` staat erbij zodat het scherm kan
     zeggen WAAR je hem wijzigt in plaats van een invoerveld te tonen dat hier
     toch niets opslaat. */
  const BRON = { persoonlijk: { app: '/apps/salon.html', naam: 'De Salon' },
    professioneel: { app: '/apps/zakelijk.html', naam: 'RTG Zakelijk' },
    creator: { app: '/apps/leverancier.html', naam: 'je creator-zaak' },
    ondernemer: { app: '/apps/leverancier.html', naam: 'je zaak' } };

  function mijnProfiel(key, tier) {
    const lagen = rechten.lagenVoor(tier);
    return lagen.map(l => ({
      laag: l.id, naam: l.naam, bron: BRON[l.id],
      velden: VELDEN.filter(v => v.laag === l.id).map(v => ({
        pad: v.pad, naam: v.naam, waarde: waarde(v.pad, key), zicht: zichtVan(key, v.pad)
      }))
    }));
  }

  /* Het profiel van een ander. Per veld wordt de zichtbaarheid toegepast; wat
     je niet mag zien komt er niet in afgezwakte vorm in, het komt er NIET in.
     Een leeg veld en een afgeschermd veld zijn van buiten niet te onderscheiden
     -- anders is de zichtbaarheid zelf een lek ("hij heeft wel iets ingevuld,
     maar niet voor jou"). */
  function profielVoor(kijker, doel, doelTier) {
    const lagen = rechten.lagenVoor(doelTier);
    return lagen.map(l => ({
      laag: l.id, naam: l.naam,
      velden: VELDEN.filter(v => v.laag === l.id)
        .filter(v => magZien(zichtVan(doel, v.pad), kijker, doel))
        .map(v => ({ pad: v.pad, naam: v.naam, waarde: waarde(v.pad, doel) }))
        .filter(v => v.waarde !== null)
    })).filter(l => l.velden.length);
  }

  return { VELDEN, mijnProfiel, profielVoor, zichtVan, zetZicht, magZien };
};
