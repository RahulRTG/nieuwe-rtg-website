/* RTMAIL (deelmodule): regels en filters die bij de BEZORGING draaien.

   WAAR DIT DRAAIT, EN WAAROM DAT UITMAAKT. Deze laag hangt aan de haak in
   kern/rtmail.js (`zetNaBezorging`), zodat hij langs ELKE bezorging komt: post
   uit de app, uit een automatisering, uit de werkmail-poort van buiten, en een
   antwoord. Regels die alleen in de app draaien, werken precies niet voor de
   post die 's nachts binnenkomt -- en dat is nu juist de post waarvoor je
   regels maakt.

   WAT EEN REGEL MAG DOEN, en die lijst is met opzet kort:

     opbergen      -> naar het archief
     weggooien     -> naar de prullenbak (een MAP, geen vernietiging)
     etiket        -> een etiket erop
     ster          -> als favoriet markeren
     lezen         -> als gelezen markeren

   WAT EEN REGEL NIET MAG: doorsturen naar een ander adres. Dat klinkt handig en
   is de kortste weg naar twee echte problemen -- post die ongemerkt het huis
   verlaat (een klassieke manier om een gekaapt account leeg te trekken), en een
   lus tussen twee postvakken die elkaar doorsturen. Wie post op twee plekken
   wil zien, gebruikt een team (kern/rtmail-team.js): dat is zichtbaar en
   opzegbaar.

   DE VOORWAARDEN zijn tekstvergelijkingen zonder reguliere expressies. Dat is
   geen luiheid: een door de gebruiker ingevoerde regex is een manier om de
   server te laten vastlopen op een zin die toevallig verkeerd valt. */
const adresLaag = require('./rtmail-adres');

const ACTIES = ['opbergen', 'weggooien', 'etiket', 'ster', 'lezen'];
const VELDEN = ['van', 'onderwerp', 'tekst', 'soort'];
const MAX_REGELS = 30;

module.exports = ({ db, save, crypto, rtmail, vak, schrijf }) => {
  const nu = () => new Date().toISOString();
  const busVan = (adres) => {
    const o = adresLaag.ontleed(adres);
    return o.binnenshuis ? String(o.lokaal || '').replace(/[.-]/g, '') : String(o.adres || '');
  };
  const kap = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n);

  function R() {
    if (!db.data.rtmailRegels || typeof db.data.rtmailRegels !== 'object') db.data.rtmailRegels = { regels: [] };
    const r = db.data.rtmailRegels;
    if (!Array.isArray(r.regels)) r.regels = [];
    return r;
  }
  const mijne = (adres) => R().regels.filter(x => x.bus === busVan(adres));

  const publiek = (r) => ({ id: r.id, naam: r.naam, veld: r.veld, bevat: r.bevat,
    alleenOnvertrouwd: !!r.alleenOnvertrouwd, actie: r.actie, waarde: r.waarde || '',
    aan: r.aan !== false, geraakt: r.geraakt || 0, at: r.at });

  function maak(adres, { naam, veld, bevat, actie, waarde, alleenOnvertrouwd } = {}) {
    const bus = busVan(adres);
    if (!bus) return { error: 'Dit postvak is niet te bepalen.' };
    if (mijne(adres).length >= MAX_REGELS) return { error: 'Meer dan ' + MAX_REGELS + ' regels wordt onnavolgbaar.' };
    const v = String(veld || '').toLowerCase();
    if (!VELDEN.includes(v)) return { error: 'Waarop moet deze regel letten? Kies uit: ' + VELDEN.join(', ') + '.' };
    const b = kap(bevat, 120);
    if (!b && !alleenOnvertrouwd) return { error: 'Waar moet de regel op letten? Geef tekst, of zet hem op alleen onvertrouwde post.' };
    const a = String(actie || '').toLowerCase();
    if (!ACTIES.includes(a)) return { error: 'Deze actie bestaat niet. Kies uit: ' + ACTIES.join(', ') + '.' };
    if (a === 'etiket' && !kap(waarde, 40)) return { error: 'Welk etiket moet erop?' };
    const regel = { id: crypto.randomBytes(5).toString('hex'), bus, naam: kap(naam, 60) || (v + ' bevat ' + b),
      veld: v, bevat: b.toLowerCase(), alleenOnvertrouwd: !!alleenOnvertrouwd,
      actie: a, waarde: kap(waarde, 40), aan: true, geraakt: 0, at: nu() };
    R().regels.push(regel);
    save();
    return { ok: true, regel: publiek(regel) };
  }

  function zet(adres, id, aan) {
    const r = mijne(adres).find(x => x.id === id);
    if (!r) return { error: 'Deze regel bestaat niet in dit postvak.' };
    r.aan = aan !== false;
    save();
    return { ok: true, regel: publiek(r) };
  }
  function weg(adres, id) {
    const alle = R().regels;
    const i = alle.findIndex(x => x.id === id && x.bus === busVan(adres));
    if (i < 0) return { error: 'Deze regel bestaat niet in dit postvak.' };
    alle.splice(i, 1);
    save();
    return { ok: true, id };
  }
  const lijst = (adres) => mijne(adres).map(publiek);

  /* Toepassen op EEN bezorgd bericht, in de volgorde waarin de regels gemaakt
     zijn. Elke regel die raak is, wordt UITGEVOERD en GETELD -- die teller is
     het enige eerlijke antwoord op "doet mijn regel eigenlijk iets?". */
  function toepassen(m) {
    if (!m || !m.naar) return [];
    const adres = m.naar;
    const gedaan = [];
    const veldWaarde = { van: m.van, onderwerp: m.onderwerp, tekst: m.tekst, soort: m.soort };
    for (const r of mijne(adres)) {
      if (r.aan === false) continue;
      if (r.alleenOnvertrouwd && m.vertrouwd) continue;
      if (r.bevat && !String(veldWaarde[r.veld] || '').toLowerCase().includes(r.bevat)) continue;
      let uit = null;
      if (r.actie === 'opbergen') uit = vak.verplaats(adres, m.id, 'archief');
      else if (r.actie === 'weggooien') uit = vak.verplaats(adres, m.id, 'prullenbak');
      else if (r.actie === 'etiket') uit = vak.etiket(adres, m.id, r.waarde, true);
      else if (r.actie === 'ster') uit = vak.ster(adres, m.id, true);
      else if (r.actie === 'lezen') { m.gelezen = true; uit = { ok: true }; }
      if (uit && uit.ok) { r.geraakt = (r.geraakt || 0) + 1; gedaan.push({ regel: r.id, actie: r.actie }); }
    }
    if (gedaan.length) save();
    return gedaan;
  }

  /* De haak die kern/rtmail.js aanroept na elke bezorging: eerst de regels van
     de ontvanger, dan zijn afwezigheidsbericht. In die volgorde, want een
     bericht dat de regel al naar de prullenbak stuurde, verdient nog steeds een
     afwezigheidsantwoord -- de afzender weet immers niet dat u een regel heeft. */
  function naBezorging(m) {
    toepassen(m);
    if (schrijf && schrijf.afwezigAntwoord) schrijf.afwezigAntwoord(m.naar, m);
  }

  return { ACTIES, VELDEN, maak, zet, weg, lijst, toepassen, naBezorging };
};
