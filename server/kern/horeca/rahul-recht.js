/* Horeca (kern): DE RECHTENLAAG VAN RAHUL, en de actiebon die erbij hoort.

   De opdracht was: een AI-voorstel kan nooit ONGEMERKT een allergie aanpassen,
   een betaling uitvoeren, een medewerker beoordelen, een alcoholbeperking
   negeren, een voorraadverschil wegboeken of een hoge korting toekennen.

   "Nooit ongemerkt" is geen belofte maar een eigenschap, en die eigenschap komt
   hier vandaan: DE ENIGE WEG WAARLANGS RAHUL IETS DOET, LOOPT HIERDOORHEEN, EN
   DEZE WEG SCHRIJFT ALTIJD EEN BON. Ook een weigering. Juist een weigering --
   dat is precies wat je wilt terugzien.

   VIER DINGEN LIGGEN VAST:

   1. EEN VOORSTEL VERANDERT NIETS. Bij laag `mensbevestigt` wordt het werk niet
      uitgevoerd; er komt een bon met stand `wacht`. Pas `bevestig()` doet iets,
      en dan staat de naam van de mens op de bon. Een systeem waarin een
      voorstel alvast half doorgaat, heeft geen bevestiging maar een
      vertraging.
   2. VERBODEN IS VERBODEN, en er is geen instelling die dat opheft. Er komt wel
      een bon: een geweigerde poging is informatie, en een poging die niemand
      ziet is de gevaarlijkste.
   3. DE BON IS APPEND-ONLY. Dit bestand heeft met opzet geen functie die een
      bon wist of herschrijft. Alleen de FIFO boven MAX snoeit de oudste weg,
      zodat de opslag begrensd blijft (dezelfde vorm als
      kern/geldbeleid/actielog.js, en om dezelfde reden).
   4. DE BON DRAAGT DE REDEN VAN DE LAAG, niet alleen de uitkomst. "Geweigerd"
      zonder waarom is een muur; met waarom is het een regel die iemand kan
      aanvechten of veranderen.

   WAT DIT NIET IS: een echtheidscontrole op wie Rahul is. Deze laag wordt
   aangeroepen vanuit een route die al door supplierAuth is gekomen; wie er
   achter de knop zat staat op de bon. De vraag hier is niet WIE maar WAT. */
'use strict';

const register = require('./rahul-register');

const MAX = 300;              // hoeveel bonnen we per zaak bewaren
const MAXTEKST = 300;

function doos(h) {
  if (!Array.isArray(h.rahulBonnen)) h.rahulBonnen = [];
  return h.rahulBonnen;
}
const kort = (t, n) => String(t == null ? '' : t).slice(0, n || MAXTEKST);

/* De grens waarboven een korting een mens vraagt. GEEN standaardwaarde: zonder
   instelling vraagt ELKE korting een mens. Een drempel verzinnen zou hier een
   getal maken dat niemand heeft afgesproken (HORECA.md, grens 7). */
function kortingGrensCenten(h) {
  const g = (h.instel || {}).rahulKortingGrensCenten;
  return Number.isFinite(Number(g)) && Number(g) >= 0 ? Math.round(Number(g)) : null;
}

/* Het oordeel. Puur: dezelfde invoer geeft altijd hetzelfde antwoord, en er
   staat niets in dat van buiten kan veranderen behalve de instelling van de
   zaak zelf. */
function beoordeel(h, handelingId, gegevens) {
  const hd = register.handeling(handelingId);
  if (hd.laag === 'verboden') {
    return { mag: false, laag: 'verboden', handeling: hd, reden: hd.waarom };
  }
  if (hd.laag === 'mag') {
    /* Een korting is bij uitzondering laag-afhankelijk: klein en binnen de
       grens van de zaak mag zelfstandig, daarboven niet. Dat staat hier en niet
       in het register, want het hangt van de GEGEVENS af en niet van de soort. */
    return { mag: true, laag: 'mag', handeling: hd, reden: hd.waarom };
  }
  if (hd.id === 'korting.toekennen') {
    const grens = kortingGrensCenten(h);
    const centen = Math.round(Number((gegevens || {}).centen));
    if (grens !== null && Number.isFinite(centen) && centen <= grens) {
      return { mag: true, laag: 'mag', handeling: hd,
        reden: 'Binnen de kortingsgrens die deze zaak heeft ingesteld (' + (grens / 100).toFixed(2) + ').' };
    }
    return { mag: false, laag: 'mensbevestigt', handeling: hd,
      reden: grens === null
        ? 'Deze zaak heeft geen kortingsgrens ingesteld, dus vraagt elke korting een mens.'
        : 'Boven de kortingsgrens van deze zaak (' + (grens / 100).toFixed(2) + ').' };
  }
  return { mag: false, laag: 'mensbevestigt', handeling: hd, reden: hd.waarom };
}

