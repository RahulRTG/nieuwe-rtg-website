/* De Marktplaats (kern/markt.js): kopen en verkopen tussen RTG-leden,
   RTFoundation-gezinnen en leveranciers. Eén gedeelde motor voor alle drie de
   apps, met vier pijlers ingebouwd:

   - Veiligheid: verkopersbadge (geverifieerd/zaak/gezin), oplichting-detectie
     (te-mooi-om-waar prijs, betalen-vooraf, contact buiten de app), melden en
     blokkeren, en veilige-afspraak-tips. Kinderprofielen mogen niet verkopen.
   - Respect: verboden waren worden geweigerd (wapens, drugs, namaak, dieren,
     leeftijdsgebonden waar), kwetsende taal wordt tegengehouden, en er zijn
     huisregels die iedereen bij het plaatsen bevestigt.
   - Gemak: categorieen, zoeken en filteren op prijs en plaats, ophalen of
     verzenden, en een chat per advertentie tussen koper en verkoper.
   - AI-hulp: schrijft een eerlijke omschrijving, stelt een prijs voor, raadt de
     categorie, en doet een veiligheidscheck op een advertentie of een chat.

   Alles staat onder db.data.markt zodat het meelift op het atomische wegschrijven
   en de back-up van de hoofdserver, en gedeeld is met de RTFoundation-router. */

const CATEGORIEEN = ['kleding', 'kids', 'wonen', 'elektronica', 'vrije-tijd', 'tuin', 'vervoer', 'boeken', 'sport', 'overig'];
const STATEN = ['nieuw', 'zgan', 'gebruikt'];
const LEVERING = ['ophalen', 'verzenden'];

// Respect: kwetsende / discriminerende taal (kort, uitbreidbaar).
const RESPECTLOOS = /\b(kanker|tering|hoer|kut(?:wijf|hoer)?|neger|mongool|flikker|nazi|homofiel scheldwoord)\b/i;
// Verboden waar: hier hoort niets van thuis, in geen enkele app.
const VERBODEN = [
  { rx: /\b(wapen|vuurwapen|pistool|geweer|patronen|munitie|mes\s*met|boksbeugel|taser|stroomstootwapen)\b/i, waarom: 'wapens' },
  { rx: /\b(cocaine|coke|xtc|mdma|wiet|hasj|speed|heroine|lsd|ghb|lachgas)\b/i, waarom: 'drugs' },
  { rx: /\b(medicijn(?:en)?|antibiotica|oxycodon|ritalin|viagra|afslankpil)\b/i, waarom: 'medicijnen' },
  { rx: /\b(namaak|replica|fake\s*merk|imitatie\s*merk|counterfeit)\b/i, waarom: 'namaak' },
  { rx: /\b(puppy|kitten|hond|kat|reptiel|papegaai)\s*(te koop|kopen)\b/i, waarom: 'levende dieren' }
];
// Veiligheid: signalen die op oplichting kunnen wijzen.
const SCAM_WOORDEN = /\b(vooruitbetal|aanbetaling vooraf|western union|moneygram|cadeaukaart(?:code)?|giftcard|tikkie\s*vooraf|betaal eerst|verzendkosten vooraf|buiten de app|whatsapp mij|bel mij op 06|paypal vrienden)\b/i;
const CONTACT_BUITEN = /(\+?\d[\d\s-]{7,}\d)|([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})|(https?:\/\/|www\.)/i;

// Ruwe richtprijs per categorie (voor de AI-prijssuggestie zonder externe data).
const RICHTPRIJS = {
  kleding: 15, kids: 12, wonen: 40, elektronica: 80, 'vrije-tijd': 25,
  tuin: 30, vervoer: 120, boeken: 6, sport: 35, overig: 20
};
const STAAT_FACTOR = { nieuw: 1.6, zgan: 1.1, gebruikt: 0.7 };

// Veilig samen betalen: de betaling komt pas vrij als beide GPS-posities bij
// elkaar zijn (fysiek samen bij de overhandiging), binnen deze straal en zo vers.
const SAMEN_METER = 150;
const SAMEN_VERS_MS = 10 * 60 * 1000;

