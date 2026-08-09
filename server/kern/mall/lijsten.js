/* RTG Mall, deelbestand "lijsten": BEWAREN EN EEN REIS BOUWEN.

   Twee dingen die als aparte functies waren bedacht en er eigenlijk een zijn:

     "Bewaar dit voor later"   een verlanglijst, een boodschappenlijst, een lijst
                               "nieuw huis" -- alles wat je in de Mall tegenkomt
     "Voeg toe aan mijn reis"  hotel, scooter, restaurant en catamaran bij elkaar,
                               zodat je je vakantie letterlijk in de Mall bouwt

   Het verschil zit niet in de machinerie maar in twee velden: een lijst met
   `soort: 'reis'` draagt een plek en een periode, en kan daarmee zeggen wat er
   in zijn reis nog ONTBREEKT. Voor de rest is het dezelfde lijst. Twee
   afzonderlijke systemen bouwen zou twee keer hetzelfde bewaren, en dat is
   precies waar LAT-regel 4 over gaat.

   WAT DIT NIET IS: een winkelmand die afrekent. In de Mall wordt niets
   afgerekend -- boeken en kopen gebeurt in het domein zelf, met zijn eigen
   bevestiging en zijn eigen betaalregels. Een reis met een hotel, een scooter
   en een tafel bestaat uit drie handelingen bij drie partijen, en doen alsof
   dat een knop is, is de klant iets beloven wat er niet is. De lijst brengt ze
   bij elkaar en wijst per regel de weg.

   EEN REGEL DIE VERDWIJNT, VERDWIJNT NIET STIL. Een bewaard aanbod kan weg
   zijn: het artikel is uitverkocht, de zaak is gestopt, de reis is vol. Zo'n
   regel blijft in de lijst staan met `vervallen: true` en de reden erbij, want
   stilweg verdwijnen laat iemand zoeken naar iets wat hij zeker weet dat hij
   had bewaard. */

const SOORTEN = ['lijst', 'reis'];
const MAX_LIJSTEN = 40;
const MAX_REGELS = 200;

/* Wat een reis compleet maakt. Bewust kort en bewust niet dwingend: dit is een
   geheugensteun, geen verkoopmachine. Er staat nadrukkelijk GEEN urgentie bij
   ("nog 2 kamers!") -- dat is precies het patroon dat CLAUDE.md verbiedt. */
const REIS_ONDERDELEN = [
  { id: 'verblijf', label: 'Verblijf', typen: ['verblijf'] },
  { id: 'vervoer', label: 'Vervoer ter plaatse', typen: ['vervoer', 'huur'] },
  { id: 'eten', label: 'Tafel', typen: ['eten'] },
  { id: 'beleven', label: 'Iets te doen', typen: ['ticket', 'dienst'] }
];

