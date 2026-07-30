/* Gebedstijden en de richting van Mekka, zelf uitgerekend.

   Waarom zelf en niet via een dienst: dit is precies het soort gegeven dat je
   niet aan een derde wilt geven. Een verzoek om gebedstijden verraadt drie
   dingen tegelijk: waar iemand is, hoe laat het daar is, en welk geloof hij
   aanhangt. Dat is een van de gevoeligste combinaties die er bestaat. Het is
   bovendien gewoon rekenwerk (zonnestand en een boldriehoek), dus er is geen
   enkele reden om er iemand anders bij te halen. Zelfde lijn als de rest van
   dit huis (docs/de-lijn.md).

   Eerlijk over de nauwkeurigheid, want bij gebed telt dat:
   - de zonnestand is nauwkeurig tot ongeveer een minuut. Ruim genoeg;
   - de hoeken voor fajr en isha VERSCHILLEN per methode, en daar is geen
     "juiste" waarde voor. Daarom kiest het lid zelf een methode, en zeggen we
     erbij welke gebruikt is in plaats van te doen alsof er een waarheid is;
   - op hoge breedtegraden (boven ~48 graden) gaat de zon in de zomer niet ver
     genoeg onder de horizon, en bestaan fajr en isha astronomisch niet. Dan
     geven we niet stilletjes een verzonnen tijd terug maar zeggen we dat, met
     de gebruikelijke benadering erbij (nachtdeling). Een verzonnen tijd zou
     hier erger zijn dan geen tijd.
   Alles in UTC-minuten binnenin; de weergave gebeurt met de tijdzone van het
   toestel. */

const KAABA = { lat: 21.4225, lon: 39.8262 };
const RAD = Math.PI / 180;

/* De methodes. `fajr` en `isha` zijn hoeken onder de horizon; `ishaNa` is de
   variant die isha een vast aantal minuten na maghrib legt (Umm al-Qura). */
const METHODES = {
  mwl: { naam: 'Muslim World League', fajr: 18, isha: 17 },
  isna: { naam: 'ISNA (Noord-Amerika)', fajr: 15, isha: 15 },
  egypte: { naam: 'Egyptische Autoriteit', fajr: 19.5, isha: 17.5 },
  ummalqura: { naam: 'Umm al-Qura (Mekka)', fajr: 18.5, isha: null, ishaNa: 90 },
  karachi: { naam: 'Karachi', fajr: 18, isha: 18 },
  tehran: { naam: 'Teheran', fajr: 17.7, isha: 14 }
};
// asr: schaduwlengte 1x het object (meerderheid) of 2x (hanafi)
const ASR_FACTOR = { standaard: 1, hanafi: 2 };

// Juliaanse dag voor 0h UT
function juliaanseDag(d) {
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const dag = d.getUTCDate();
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dag + b - 1524.5;
}

/* Zonnestand: declinatie en tijdsvereffening voor een gegeven juliaanse dag.
   De klassieke lage-precisiereeks; ruim voldoende (fout onder de minuut). */
function zon(jd) {
  const d = jd - 2451545.0;
  const g = (357.529 + 0.98560028 * d) % 360;               // gemiddelde anomalie
  const q = (280.459 + 0.98564736 * d) % 360;               // gemiddelde lengte
  const L = (q + 1.915 * Math.sin(g * RAD) + 0.020 * Math.sin(2 * g * RAD)) % 360; // ware lengte
  const e = 23.439 - 0.00000036 * d;                        // scheefheid
  const decl = Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD)) / RAD;
  let ra = Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) / RAD;
  ra = ((ra % 360) + 360) % 360;
  let eqt = q / 15 - ra / 15;                               // tijdsvereffening in uren
  if (eqt > 12) eqt -= 24; if (eqt < -12) eqt += 24;
  return { decl, eqt };
}

// uurhoek (in uren) waarop de zon op hoogte `hoogte` staat; null als dat nooit gebeurt
function uurhoek(hoogte, lat, decl) {
  const cosH = (Math.sin(hoogte * RAD) - Math.sin(lat * RAD) * Math.sin(decl * RAD)) /
    (Math.cos(lat * RAD) * Math.cos(decl * RAD));
  if (cosH > 1 || cosH < -1) return null;                   // komt nooit voor op deze breedte
  return Math.acos(cosH) / RAD / 15;
}