function maakMarkt({ db, save, crypto, anthropic, schoon, notify, notifySupplier, haversine, betaal }) {
  function store() {
    if (!db.data.markt) db.data.markt = { ads: [], chats: {}, geblokkeerd: {}, teller: 0 };
    const m = db.data.markt;
    if (!Array.isArray(m.ads)) m.ads = [];
    if (!m.chats) m.chats = {};
    if (!m.geblokkeerd) m.geblokkeerd = {};
    if (typeof m.teller !== 'number') m.teller = 0;
    return m;
  }
  const rid = () => crypto.randomBytes(5).toString('hex');
  const nu = () => new Date().toISOString();
  const clip = (v, n) => (schoon ? schoon(v, n) : String(v == null ? '' : v).replace(/[<>]/g, '').slice(0, n)).trim();
  // Interne, botsingvrije sleutel per partij (koper/verkoper/melder/blokkade).
  const pk = p => (p && p.soort ? p.soort + '|' + p.id : '');

  /* ---------- veiligheid & respect: ingangscontrole ---------- */
  function keurTekst(titel, beschrijving) {
    const t = (titel + ' ' + beschrijving).toLowerCase();
    for (const v of VERBODEN) if (v.rx.test(t)) return { ok: false, code: 'verboden', waarom: v.waarom };
    if (RESPECTLOOS.test(t)) return { ok: false, code: 'respect' };
    return { ok: true };
  }
  // Oplichting-signalen; geeft een lijst redenen en of de advertentie gemarkeerd moet.
  function scanVeiligheid(ad) {
    const tekst = (ad.titel + ' ' + ad.beschrijving);
    const redenen = [];
    if (SCAM_WOORDEN.test(tekst)) redenen.push('Er wordt om een betaling vooraf of buiten de app gevraagd. Betaal nooit vooruit aan iemand die je niet kent.');
    if (CONTACT_BUITEN.test(ad.beschrijving)) redenen.push('Er staan contactgegevens of een link in de tekst. Houd het gesprek in de app; zo blijf je beschermd.');
    const richt = (RICHTPRIJS[ad.categorie] || 20) * (STAAT_FACTOR[ad.staat] || 1);
    if (ad.prijs > 0 && ad.prijs < richt * 0.2) redenen.push('De prijs is opvallend laag voor deze categorie. Een te mooi aanbod is vaak niet echt; kijk goed uit.');
    return { gemarkeerd: redenen.length > 0, redenen };
  }

  /* ---------- publieke vorm van een advertentie ---------- */
  function pub(ad, kijker) {
    const mijn = kijker && pk(kijker) === pk(ad.verkoper);
    return {
      id: ad.id, titel: ad.titel, beschrijving: ad.beschrijving, prijs: ad.prijs, bieden: !!ad.bieden,
      categorie: ad.categorie, staat: ad.staat, plaats: ad.plaats, levering: ad.levering, fotos: ad.fotos || [],
      status: ad.status, gemarkeerd: !!ad.gemarkeerd, veiligheid: ad.veiligheid || [],
      verkoper: { naam: ad.verkoper.naam, badge: ad.verkoper.badge || null, soort: ad.verkoper.soort },
      at: ad.at, mijn, meldingen: mijn ? (ad.melders || []).length : undefined
    };
  }

  /* ---------- plaatsen ---------- */
  function plaats(data, verkoper) {
    if (!verkoper || !verkoper.id) return { error: 'Log eerst in om iets te plaatsen.', status: 401 };
    if (verkoper.magVerkopen === false) return { error: 'Kinderprofielen kunnen niet verkopen. Vraag de gezinsbeheerder.', status: 403 };
    if (data.akkoord !== true) return { error: 'Bevestig de huisregels om iets te plaatsen.', status: 400 };
    const titel = clip(data.titel, 80);
    const beschrijving = clip(data.beschrijving, 2000);
    if (titel.length < 3) return { error: 'Geef een duidelijke titel (minstens 3 tekens).', status: 400 };
    if (beschrijving.length < 5) return { error: 'Schrijf kort wat je aanbiedt.', status: 400 };
    const keur = keurTekst(titel, beschrijving);
    if (!keur.ok) {
      if (keur.code === 'verboden') return { error: 'Dit soort waar (' + keur.waarom + ') hoort niet op de marktplaats en kan hier niet worden aangeboden.', status: 400 };
      return { error: 'Houd de tekst netjes en respectvol; pas de titel of omschrijving aan.', status: 400 };
    }
    const categorie = CATEGORIEEN.includes(data.categorie) ? data.categorie : 'overig';
    const staat = STATEN.includes(data.staat) ? data.staat : 'gebruikt';
    const prijs = Math.max(0, Math.round(Number(data.prijs) || 0));
    const levering = Array.isArray(data.levering) ? data.levering.filter(l => LEVERING.includes(l)) : ['ophalen'];
    const fotos = (Array.isArray(data.fotos) ? data.fotos : []).filter(f => typeof f === 'string' && f.startsWith('data:image/')).slice(0, 6);
    const m = store();
    const ad = {
      id: rid(), verkoper: { soort: verkoper.soort, id: verkoper.id, naam: clip(verkoper.naam, 40) || 'Verkoper', badge: verkoper.badge || null },
      titel, beschrijving, prijs, bieden: data.bieden === true, categorie, staat,
      plaats: clip(data.plaats, 40), levering: levering.length ? levering : ['ophalen'],
      fotos, status: 'te-koop', melders: [], at: nu()
    };
    const sv = scanVeiligheid(ad);
    ad.gemarkeerd = sv.gemarkeerd; ad.veiligheid = sv.redenen;
    m.ads.unshift(ad);
    m.ads = m.ads.slice(0, 20000);
    save();
    return { ok: true, ad: pub(ad, verkoper), waarschuwing: sv.redenen[0] || null };
  }

  /* ---------- zoeken / lijst ---------- */
  function zichtbaar(ad, kijker) {
    if (ad.verwijderd) return false;
    // te veel meldingen: automatisch verborgen tot beoordeling
    if ((ad.melders || []).length >= 3 && !(kijker && pk(kijker) === pk(ad.verkoper))) return false;
    if (kijker) {
      const blok = store().geblokkeerd[pk(kijker)] || [];
      if (blok.includes(pk(ad.verkoper))) return false;
    }
    return true;
  }
  function lijst(opt = {}, kijker) {
    const m = store();
    const q = String(opt.q || '').toLowerCase().trim();
    const cat = CATEGORIEEN.includes(opt.categorie) ? opt.categorie : null;
    const min = opt.min != null ? Number(opt.min) : null;
    const max = opt.max != null ? Number(opt.max) : null;
    const plaats = String(opt.plaats || '').toLowerCase().trim();
    let res = m.ads.filter(a => a.status !== 'verkocht' && zichtbaar(a, kijker));
    if (cat) res = res.filter(a => a.categorie === cat);
    if (q) res = res.filter(a => (a.titel + ' ' + a.beschrijving).toLowerCase().includes(q));
    if (plaats) res = res.filter(a => (a.plaats || '').toLowerCase().includes(plaats));
    if (min != null && !isNaN(min)) res = res.filter(a => a.prijs >= min);
    if (max != null && !isNaN(max)) res = res.filter(a => a.prijs <= max);
    const totaal = res.length;
    const page = Math.max(1, Number(opt.page) || 1);
    const per = Math.min(60, Math.max(1, Number(opt.per) || 30));
    return { ads: res.slice((page - 1) * per, page * per).map(a => pub(a, kijker)), totaal, page, per, categorieen: CATEGORIEEN };
  }
  function vind(id) { return store().ads.find(a => a.id === id && !a.verwijderd) || null; }
  function detail(id, kijker) {
    const ad = vind(id);
    if (!ad || !zichtbaar(ad, kijker)) return null;
    return pub(ad, kijker);
  }
  function mijn(verkoper) {
    return store().ads.filter(a => !a.verwijderd && pk(a.verkoper) === pk(verkoper)).map(a => pub(a, verkoper));
  }

  /* ---------- beheer van je eigen advertentie ---------- */
  function magEigen(id, verkoper) {
    const ad = vind(id);
    if (!ad) return { error: 'Advertentie niet gevonden.', status: 404 };
    if (pk(ad.verkoper) !== pk(verkoper)) return { error: 'Dit is jouw advertentie niet.', status: 403 };
    return { ad };
  }
  function zetStatus(id, verkoper, status) {
    const r = magEigen(id, verkoper); if (r.error) return r;
    if (!['te-koop', 'gereserveerd', 'verkocht'].includes(status)) return { error: 'Onbekende status.', status: 400 };
    r.ad.status = status; save();
    return { ok: true, ad: pub(r.ad, verkoper) };
  }
  function verwijder(id, verkoper) {
    const r = magEigen(id, verkoper); if (r.error) return r;
    r.ad.verwijderd = true; save();
    return { ok: true };
  }

  /* De handel (chat + veilige deal) en het toezicht (melden/blokkeren + AI)
     draaien als submodules op een gedeelde context, een keer opgebouwd bij
     het opstarten. */
  const ctx = { db, save, crypto, anthropic, schoon, notify, notifySupplier, haversine, betaal,
    CATEGORIEEN, STATEN, LEVERING, RESPECTLOOS, VERBODEN, SCAM_WOORDEN, CONTACT_BUITEN,
    RICHTPRIJS, STAAT_FACTOR, SAMEN_METER, SAMEN_VERS_MS,
    store, rid, nu, clip, pk, keurTekst, scanVeiligheid, pub, zichtbaar, vind };
  const { reageer, antwoord, postvak, chatOpen, chatPub, dealVoorstel, dealHier, dealBetaal } = require('./markt/handel')(ctx);
  const { meld, blokkeer, deblokkeer, aiHelp } = require('./markt/toezicht')(ctx);

  return {
    CATEGORIEEN, STATEN, LEVERING,
    plaats, lijst, detail, vind, mijn, zetStatus, verwijder,
    reageer, antwoord, postvak, chatOpen, chatPub,
    dealVoorstel, dealHier, dealBetaal,
    meld, blokkeer, deblokkeer, aiHelp,
    // hulp voor routes/tests
    _pk: pk
  };
}

module.exports = { maakMarkt };
