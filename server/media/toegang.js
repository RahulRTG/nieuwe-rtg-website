/* WIE MAG EEN MEDIABESTAND ZIEN -- de poort voor /media (AUTHORITY.md B4).

   Tot 11 oktober 2026 serveerde /media/:naam ELK bestand uit de mediastore aan
   iedereen die de naam kende, zonder sessie, met `public, max-age=31536000,
   immutable`. Dat gold ook voor beeld dat nooit openbaar was: een Salon-foto
   "alleen ik" of "vrienden", een verhaal voor vrienden, een foto in het
   babyboekje, de voor- en na-foto's van een huurauto. Een verborgen URL is geen
   toegangscontrole, en een jaar publiek cachen maakt intrekken onmogelijk.

   De huisregel: informatie die iemand niet mag ontvangen, verstrekt de server
   hem niet. Daarom twee wegen, en de tweede is de standaard:

   1. OPENBAAR -- alleen beeld dat op dit moment op een VERKLAARDE openbare plek
      staat (de gesloten lijst KLASSEN hieronder). Die plek wordt uit de data
      afgeleid en niet bij het uploaden opgeslagen: een foto die van de etalage
      wordt gehaald of niet meer is uitgelicht, is binnen VERS_MS niet meer
      openbaar. Een plek die hier niet staat, is niet openbaar -- ook niet als
      zijn route ooit `bewaarPubliek` aanriep (die naam betekent sindsdien
      alleen nog "bewaar als /media-verwijzing", niet "maak openbaar").
   2. EEN KORT GELDIGE ONDERTEKENDE LINK (/media/t/<token>) voor al het andere.
      Een <img src> kan geen Authorization-kop sturen, dus de DOMEINROUTE die
      het beeld al aan deze kijker mag tonen (de Salon-leespoort, het gezin, de
      huurder) zet de link; de link zelf weet alleen welk bestand en tot wanneer.
      AES-256-GCM, dus niet te vervalsen en de bestandsnaam staat er niet leesbaar
      in -- wie een link ziet, leert de naam niet en kan hem dus ook nergens
      anders openbaar maken.

   Wat dit met opzet NIET doet: de link aan een kijker binden. Een <img> heeft
   geen sessie om tegen te toetsen; wie een link doorgeeft, geeft binnen
   LINK_MS toegang door. Dat is de prijs van een link en hij staat hier liever
   dan dat hij verzwegen wordt: kort, privé en nooit gecachet.

   Bestanden met het voorvoegsel `prive-` (bewaarBestandPrive) komen langs geen
   van beide wegen: die hebben een eigen domeinroute met een eigen poort. */
'use strict';

const crypto = require('crypto');
const path = require('path');

const LINK_MS = 15 * 60 * 1000;   // een ondertekende link: kort
const VERS_MS = 30 * 1000;        // hoe oud de openbare index hoogstens is
/* Een onbekende naam laat de index opnieuw lezen -- een zojuist geplaatste
   etalagefoto moet meteen werken -- maar hoogstens MISSERS_PER_S keer per
   seconde. Daarboven antwoordt de route gewoon 404: wie willekeurige namen
   raadt, kan zo de server niet laten blijven rekenen. */
const MISSERS_PER_S = 20;
const NAAM = /^[0-9a-f]{32}\.(jpg|jpeg|png|webp|mp4|webm|mov)$/;
const URL_PREFIX = '/media/';
const LINK_PREFIX = '/media/t/';
/* Openbaar mag een uur in een gedeelde cache. Niet een jaar en niet immutable:
   een zaak die een foto van haar kaart haalt, of een post die niet meer is
   uitgelicht, hoort binnen afzienbare tijd ook uit caches te verdwijnen. */
const CACHE_OPENBAAR = 'public, max-age=3600';
const CACHE_PRIVE = 'private, no-store';

const naamVan = ref => path.basename(String(ref || '').replace(URL_PREFIX, ''));
const isMediaRef = v => typeof v === 'string' && (v.startsWith(URL_PREFIX) || NAAM.test(v));

