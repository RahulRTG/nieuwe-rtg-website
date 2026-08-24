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
      die nergens in het beleid staan. Die lijst hoort te krimpen. Een
      bewaarbeleid dat doet alsof het compleet is terwijl het dertig categorieen
      overslaat, is misleidender dan geen beleid.

   De TABEL zelf (welke tak, hoe lang, waarom) staat in ./bewaarbeleid.js; hier
   woont de motor die hem uitvoert. Die twee zijn gescheiden omdat de motor
   bijna nooit verandert en de tabel bij elke nieuwe tak groeit.

   Het beleid kent alleen de takken die een DATUM per item hebben; zonder
   datum valt er niets te verlopen en hoort de opschoning bij de functie zelf
   (zie kern/zelfzorg/opruimen.js voor de 24-uursregels). */

/* Het beleid komt uit TWEE bestanden en wordt hier samengevoegd, niet in de
   tabel zelf: ./bewaarbeleid.js zat al op 98% van de 10 kB-grens, en de takken
   met eigen regie zijn bovendien een ander soort regel (een termijn waarvan de
   klok elders loopt en waar veeg() van afblijft). Ze bij elkaar zetten in de
   MOTOR is de goede plek -- die kent het verschil al. */
const { BELEID: GEWONE_TERMIJNEN, DAG } = require('./bewaarbeleid');
const { EIGEN_REGIE } = require('./bewaarbeleid-eigenregie');
const BELEID = GEWONE_TERMIJNEN.concat(EIGEN_REGIE);

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
  /* EIGEN REGIE: een map van OBJECTEN (niet van lijsten) waarvan de klok ergens
     anders woont. Alleen lezen, zodat rapport() hem kan tellen; veeg() komt hier
     niet eens langs (zie daar). Zou hij dat wel doen, dan wist hij op een
     aanmaakdatum wat op een opzegdatum hoort te verlopen. */
  if (regel.vorm === 'eigenRegie') {
    if (typeof bron !== 'object' || Array.isArray(bron)) return;
    for (const sleutel of Object.keys(bron)) doe(bron[sleutel]);
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
    const eigen = r.vorm === 'eigenRegie';
    perItem(data, r, (item) => {
      totaal++;
      const t = msVan(item && item[r.datum]);
      /* Bij eigen regie NIET tegen de grens leggen: die datum is een
         aanmaakmoment en geen verloopmoment, en "verlopen: 12" zou hier lezen
         als twaalf klanten die weg hadden gemoeten. */
      if (!Number.isNaN(t)) { if (oudste == null || t < oudste) oudste = t; if (!eigen && t < grens) verlopen++; }
      return false; // niets verwijderen
    });
    regels.push({
      tak: r.tak, label: r.label, grond: r.grond, waarom: r.waarom,
      termijn: r.dagen >= 365 ? Math.round(r.dagen / 365) + ' jaar' : r.dagen + ' dagen',
      totaal, verlopen: eigen ? null : verlopen, eigenRegie: eigen ? r.regie : null,
      oudste: oudste == null ? null : new Date(oudste).toISOString().slice(0, 10)
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
    /* De veger komt niet aan een tak met eigen regie. Die klok loopt elders en
       op een ander veld; hier meekijken zou betekenen dat twee motoren dezelfde
       gegevens mogen wissen, en de generieke van de twee kent de uitzonderingen
       niet (een bewaringsplicht, een lopende opzegging). */
    if (r.vorm === 'eigenRegie') continue;
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
  /* DE KLUIS TELT NIET MEE, EN DAT WAS ONZICHTBAAR.

     Deze lus loopt over db.data, en dat is precies de helft van de gegevens.
     Van een ECHT account staat het ledendossier niet in db.data maar versleuteld
     in de kolom member_state (accounts/dossier.js): facturen, de reis, het
     creator-tegoed en de gesprekken met Rahul. perItem() hierboven leest ook
     alleen data[tak], dus rapport() telt van een echt account nul items en
     veeg() raakt er niets. Voor de seed-persona's ziet alles er dus keurig uit,
     terwijl juist de echte leden buiten het beleid vallen.

     Dat botst met de belofte bovenaan dit bestand: "een bewaarbeleid dat doet
     alsof het compleet is terwijl het dertig categorieen overslaat, is
     misleidender dan geen beleid." Daarom staat de kluis nu ALS GAT in de lijst,
     ook al kunnen we hem hier nog niet vegen -- zichtbaar is beter dan stil.

     Waarom nog niet gerepareerd en niet alleen gemeld: vegen in de kluis vraagt
     eerst een BESLUIT dat RTG moet nemen (hoe lang bewaren we facturen, een reis,
     een gesprek met Rahul?). Die vraag staat in server/papieren/vragen.js en is
     nog niet beantwoord. Een termijn verzinnen zou hier het ergste van twee
     werelden zijn: gegevens weggooien op een grond die niemand heeft vastgesteld. */
  uit.push({ tak: 'kluis: ledendossier (member_state)', items: null,
    reden: 'facturen, reis, creator-tegoed en Rahul-gesprekken van echte accounts staan versleuteld buiten db.data; '
      + 'het beleid kan er pas overheen zodra de bewaartermijnen zijn vastgesteld (zie papieren/vragen.js)' });
  return uit.sort((a, b) => (b.items || 0) - (a.items || 0));
}

module.exports = { BELEID, rapport, veeg, zonderBeleid };
