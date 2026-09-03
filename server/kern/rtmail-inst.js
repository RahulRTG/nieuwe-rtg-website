/* ============================================================================
   RTMAIL: DE INSTELLINGEN VAN EEN POSTVAK.

   Handtekening, afwezigheidsbericht en aliassen. Losgemaakt van ./rtmail-schrijf.js,
   dat over CONCEPTEN gaat -- iets schrijven, bewaren, plannen, versturen. Dit gaat
   over hoe een postvak zich gedraagt, ongeacht of er iemand aan het schrijven is.

   DE LUS-REM ZIT HIER, en dat is het stuk dat de aandacht verdient. Een
   afwezigheidsbericht dat op elk binnenkomend bericht antwoordt, antwoordt ook op
   het afwezigheidsbericht van de ander -- en dan schrijven twee postvakken elkaar
   de nacht door vol. afwezigAntwoord() weigert daarom in vier gevallen: geen
   afwezigheid, buiten het venster, de afzender is het systeem, of deze afzender
   kreeg in dit venster al een antwoord.
   ========================================================================== */
const adresLaag = require('./rtmail-adres');
/* Vijf aliassen per postvak. Meer maakt onnavolgbaar wie er eigenlijk schrijft --
   en dat is bij post geen smaakkwestie. */
const MAX_ALIASSEN = 5;

module.exports = ({ save, rtmail, vrij, nu, busVan, vakInst, kap }) => {
  function instellingen(adres) {
    const i = vakInst(adres, false);
    return { handtekening: i.handtekening || '', afwezig: i.afwezig || null, aliassen: i.aliassen || [] };
  }
  function zetHandtekening(adres, tekst) {
    const i = vakInst(adres, true);
    if (!i) return { error: 'Dit postvak is niet te bepalen.' };
    i.handtekening = kap(tekst, 500);
    save();
    return { ok: true, handtekening: i.handtekening };
  }
  /* Afwezigheid: tekst plus een venster. Zonder tot-datum staat hij aan tot
     iemand hem uitzet -- dat is een keuze en geen omissie, want een
     afwezigheidsbericht dat vanzelf verloopt terwijl u nog weg bent, is erger. */
  /* KEUREN VOOR VERWERVEN, en dat is de reparatie van 2 september 2026. Hier
     stond `vakInst(adres, true)` op de eerste regel, en die tweede parameter
     betekent MAKEN: een postvak dat nog nooit een instelling had, kreeg er een
     -- ook als het verzoek daarna met een 400 werd afgewezen omdat de tekst
     leeg was of de datum nergens op sloeg. De staatproef ving dat als een
     gezakte ROLLBACK ("geweigerd (status 400) en de toestand veranderde toch:
     rtmailSchrijf").

     Het uitzetten hoeft ook niets te maken: is er geen postvakinstelling, dan
     is er geen afwezigheidsbericht om weg te halen, en dan is het antwoord
     hetzelfde zonder dat er iets ontstaat. */
  function zetAfwezig(adres, { aan, tekst, van, tot } = {}) {
    if (!vakInst(adres, false)) return { error: 'Dit postvak is niet te bepalen.' };
    if (aan === false) {
      const bestaand = vakInst(adres, false);
      if (bestaand && bestaand.afwezig) { vakInst(adres, true).afwezig = null; save(); }
      return { ok: true, afwezig: null };
    }
    const t = kap(tekst, 1000).trim();
    if (!t) return { error: 'Wat moet er in het afwezigheidsbericht staan?' };
    const dat = (x) => { if (!x) return null; const d = new Date(x); return isNaN(d.getTime()) ? undefined : d.toISOString(); };
    const v = dat(van), o = dat(tot);
    if (v === undefined || o === undefined) return { error: 'Dat is geen tijdstip.' };
    if (v && o && v > o) return { error: 'De einddatum ligt voor de begindatum.' };
    /* Vanaf hier kan er niets meer worden geweigerd. */
    const i = vakInst(adres, true);
    i.afwezig = { tekst: t, van: v, tot: o };
    i.beantwoord = {};   // een nieuw venster begint met een schone lei
    save();
    return { ok: true, afwezig: i.afwezig };
  }
  function zetAlias(adres, naam, aan) {
    const i = vakInst(adres, true);
    if (!i) return { error: 'Dit postvak is niet te bepalen.' };
    const lokaal = adresLaag.lokaalVan(naam);
    if (!lokaal) return { error: 'Dit adres kan niet.' };
    if (adresLaag.GERESERVEERD.includes(lokaal)) return { error: 'Deze naam houdt het huis zelf.' };
    i.aliassen = (i.aliassen || []).filter(a => a !== lokaal);
    if (aan !== false) {
      if (i.aliassen.length >= MAX_ALIASSEN) return { error: 'Meer dan ' + MAX_ALIASSEN + ' aliassen maakt een postvak onnavolgbaar.' };
      // een alias mag NOOIT het postvak van een ander opvangen
      const bezet = vrij ? vrij.bezet(lokaal, adresLaag.adresVoor('rtg', lokaal)) : null;
      if (bezet) return { error: bezet };
      i.aliassen.push(lokaal);
    }
    save();
    return { ok: true, aliassen: i.aliassen };
  }

  /* Het afwezigheidsantwoord. Draait bij BEZORGING (kern/rtmail-regels.js roept
     hem aan) en weigert in vier gevallen: geen afwezigheid, buiten het venster,
     afzender is het systeem, of deze afzender kreeg dit venster al een antwoord.
     Die laatste is de lus-rem. */
  function afwezigAntwoord(naarAdres, bericht) {
    const i = vakInst(naarAdres, false);
    const a = i && i.afwezig;
    if (!a) return null;
    const t = nu();
    if (a.van && t < a.van) return null;
    if (a.tot && t > a.tot) return null;
    if (!bericht || !bericht.van) return null;
    if (bericht.van === rtmail.SYSTEEM) return null;
    if (bericht.soort === 'afwezig') return null;
    const echt = vakInst(naarAdres, true);
    if (!echt.beantwoord) echt.beantwoord = {};
    const sleutel = busVan(bericht.van) || bericht.van;
    if (echt.beantwoord[sleutel]) return null;
    echt.beantwoord[sleutel] = t;
    const m = rtmail.stuur({ van: naarAdres, naar: bericht.van, onderwerp: 'Afwezig: ' + (bericht.onderwerp || ''),
      tekst: a.tekst, soort: 'afwezig', bron: 'lid' });
    save();
    return m && m.id ? m : null;
  }

  return { instellingen, zetHandtekening, zetAfwezig, zetAlias, afwezigAntwoord };
};