/* Een post van de Salon telt alleen als hij er nog staat. */
const levend = p => p && !p.weg && !p.verborgen && !p.archief;
function refsVanPost(p, voeg) {
  voeg(p.photo); voeg(p.visual);
  for (const m of (Array.isArray(p.media) ? p.media : [])) if (m) voeg(m.src);
  if (p.folder && Array.isArray(p.folder.fotos)) for (const f of p.folder.fotos) voeg(f);
}

/* DE GESLOTEN LIJST. Elke klasse zegt WAAR openbaar beeld staat en waarom het
   openbaar is. Een nieuwe openbare plek komt hier bij -- met een reden -- of hij
   is niet openbaar. Wat hier niet staat, is privé: fail-closed. */
const KLASSEN = Object.freeze({
  'zaak-etalage': {
    waarom: 'Beeld dat een zaak zelf op haar openbare pagina zet: paginafoto\'s, Salon-omslag, kaart, panden, showroom.',
    vind(data, voeg) {
      for (const s of data.suppliers || []) {
        if (!s) continue;
        for (const f of s.photos || []) voeg(f);
        if (s.salon) voeg(s.salon.foto);
        for (const m of s.menu || []) if (m) voeg(m.foto);
        for (const pand of s.panden || []) for (const f of (pand && pand.fotos) || []) voeg(f);
        for (const a of ((s.verkoop || {}).showroom) || []) for (const f of (a && a.fotos) || []) voeg(f);
      }
    }
  },
  'salon-zaak': {
    waarom: 'Een Salon-post van een zaak voor iedereen: commerciele publicatie, haar eigen Salon-pagina.',
    vind(data, voeg) {
      for (const p of data.posts || []) {
        if (!levend(p) || p.partner !== true) continue;
        if (!['iedereen', 'salon', undefined, null].includes(p.publiek)) continue;
        refsVanPost(p, voeg);
      }
    }
  },
  'salon-uitgelicht': {
    waarom: 'Een post die RTG heeft uitgelicht EN waarvan het lid toestemming gaf voor gebruik buiten De Salon (promoMag) -- de bron van "Uit De Salon" op sites en in de campagne.',
    vind(data, voeg) {
      for (const p of data.posts || []) {
        if (!levend(p) || p.partner === true) continue;
        if (p.featured === true && p.promoMag === true) refsVanPost(p, voeg);
      }
    }
  },
  'website': {
    waarom: 'De beeldbank van een website (Webmaker of Atelier): beeld dat expres voor een openbare site is geupload.',
    vind(data, voeg) {
      const leden = (data.ledenSites || {}).fotos;
      if (leden && typeof leden === 'object') for (const lijst of Object.values(leden)) for (const f of (Array.isArray(lijst) ? lijst : [])) voeg(f);
      for (const f of ((data.atelierSites || {}).fotos) || []) voeg(f);
    }
  }
});

let db = null;
let index = null, gebouwd = 0, vindFouten = 0;
let sleutel = null;
let geheimBron = null;

function bouw() {
  const uit = new Map();
  const data = (db && db.data) || {};
  for (const [klasse, k] of Object.entries(KLASSEN)) {
    const voeg = ref => {
      if (typeof ref !== 'string' || !ref.startsWith(URL_PREFIX)) return;
      const naam = naamVan(ref);
      if (NAAM.test(naam) && !uit.has(naam)) uit.set(naam, klasse);
    };
    /* Een kapotte plek maakt niets openbaar: de fout valt naar privé, en dat
       wordt geteld en gezegd in plaats van stil opgegeten. */
    try { k.vind(data, voeg); } catch (e) { vindFouten++; console.warn('[media] openbare plek ' + klasse + ' onleesbaar: ' + (e && e.message)); }
  }
  index = uit; gebouwd = Date.now();
}

let misserSeconde = 0, missers = 0;
function misserMag(nu) {
  const sec = Math.floor(nu / 1000);
  if (sec !== misserSeconde) { misserSeconde = sec; missers = 0; }
  return ++missers <= MISSERS_PER_S;
}

/* De klasse van een openbaar bestand, of null (= privé). `zonderHerlezen` is
   voor toon(): die draait voor elk beeld in een feed, en een privébeeld is daar
   altijd een "misser". Een te oude index kost daar niets -- een zojuist openbaar
   geworden bestand krijgt dan nog een privélink, en die werkt ook. */
