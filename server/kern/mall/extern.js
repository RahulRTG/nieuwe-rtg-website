/* RTG Mall, deelbestand "extern": EEN KASSASYSTEEM VAN BUITEN.

   De Mall-koppeling werkt tot nu toe omdat alles in een database staat: de
   ondernemer verandert een prijs in zijn RTG-scherm en de Mall leest dezelfde
   rij. Een partner met een EIGEN kassa- of boekingssysteem heeft die weg niet.
   Dit bestand is die weg, en niet meer dan dat.

   TWEE DINGEN MOGEN NAAR BINNEN, en met opzet niet meer:
     - voorraad per artikel (sku of id -> aantal)
     - open/dicht, als de zaak dat zelf wil melden
   Geen prijzen, geen artikelen, geen teksten. Wie zijn assortiment bij RTG wil
   voeren, doet dat in het leveranciersscherm; een kassakoppeling die stilletjes
   productnamen en prijzen kan overschrijven is een veel groter ding dan een
   voorraadstand, met een eigen gesprek over wie wat mag.

   DE HOUDBAARHEID IS DE HELE TRUC. Een kassasysteem dat stopt met melden is
   niet te onderscheiden van een kassasysteem dat "alles nog steeds op voorraad"
   bedoelt -- behalve door de tijd. Een melding is daarom VERS gedurende
   VERS_MIN minuten; daarna telt hij niet meer mee en valt de Mall terug op wat
   zij zelf weet. Zo kan een kapotte koppeling nooit een winkel dagenlang open
   en gevuld houden. Dat is dezelfde gedachte als LAT-regel 3: een bron die
   wegvalt hoort te zakken, niet stil door te gaan.

   WIE WINT. De zaak zelf. Zet de ondernemer zijn zaak in RTG op "neemt geen
   reserveringen aan", dan telt dat zwaarder dan wat het kassasysteem meldt --
   een schakelaar die je omzet en die niets doet is erger dan geen schakelaar.
   Voorraad werkt andersom: daar is het externe getal juist het meest actuele,
   want daar loopt de verkoop. */

const VERS_MIN = 30;                 // zolang telt een melding als actueel
const MAX_REGELS = 2000;             // per zaak, tegen een kassa die alles stuurt

module.exports = (ctx) => {
  const { db, save } = ctx;

  function bak(s) {
    if (!s.mall) s.mall = {};
    if (!s.mall.extern) s.mall.extern = { bron: null, at: null, open: null, voorraad: {} };
    return s.mall.extern;
  }
  const versGenoeg = (e, nu) => !!(e && e.at && (nu - new Date(e.at).getTime()) <= VERS_MIN * 60000);

  /* De open/dicht-melding van een extern systeem, als die vers is. Geeft null
     zodra hij verlopen is, zodat openNu() gewoon zijn eigen bronnen gebruikt. */
  function openVan(s, wanneer) {
    const e = s && s.mall && s.mall.extern;
    if (!e || typeof e.open !== 'boolean') return null;
    const nu = (wanneer instanceof Date ? wanneer : new Date()).getTime();
    if (!versGenoeg(e, nu)) return null;
    // de eigen schakelaar van de zaak wint van het kassasysteem
    if (e.open && s.settings && s.settings.reservationsOpen === false) return null;
    return {
      open: e.open,
      tekst: e.open ? 'Nu open' : 'Nu gesloten',
      bron: 'extern', systeem: e.bron || null
    };
  }

  /* De voorraad van een artikel volgens het externe systeem, of null. Zoekt op
     sku en op id, want een kassa kent meestal alleen de sku. */
  function voorraadVan(s, artikel) {
    const e = s && s.mall && s.mall.extern;
    if (!e || !e.voorraad) return null;
    if (!versGenoeg(e, Date.now())) return null;
    const sleutels = [artikel && artikel.sku, artikel && artikel.id].filter(Boolean);
    for (const k of sleutels) {
      if (Object.prototype.hasOwnProperty.call(e.voorraad, k)) return Math.max(0, Number(e.voorraad[k]) || 0);
    }
    return null;
  }

  /* Het systeem van de zaak meldt zich. Alleen wat het echt kan weten wordt
     overgenomen; alles wat niet wordt meegestuurd blijft staan zoals het stond
     (een kassa die alleen voorraad kent, hoort niet ongemerkt de deur te
     sluiten). Het antwoord zegt wat er is aangenomen en wat is genegeerd, want
     een koppeling die stil iets weggooit is niet te bouwen tegen. */
  function meld(s, data) {
    data = data || {};
    const e = bak(s);
    const genegeerd = [];
    e.bron = String(data.bron || e.bron || 'onbekend').replace(/[<>]/g, '').trim().slice(0, 60);
    e.at = new Date().toISOString();

    if (typeof data.open === 'boolean') e.open = data.open;
    else if ('open' in data && data.open !== null) genegeerd.push('open (geen ja/nee)');

    let bij = 0;
    if (Array.isArray(data.voorraad)) {
      for (const r of data.voorraad.slice(0, MAX_REGELS)) {
        const sleutel = String((r && (r.sku || r.id)) || '').replace(/[<>]/g, '').trim().slice(0, 60);
        const aantal = Number(r && r.aantal);
        if (!sleutel || !Number.isFinite(aantal)) { genegeerd.push('voorraadregel zonder sku of aantal'); continue; }
        e.voorraad[sleutel] = Math.max(0, Math.round(aantal));
        bij++;
      }
      if (data.voorraad.length > MAX_REGELS) genegeerd.push('meer dan ' + MAX_REGELS + ' voorraadregels');
    }
    // een sleutel die bij geen enkel artikel hoort is een stille misser: melden
    const bekend = new Set();
    for (const a of (s.artikelen || [])) { if (a.sku) bekend.add(a.sku); if (a.id) bekend.add(a.id); }
    const onbekend = Object.keys(e.voorraad).filter(k => bekend.size && !bekend.has(k));
    save();
    return {
      ok: true, aangenomen: { voorraadregels: bij, open: typeof e.open === 'boolean' ? e.open : null },
      versTot: new Date(Date.now() + VERS_MIN * 60000).toISOString(),
      versMinuten: VERS_MIN,
      onbekendeSleutels: onbekend.slice(0, 20),
      genegeerd: [...new Set(genegeerd)].slice(0, 10),
      opmerking: 'Een melding telt ' + VERS_MIN + ' minuten als actueel. Blijft uw systeem daarna stil, dan valt de Mall terug op wat zij zelf weet; een koppeling die uitvalt houdt uw winkel dus niet ten onrechte open.'
    };
  }

  // wat de Mall op dit moment van het externe systeem gebruikt (voor de zaak zelf)
  function stand(s) {
    const e = s && s.mall && s.mall.extern;
    if (!e || !e.at) return { gekoppeld: false, versMinuten: VERS_MIN };
    const vers = versGenoeg(e, Date.now());
    return {
      gekoppeld: true, systeem: e.bron || null, laatst: e.at, vers, versMinuten: VERS_MIN,
      open: typeof e.open === 'boolean' ? e.open : null,
      voorraadregels: Object.keys(e.voorraad || {}).length,
      opmerking: vers ? 'Uw melding telt mee.' : 'Uw laatste melding is verlopen; de Mall gebruikt nu haar eigen gegevens.'
    };
  }

  return { openVan, voorraadVan, meld, stand, VERS_MIN };
};

module.exports.VERS_MIN = VERS_MIN;