const klok = (uurUtc) => {
  let u = ((uurUtc % 24) + 24) % 24;
  const m = Math.round(u * 60);
  return { minutenUtc: m, tekst: String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') };
};

/* De vijf tijden voor een dag en een plek.
   lat/lon in graden, datum een Date (de dag telt, niet het tijdstip). */
function gebedstijden(lat, lon, datum, opties) {
  const o = opties || {};
  const m = METHODES[o.methode] || METHODES.mwl;
  const asrF = ASR_FACTOR[o.asr] || ASR_FACTOR.standaard;
  const d = datum instanceof Date ? datum : new Date();
  const jd = juliaanseDag(d);
  const { decl, eqt } = zon(jd + 0.5);

  const middag = 12 - lon / 15 - eqt;                       // zonnemiddag in UT-uren
  // hoogte van de zonnerand bij op-/ondergang, met refractie
  const hOpOnder = -0.833;
  const hAsr = Math.atan(1 / (asrF + Math.tan(Math.abs(lat - decl) * RAD))) / RAD;

  const hOp = uurhoek(hOpOnder, lat, decl);
  const hAsrH = uurhoek(hAsr, lat, decl);
  const hFajr = uurhoek(-m.fajr, lat, decl);
  const hIsha = m.isha == null ? null : uurhoek(-m.isha, lat, decl);

  const uit = { methode: m.naam, methodeId: o.methode && METHODES[o.methode] ? o.methode : 'mwl',
    asr: o.asr === 'hanafi' ? 'hanafi' : 'standaard', waarschuwing: null };

  uit.dhuhr = klok(middag);
  if (hOp == null) {
    // poolzomer of poolnacht: geen zonsopgang/ondergang
    uit.waarschuwing = 'Op deze breedtegraad komt de zon vandaag niet op of niet onder. Gebedstijden zijn hier een kwestie van afspraak; volg de tijden van een plek op ongeveer 45 graden of het advies van uw gemeenschap.';
    return uit;
  }
  uit.zonsopgang = klok(middag - hOp);
  uit.maghrib = klok(middag + hOp);
  uit.asr = hAsrH == null ? null : klok(middag + hAsrH);

  if (hFajr != null) uit.fajr = klok(middag - hFajr);
  if (m.isha == null) uit.isha = klok(middag + hOp + (m.ishaNa || 90) / 60);
  else if (hIsha != null) uit.isha = klok(middag + hIsha);

  /* De zomernacht op hoge breedte: de zon zakt niet diep genoeg, dus fajr
     en/of isha bestaan astronomisch niet. We benaderen met de nachtdeling
     (een zevende van de nacht) EN we zeggen erbij dat het een benadering is.
     Stil een getal invullen zou hier oneerlijk zijn. */
  if (!uit.fajr || !uit.isha) {
    const nachtUren = 24 - 2 * hOp;
    const deel = nachtUren / 7;
    if (!uit.fajr) uit.fajr = klok(middag - hOp - deel);
    if (!uit.isha) uit.isha = klok(middag + hOp + deel);
    uit.waarschuwing = 'De zon komt hier vannacht niet diep genoeg onder de horizon, dus fajr en/of isha zijn astronomisch niet te bepalen. ' +
      'De getoonde tijd is de gebruikelijke benadering (een zevende deel van de nacht); gemeenschappen kiezen hierin verschillend.';
  }
  return uit;
}

/* De richting van Mekka: de beginkoers van de grootcirkel, in graden vanaf het
   noorden. Dat is de qibla zoals die wereldwijd wordt gehanteerd. */
function qibla(lat, lon) {
  const dLon = (KAABA.lon - lon) * RAD;
  const y = Math.sin(dLon);
  const x = Math.cos(lat * RAD) * Math.tan(KAABA.lat * RAD) - Math.sin(lat * RAD) * Math.cos(dLon);
  let hoek = Math.atan2(y, x) / RAD;
  return ((hoek % 360) + 360) % 360;
}

// hemelsbrede afstand tot de Kaaba in kilometers
function afstandMekka(lat, lon) {
  const R = 6371;
  const dLat = (KAABA.lat - lat) * RAD, dLon = (KAABA.lon - lon) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * RAD) * Math.cos(KAABA.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

const STREKEN = ['noord', 'noordoost', 'oost', 'zuidoost', 'zuid', 'zuidwest', 'west', 'noordwest'];
const streek = (graden) => STREKEN[Math.round(((graden % 360) + 360) % 360 / 45) % 8];

module.exports = { gebedstijden, qibla, afstandMekka, streek, METHODES, KAABA, _zon: zon, _juliaanseDag: juliaanseDag };