function schrijf(h, bon) {
  const lijst = doos(h);
  lijst.unshift(bon);
  if (lijst.length > MAX) lijst.length = MAX;
  return bon;
}

module.exports = ({ horeca, save }) => {
  const { nu, id } = horeca;

  /* De enige deur. `doen` is het werkelijke werk; hij wordt ALLEEN aangeroepen
     als het oordeel dat toestaat. Geeft altijd een bon terug -- ook bij een
     weigering, en ook als het werk zelf mislukt. */
  function doe(h, { handeling, door, gegevens, waarom, doen }) {
    const oordeel = beoordeel(h, handeling, gegevens);
    const bon = {
      id: id(5), at: nu(),
      handeling: oordeel.handeling.id, wat: oordeel.handeling.wat,
      laag: oordeel.laag, reden: oordeel.reden,
      bekend: oordeel.handeling.bekend,
      door: kort(door, 60) || null,
      waarom: kort(waarom, MAXTEKST) || null,
      gegevens: gegevens && typeof gegevens === 'object' ? JSON.parse(JSON.stringify(gegevens)) : null,
      stand: oordeel.laag === 'verboden' ? 'geweigerd' : (oordeel.mag ? 'uitgevoerd' : 'wacht'),
      bevestigdDoor: null, bevestigdAt: null, uitkomst: null
    };
    if (oordeel.mag && typeof doen === 'function') {
      const r = doen();
      /* Mislukt het werk, dan staat dat op de bon. Een bon die "uitgevoerd"
         zegt over iets dat niet gebeurde, is erger dan geen bon. */
      if (r && r.error) { bon.stand = 'mislukt'; bon.uitkomst = kort(r.error, MAXTEKST); }
      else bon.uitkomst = kort((r && r.let) || 'Uitgevoerd.', MAXTEKST);
    }
    schrijf(h, bon);
    save();
    return { ok: true, bon, oordeel };
  }

  /* Een mens bevestigt een wachtend voorstel. Pas HIER gebeurt het werk. */
  function bevestig(h, bonId, wie, doen) {
    const bon = doos(h).find((b) => b.id === String(bonId || ''));
    if (!bon) return { status: 404, error: 'Deze actiebon kennen we niet.' };
    if (bon.stand === 'geweigerd')
      return { status: 409, error: 'Deze handeling is verboden; er valt niets te bevestigen. ' + bon.reden };
    if (bon.stand !== 'wacht')
      return { status: 409, error: 'Deze bon is al ' + bon.stand + '.' };
    if (!wie) return { status: 400, error: 'Wie bevestigt dit?' };
    bon.bevestigdDoor = kort(wie, 60);
    bon.bevestigdAt = nu();
    bon.stand = 'uitgevoerd';
    if (typeof doen === 'function') {
      const r = doen(bon);
      if (r && r.error) { bon.stand = 'mislukt'; bon.uitkomst = kort(r.error, MAXTEKST); }
      else bon.uitkomst = kort((r && r.let) || 'Uitgevoerd na bevestiging.', MAXTEKST);
    }
    save();
    return { ok: true, bon };
  }

  // lezen. Kopieen, zodat append-only een eigenschap blijft en geen belofte.
  function bonnen(h, hoeveel) {
    const n = Math.max(1, Math.min(MAX, parseInt(hoeveel, 10) || 50));
    return doos(h).slice(0, n).map((b) => JSON.parse(JSON.stringify(b)));
  }

  return { doe, bevestig, bonnen, beoordeel, kortingGrensCenten, MAX };
};
