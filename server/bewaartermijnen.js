/* BEWAARTERMIJNEN -- hoe lang houden we wat, en waarom.

   Het recht op vergetelheid (art. 17) dekt wat een lid ZELF vraagt. Dit bestand
   dekt de andere helft, die makkelijker vergeten wordt: opslagbeperking
   (AVG art. 5 lid 1 sub e). Gegevens die je niet meer nodig hebt, mag je niet
   houden -- ook al vraagt niemand erom. Een lid dat drie jaar niet inlogt en
   wiens dossier er nog compleet staat, is een overtreding waar niemand over
   klaagt tot het misgaat.

   DRIE REGELS DIE DE REST VERKLAREN:

   1. DE WET WINT VAN MINIMALISATIE. Facturen, betalingen en loonadministratie
      MOETEN zeven jaar bewaard blijven (art. 52 Algemene wet inzake
      rijksbelastingen). Die te vroeg wissen is zelf een overtreding. Ze staan
      hieronder met grond 'wettelijk' en de veger raakt ze niet aan voor hun
      termijn om is. Dataminimalisatie is geen vrijbrief om je administratie
      weg te gooien.

   2. STANDAARD WORDT ER NIETS GEWIST. veeg() maakt een rapport; pas met
      { echt: true } verwijdert hij ook. Wissen is onomkeerbaar, en een
      opruimtaak die vanaf dag een stilletjes data weggooit is een ramp die je
      pas ziet als hij al is gebeurd. De eigenaar zet hem aan als hij het
      rapport heeft gezien en herkent.

   3. WAT GEEN TERMIJN HEEFT, WORDT GENOEMD. zonderBeleid() somt de takken op
      die nergens in dit bestand staan. Die lijst hoort te krimpen. Een
      bewaarbeleid dat doet alsof het compleet is terwijl het dertig categorieen
      overslaat, is misleidender dan geen beleid.

   Dit bestand kent alleen de takken die een DATUM per item hebben; zonder
   datum valt er niets te verlopen en hoort de opschoning bij de functie zelf
   (zie kern/zelfzorg/opruimen.js voor de 24-uursregels). */

const DAG = 86400000;
const JAAR = 365 * DAG;

/* vorm: hoe de tak in elkaar zit.
     lijst          -- een array van items
     mapVanLijsten  -- { sleutel: [ item, ... ] }, per lid
   datum: het veld met de tijdstempel (ISO of ms). */
const BELEID = [
  // --- wettelijk: NIET eerder weg, ook niet op verzoek ---
  { tak: 'invoices', label: 'facturen en bijdragen', dagen: 7 * JAAR / DAG, grond: 'wettelijk',
    vorm: 'lijst', datum: 'date', waarom: 'fiscale bewaarplicht (7 jaar, art. 52 AWR)' },
  { tak: 'klok', label: 'gewerkte uren (loonadministratie)', dagen: 7 * JAAR / DAG, grond: 'wettelijk',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'loonadministratie, fiscale bewaarplicht (7 jaar)' },
  /* De maandtermijnen van een lidmaatschap, met de 30%-split naar de
     RTFoundation. Dit is administratie: hij blijft staan als een lid zich laat
     verwijderen, want de fiscale bewaarplicht gaat voor het wisrecht (AVG art.
     17 lid 3 sub b). Dat het hier STAAT is het punt -- een uitzondering die
     alleen in een test als "mag blijven" is afgevinkt, is een uitzondering die
     niemand kan navertellen. */
  { tak: 'lidmaatschapBetalingen', label: 'lidmaatschapstermijnen', dagen: 7 * JAAR / DAG, grond: 'wettelijk',
    vorm: 'lijst', datum: 'at', waarom: 'fiscale bewaarplicht (7 jaar, art. 52 AWR); ook de foundation-split moet navolgbaar blijven' },

  // --- audit: lang genoeg om een incident te kunnen navertellen ---
  { tak: 'inzageLog', label: 'inzagejournaal identiteitskluis', dagen: 2 * JAAR / DAG, grond: 'audit',
    vorm: 'lijst', datum: 'at', waarom: 'een betrokkene moet kunnen navragen wie in zijn dossier keek' },
  { tak: 'securityLog', label: 'beveiligingslogboek', dagen: JAAR / DAG, grond: 'audit',
    vorm: 'lijst', datum: 'at', waarom: 'inbraakpogingen achteraf kunnen herleiden' },

  // --- operationeel: weg zodra het zijn doel heeft gediend ---
  { tak: 'applications', label: 'sollicitaties', dagen: 365, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'een jaar na indienen; daarna heeft niemand er nog iets aan' },
  { tak: 'guestChats', label: 'gastgesprekken met een zaak', dagen: 365, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'servicegesprek over een bezoek van vorig jaar is voorbij' },
  { tak: 'memberChats', label: 'gesprekken tussen leden', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'persoonlijke berichten, maar niet eindeloos' },
  { tak: 'notifications', label: 'meldingen', dagen: 180, grond: 'nodig',
    vorm: 'mapVanLijsten', datum: 'at', waarom: 'een melding van een half jaar oud is geen melding meer' },
  { tak: 'reports', label: 'misbruikmeldingen', dagen: 2 * JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'herhaling moet zichtbaar blijven, maar niet voor altijd' },
  { tak: 'paspoortLog', label: 'paspoortcontroles', dagen: JAAR / DAG, grond: 'nodig',
    vorm: 'lijst', datum: 'at', waarom: 'aantonen dat een leeftijdscheck is gedaan' }
];