function openbaarKlasse(naam, zonderHerlezen) {
  naam = naamVan(naam);
  if (!db || !NAAM.test(naam)) return null;
  const nu = Date.now();
  if (!index || nu - gebouwd > VERS_MS) bouw();
  let k = index.get(naam);
  if (!k && !zonderHerlezen && misserMag(nu)) { bouw(); k = index.get(naam); }
  return k || null;
}

let noodsleutel = null;
function sleutelNu() {
  if (sleutel) return sleutel;
  let geheim = null;
  try { geheim = geheimBron ? geheimBron() : null; } catch (e) { geheim = null; }
  if (!geheim) geheim = process.env.RTG_ENC_KEY || null;
  if (geheim) {
    sleutel = crypto.createHash('sha256').update('rtg-media-link-v1\0')
      .update(Buffer.isBuffer(geheim) ? geheim : String(geheim)).digest();
    return sleutel;
  }
  /* Nog geen geheim (de kluis is nog niet geladen, of een losse toets): een
     willekeurige processleutel, nooit de hash van een lege tekst. Hij wordt NIET
     vastgezet, zodat het echte geheim het overneemt zodra het er is; links van
     daarvoor vervallen dan, en dat is de veilige kant. */
  if (!noodsleutel) noodsleutel = crypto.randomBytes(32);
  return noodsleutel;
}

function teken(naam, nu) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', sleutelNu(), iv);
  c.setAAD(Buffer.from('rtg-media-link-v1'));
  const data = Buffer.from(JSON.stringify({ n: naam, e: (nu || Date.now()) + LINK_MS }));
  const enc = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64url');
}

/* De bestandsnaam achter een link, of null: vervalst, verlopen of geen
   mediabestand. Een weigering zegt nooit welke van de drie. */
function leesLink(token, nu) {
  try {
    const tekst = String(token || '');
    if (!/^[A-Za-z0-9_-]{40,400}$/.test(tekst)) return null;
    const raw = Buffer.from(tekst, 'base64url');
    if (raw.toString('base64url') !== tekst || raw.length < 29) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', sleutelNu(), raw.subarray(0, 12));
    d.setAAD(Buffer.from('rtg-media-link-v1'));
    d.setAuthTag(raw.subarray(12, 28));
    const v = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
    if (!v || typeof v.n !== 'string' || !NAAM.test(v.n) || !Number.isFinite(v.e)) return null;
    if (v.e < (nu || Date.now())) return null;
    return v.n;
  } catch (e) { return null; }
}

/* Wat een domeinroute aan een kijker teruggeeft voor een opgeslagen verwijzing.
   ROEP DIT ALLEEN AAN NA DE EIGEN TOEGANGSPOORT VAN HET DOMEIN: de link IS de
   toegang. Geen mediaverwijzing (een data-URL, /campagne/..., null) gaat
   ongewijzigd terug. */
function toon(ref) {
  if (typeof ref === 'string' && /^(\/media\/)?prive-/.test(ref)) return null;   // eigen domeinroute, nooit hier
  if (!isMediaRef(ref)) return ref;
  const naam = naamVan(ref);
  if (!NAAM.test(naam)) return null;           // prive-* en rommel: geen link
  if (openbaarKlasse(naam, true)) return URL_PREFIX + naam;
  return LINK_PREFIX + teken(naam);
}

/* De voor- en na-foto's van een huur of charter: dezelfde vorm terug, met elke
   foto als link die de verhuurder (de aanroeper, na zijn eigen poort) mag tonen. */
function inspectie(f) {
  const fase = lijst => (Array.isArray(lijst) ? lijst : []).map(x => Object.assign({}, x, { foto: toon(x && x.foto) }));
  return { voor: fase(f && f.voor), na: fase(f && f.na) };
}

function zet(opties) {
  db = (opties && opties.db) || null;
  geheimBron = (opties && typeof opties.geheim === 'function') ? opties.geheim : null;
  sleutel = null; index = null; gebouwd = 0;
}

module.exports = { KLASSEN, LINK_MS, VERS_MS, CACHE_OPENBAAR, CACHE_PRIVE, NAAM, LINK_PREFIX,
  stand: () => ({ vindFouten, openbaar: index ? index.size : 0 }),
  zet, toon, inspectie, openbaarKlasse, leesLink, teken, naamVan, isMediaRef };