module.exports = (ctx) => {
  const { db, save, crypto } = ctx;
  const nu = () => new Date().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

  function bak(key) {
    if (!db.data.mallLijsten) db.data.mallLijsten = {};
    if (!Array.isArray(db.data.mallLijsten[key])) db.data.mallLijsten[key] = [];
    return db.data.mallLijsten[key];
  }
  const vind = (key, id) => bak(key).find(l => l.id === String(id || ''));

  function maak(key, data) {
    data = data || {};
    const lijsten = bak(key);
    if (lijsten.length >= MAX_LIJSTEN) return { status: 409, error: 'U heeft het maximum van ' + MAX_LIJSTEN + ' lijsten bereikt.' };
    const naam = schoon(data.naam, 60);
    if (!naam) return { status: 400, error: 'Geef de lijst een naam.' };
    const soort = SOORTEN.includes(data.soort) ? data.soort : 'lijst';
    const lijst = {
      id: crypto.randomBytes(4).toString('hex'), naam, soort,
      plek: soort === 'reis' ? schoon(data.plek, 40) || null : null,
      van: soort === 'reis' && isDatum(data.van) ? data.van : null,
      tot: soort === 'reis' && isDatum(data.tot) ? data.tot : null,
      regels: [], at: nu()
    };
    lijsten.unshift(lijst);
    save();
    return { ok: true, lijst };
  }

  function zet(key, id, data) {
    const l = vind(key, id);
    if (!l) return { status: 404, error: 'Lijst niet gevonden.' };
    data = data || {};
    if (data.naam != null) { const n = schoon(data.naam, 60); if (n) l.naam = n; }
    if (l.soort === 'reis') {
      if (data.plek != null) l.plek = schoon(data.plek, 40) || null;
      if (data.van != null) l.van = isDatum(data.van) ? data.van : null;
      if (data.tot != null) l.tot = isDatum(data.tot) ? data.tot : null;
    }
    save();
    return { ok: true, lijst: l };
  }

  function weg(key, id) {
    const lijsten = bak(key);
    const i = lijsten.findIndex(l => l.id === String(id || ''));
    if (i < 0) return { status: 404, error: 'Lijst niet gevonden.' };
    lijsten.splice(i, 1);
    save();
    return { ok: true, aantal: lijsten.length };
  }

  /* Een aanbod bewaren. De TITEL en de PRIJS gaan mee de regel in, en niet
     alleen het id: staat het aanbod er over een maand niet meer, dan kan de
     lijst nog steeds zeggen WAT je had bewaard in plaats van een lege regel te
     tonen. Het levende aanbod wint bij het tonen; dit is het geheugen. */
  function voegToe(key, id, aanbodId) {
    const l = vind(key, id);
    if (!l) return { status: 404, error: 'Lijst niet gevonden.' };
    if (l.regels.length >= MAX_REGELS) return { status: 409, error: 'Deze lijst zit vol (' + MAX_REGELS + ' regels).' };
    const gezocht = String(aanbodId || '');
    const a = ctx.aanbodAlles().aanbod.find(x => x.id === gezocht);
    if (!a) return { status: 404, error: 'Dit aanbod bestaat niet (meer) in de Mall.' };
    if (l.regels.some(r => r.aanbodId === a.id)) return { status: 409, error: 'Dit staat al in ' + l.naam + '.' };
    l.regels.unshift({
      aanbodId: a.id, titel: a.titel, type: a.type, aanbieder: a.aanbieder.naam,
      prijsBijBewaren: a.prijs ? a.prijs.bedrag : null, plek: a.plek.stad || null, at: nu()
    });
    save();
    return { ok: true, lijst: l.id, aantal: l.regels.length };
  }

  function haalWeg(key, id, aanbodId) {
    const l = vind(key, id);
    if (!l) return { status: 404, error: 'Lijst niet gevonden.' };
    const i = l.regels.findIndex(r => r.aanbodId === String(aanbodId || ''));
    if (i < 0) return { status: 404, error: 'Deze regel staat niet in de lijst.' };
    l.regels.splice(i, 1);
    save();
    return { ok: true, aantal: l.regels.length };
  }

  /* De lijst zoals het lid hem ziet: elke regel gekoppeld aan het LEVENDE
     aanbod. Wat er niet meer is, vervalt zichtbaar; wat duurder of goedkoper
     is geworden krijgt het verschil erbij, want dat is de reden dat je iets
     bewaart. */
  function toon(key, id) {
    const l = vind(key, id);
    if (!l) return { status: 404, error: 'Lijst niet gevonden.' };
    const levend = new Map(ctx.aanbodAlles().aanbod.map(a => [a.id, a]));
    const regels = l.regels.map(r => {
      const a = levend.get(r.aanbodId);
      if (!a) return { ...r, vervallen: true, reden: 'Dit aanbod staat niet meer in de Mall.' };
      const nuPrijs = a.prijs ? a.prijs.bedrag : null;
      const verschil = (r.prijsBijBewaren != null && nuPrijs != null && nuPrijs !== r.prijsBijBewaren)
        ? Math.round((nuPrijs - r.prijsBijBewaren) * 100) / 100 : null;
      return { ...r, vervallen: false, aanbod: a, prijsVerschil: verschil };
    });
    const uit = { ok: true, lijst: { ...l, regels }, aantal: regels.length,
      vervallen: regels.filter(r => r.vervallen).length };
    if (l.soort === 'reis') uit.reis = reisbeeld(l, regels);
    return uit;
  }

  /* Wat er in een reis nog ontbreekt. Een geheugensteun met vier vakjes, geen
     verkoopmotor: er staat wat er staat en wat er niet staat, zonder aandrang
     en zonder aanbevelingen die toevallig het duurst zijn. */
  function reisbeeld(l, regels) {
    const aanwezig = new Set(regels.filter(r => !r.vervallen).map(r => r.type));
    return {
      plek: l.plek, van: l.van, tot: l.tot,
      onderdelen: REIS_ONDERDELEN.map(o => ({
        id: o.id, label: o.label,
        heeft: o.typen.some(t => aanwezig.has(t))
      })),
      opmerking: 'Een reis boek je niet in een keer: elke regel gaat naar de partij die hem levert, met zijn eigen bevestiging.'
    };
  }

  // alle lijsten van dit lid, kort (zonder de regels uit te werken)
  function mijn(key) {
    return {
      ok: true,
      lijsten: bak(key).map(l => ({ id: l.id, naam: l.naam, soort: l.soort, plek: l.plek,
        van: l.van, tot: l.tot, aantal: l.regels.length, at: l.at })),
      max: MAX_LIJSTEN
    };
  }

  const api = { mijn, maak, zet, weg, voegToe, haalWeg, toon, REIS_ONDERDELEN, MAX_LIJSTEN };
  ctx.lijsten = api;
  return { mallLijsten: api };
};

module.exports.REIS_ONDERDELEN = REIS_ONDERDELEN;
module.exports.SOORTEN = SOORTEN;
module.exports.MAX_LIJSTEN = MAX_LIJSTEN;