const msVan = (v) => {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return Number.isNaN(t) ? NaN : t;
};

/* Loop over de items van een tak, ongeacht de vorm. De terugroep krijgt het
   item plus een manier om het te verwijderen, zodat rapport en veeg dezelfde
   code delen -- anders rapporteer je het een en wis je het ander. */
function perItem(data, regel, doe) {
  const bron = data[regel.tak];
  if (!bron) return;
  if (regel.vorm === 'lijst') {
    if (!Array.isArray(bron)) return;
    const houd = [];
    for (const item of bron) if (!doe(item)) houd.push(item);
    data[regel.tak] = houd;
    return;
  }
  if (regel.vorm === 'mapVanLijsten') {
    if (typeof bron !== 'object') return;
    for (const sleutel of Object.keys(bron)) {
      if (!Array.isArray(bron[sleutel])) continue;
      const houd = [];
      for (const item of bron[sleutel]) if (!doe(item)) houd.push(item);
      bron[sleutel] = houd;
    }
  }
}

/* Wat staat er over de termijn? Telt alleen; verandert niets. */
function rapport(db) {
  const data = (db && db.data) || {};
  const nu = Date.now();
  const regels = [];
  for (const r of BELEID) {
    const grens = nu - r.dagen * DAG;
    let totaal = 0, verlopen = 0, oudste = null;
    perItem(data, r, (item) => {
      totaal++;
      const t = msVan(item && item[r.datum]);
      if (!Number.isNaN(t)) { if (oudste == null || t < oudste) oudste = t; if (t < grens) verlopen++; }
      return false; // niets verwijderen
    });
    regels.push({
      tak: r.tak, label: r.label, grond: r.grond, waarom: r.waarom,
      termijn: r.dagen >= 365 ? Math.round(r.dagen / 365) + ' jaar' : r.dagen + ' dagen',
      totaal, verlopen, oudste: oudste == null ? null : new Date(oudste).toISOString().slice(0, 10)
    });
  }
  return { at: new Date().toISOString(), regels, verlopenTotaal: regels.reduce((n, r) => n + r.verlopen, 0) };
}

/* Opruimen. Zonder { echt: true } verandert er niets en krijg je alleen te
   zien wat er zou gebeuren -- dat is met opzet de standaard. */
function veeg(db, opties) {
  const echt = !!(opties && opties.echt);
  const data = (db && db.data) || {};
  const nu = Date.now();
  const gedaan = [];
  for (const r of BELEID) {
    const grens = nu - r.dagen * DAG;
    let n = 0;
    perItem(data, r, (item) => {
      const t = msVan(item && item[r.datum]);
      if (Number.isNaN(t) || t >= grens) return false;   // geen datum of nog binnen termijn: blijft
      n++;
      return echt;                                        // alleen echt verwijderen als het mag
    });
    if (n) gedaan.push({ tak: r.tak, label: r.label, aantal: n, grond: r.grond });
  }
  return { echt, gedaan, totaal: gedaan.reduce((s, g) => s + g.aantal, 0) };
}

/* De eerlijke gatenlijst: welke takken met data hebben nergens een termijn?
   Deze lijst hoort te krimpen. Hij staat op het techniekbord zodat het gat
   zichtbaar is in plaats van vergeten. */
function zonderBeleid(db) {
  const data = (db && db.data) || {};
  const gedekt = new Set(BELEID.map(r => r.tak));
  const uit = [];
  for (const tak of Object.keys(data)) {
    if (gedekt.has(tak) || tak.startsWith('_') || tak === '__schema') continue;
    const v = data[tak];
    const n = Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);
    if (n > 0) uit.push({ tak, items: n });
  }
  return uit.sort((a, b) => b.items - a.items);
}

module.exports = { BELEID, rapport, veeg, zonderBeleid };
