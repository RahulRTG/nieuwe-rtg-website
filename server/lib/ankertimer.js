/* ============================================================================
   HET PERIODIEKE ANKER -- de kop van het auditspoor verlaat het huis uit
   zichzelf (audit A-P1-05).

   WAAROM. De ankerpost bracht het blok alleen weg als een kantoormens op de knop
   drukte. Een kopafknipping van het spoor is dus pas zichtbaar als iemand
   eraan dacht te ankeren, en dat is niet een bewijs maar een gewoonte. Deze
   timer roept dezelfde `ankerpost.post()` periodiek aan: het blok gaat naar de
   tweede machine buiten de primaire opslag (zie ankerpost.js punt 1-5 voor wat
   dat wel en niet bewijst).

   ELKE RONDE VERGELIJKT EERST (audit P1-3b): het laatst weggebrachte blok gaat
   terug naar de ankerdienst voordat er een nieuw blok weggaat; zie eenRonde().

   WAT HIJ NIET DOET. Hij start niet zonder geldige bestemming (geen
   RTG_ANKERPOST_URL = niet in bedrijf, en dat blijft zo klinken), hij blokkeert
   het opstarten nooit, en een mislukte ronde is een STAND (`laatste.ok=false`
   met reden) en nooit stilte. `stand()` zegt ook hoe oud de laatste geslaagde
   ronde is, zodat "ooit eens gelukt" niet voor "vers" doorgaat.
   Interval: RTG_ANKERPOST_MINUTEN (standaard 15, minimaal 1).
   ========================================================================== */
'use strict';

const klok = require('./klok');

const staat = { laatste: null, laatsteGeslaagd: null, laatsteVergeleken: null, laatsteAfwijking: null,
  rondes: 0, minuten: null, actief: false };

/* EERST VERGELIJKEN, DAN WEGBRENGEN (audit P1-3b). Hier stond alleen
   `ankerpost.post()`: de kop ging elke ronde naar buiten, maar niemand legde
   het vorige blok ooit naast het journaal -- dat gebeurde alleen als een
   kantoormens op de rekenknop drukte. Een afgeknipt of volledig herberekend
   spoor viel dus pas op als iemand eraan dacht. Nu:
     1. het laatst weggebrachte blok terughalen en afrekenen (ankerpost.afrekenen
        -> ankerdienst.reken, inclusief de handtekening);
     2. klopt het niet, dan gaat het ALARM af (lib/auditwacht.js) en wordt er
        NIETS weggebracht: een nieuw blok over een vervalst journaal zou het
        bewijs van de vervalsing op de tweede machine overschrijven;
     3. kon er niet vergeleken worden (tweede machine onbereikbaar, onleesbaar
        antwoord), dan ook geen nieuw blok en een alarm "niet meer verankerd" --
        een anker dat niet gelezen kan worden, ankert niets;
     4. alleen "er ligt nog geen blok" (404 bij de eerste ronde) is geen
        bevinding.
   Pas als de vergelijking klopt of er nog niets lag, gaat het nieuwe blok weg. */
function auditwacht() { return require('./auditwacht'); }

function beschrijf(uit) {
  if (uit.reden) return uit.reden;
  const fout = Object.entries(uit.perJournaal || {}).filter(([, v]) => v && !v.ok)
    .map(([k, v]) => k + ': ' + (v.reden || 'klopt niet'));
  return fout.length ? fout.join('; ') : 'het blok rekent niet af';
}

async function eenRonde(ankerpost, log) {
  staat.rondes++;
  const at = () => new Date(klok.nu()).toISOString();
  let vergelijk;
  try {
    vergelijk = typeof ankerpost.afrekenen === 'function' ? await ankerpost.afrekenen()
      : { afgerekend: false, ok: false, inBedrijf: true, reden: 'deze ankerpost kan niet afrekenen' };
  } catch (e) { vergelijk = { afgerekend: false, ok: false, inBedrijf: true, reden: 'het afrekenen gooide: ' + (e && e.message || e) }; }

  if (vergelijk.inBedrijf === false) {
    staat.laatste = { at: at(), ok: false, inBedrijf: false, vergeleken: false, reden: vergelijk.reden || 'niet in bedrijf' };
    return staat.laatste;
  }
  const nogGeenBlok = !vergelijk.afgerekend && vergelijk.status === 404;
  if (vergelijk.afgerekend && !vergelijk.ok) {
    const reden = 'het externe anker klopt niet met het journaal: ' + beschrijf(vergelijk);
    auditwacht().meld('anker', reden, 'ankertimer');
    staat.laatste = { at: at(), ok: false, inBedrijf: true, vergeleken: true, afwijking: true, reden };
    staat.laatsteAfwijking = staat.laatste.at;
    if (log && log.error) log.error('[anker] ' + reden); else if (log && log.warn) log.warn('[anker] ' + reden);
    return staat.laatste;
  }
  if (!vergelijk.afgerekend && !nogGeenBlok) {
    const reden = 'het externe anker kon niet worden vergeleken: ' + (vergelijk.reden || 'onbekend');
    auditwacht().meld('anker', reden, 'ankertimer');
    staat.laatste = { at: at(), ok: false, inBedrijf: true, vergeleken: false, reden };
    if (log && log.warn) log.warn('[anker] ' + reden);
    return staat.laatste;
  }
  if (vergelijk.afgerekend) { staat.laatsteVergeleken = at(); auditwacht().wis('anker'); }

  let uit;
  try { uit = await ankerpost.post(); }
  catch (e) { uit = { ok: false, reden: 'de ankerpost gooide: ' + (e && e.message || e) }; }
  staat.laatste = { at: at(), ok: !!uit.ok, inBedrijf: uit.inBedrijf !== false, vergeleken: !!vergelijk.afgerekend,
    reden: uit.ok ? null : (uit.reden || 'onbekend') };
  if (uit.ok) staat.laatsteGeslaagd = staat.laatste.at;
  else if (log && log.warn) log.warn('[anker] periodieke post mislukt: ' + staat.laatste.reden);
  return staat.laatste;
}

function start({ ankerpost, log, omgeving, zet } = {}) {
  const env = omgeving || process.env;
  if (!env.RTG_ANKERPOST_URL) return { gestart: false, reden: 'geen RTG_ANKERPOST_URL; niet in bedrijf' };
  const minuten = Math.max(1, Number(env.RTG_ANKERPOST_MINUTEN || 15) || 15);
  staat.minuten = minuten; staat.actief = true;
  const t = (zet || setInterval)(() => { eenRonde(ankerpost, log); }, minuten * 60 * 1000);
  if (t && t.unref) t.unref();
  /* De eerste vergelijking kort na het opstarten, niet pas na een heel interval:
     een vervalsing terwijl het proces plat lag, hoort bij de start op te vallen. */
  if (!zet) { const e = setTimeout(() => { eenRonde(ankerpost, log); }, 30 * 1000); if (e.unref) e.unref(); }
  return { gestart: true, minuten };
}

function stand() {
  const oud = staat.laatsteGeslaagd ? Math.round((klok.nu() - new Date(staat.laatsteGeslaagd).getTime()) / 60000) : null;
  return Object.assign({}, staat, { minutenSindsGeslaagd: oud,
    verouderd: staat.actief && staat.minuten ? (oud === null || oud > staat.minuten * 3) : null });
}

module.exports = { start, eenRonde, stand };
