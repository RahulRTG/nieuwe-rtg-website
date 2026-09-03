/* ============================================================================
   DE ANKERPOST -- de bestemming van het ankerblok, en de weg ernaartoe.

   HET BESLUIT (3 september 2026, eigenaar). ./ankerdienst.js maakt het blok dat
   naar buiten moet en zegt er met zoveel woorden bij dat hij NIET bepaalt waar
   het heen gaat: "de bestemming is een besluit over de infrastructuur -- een
   tweede machine, een andere partij, een uitdraai in een kluis -- en dat besluit
   hoort bij een mens." Dat besluit is genomen: EEN TWEEDE MACHINE BINNEN RTG.

   Deze module is dat besluit in code. Hij is met opzet dun: hij brengt het blok
   weg en haalt het laatst weggebrachte terug. Rekenen blijft bij de ankerdienst.

   ================== VIJF DINGEN DIE HIER VASTLIGGEN ==================

   1. DEZELFDE SCHIJF IS GEEN BESTEMMING. Een anker dat deze software zelf naast
      de journalen wegschrijft, is geen anker maar een tweede regel om te
      wijzigen -- dezelfde hand, dezelfde nacht. Daarom weigert `post()` een
      bestemming die geen netwerkadres is (`file:`, een pad, `localhost`), en
      zegt hij waarom in plaats van stil door te gaan.

   2. GEEN BESTEMMING IS NIET IN BEDRIJF, en dat blijft zo klinken. Zonder
      RTG_ANKERPOST_URL doet deze laag niets, meldt hij `inBedrijf: false` met de
      reden, en blijft de stand van de ankerdienst ongewijzigd staan op wat zij
      al zei. Fail-closed: de post maakt nooit van "niet gemeten" een "in orde".

   3. DE POST STUURT ALLEEN VOORUIT. Hij kent één werkwoord richting de tweede
      machine -- bijschrijven -- en geen wissen, geen overschrijven, geen
      opvragen-en-herstellen. Kan een aanvaller aan deze kant iets weghalen aan
      de andere kant, dan is het anker een sier.

   4. WAT TERUGKOMT IS INVOER EN GEEN WAARHEID. Een teruggehaald blok gaat
      ongewijzigd naar `ankerdienst.reken()` als `eerder`, en raakt nooit een
      journaal aan. Kwam er iets terug dat niet op een blok lijkt, dan is dat
      een BEVINDING (de tweede machine praat anders dan verwacht) en geen reden
      om lokaal iets te repareren.

   5. WAT DIT NIET BEWIJST, en dat staat hier even groot bij. Een tweede machine
      BINNEN RTG beschermt tegen één hand, één inbraak, één beheerder die zijn
      bezoek uitwist. Hij beschermt niet tegen RTG als geheel: wie beide machines
      bestuurt, kan beide koppen afknippen. Voor dat laatste is een partij buiten
      dit huis nodig, en dat is een tweede besluit dat niet is genomen. Deze
      module doet daarom nooit alsof: `stand()` noemt die grens elke keer mee.
   ========================================================================== */
'use strict';

const klok = require('./klok');

/* Een bestemming die deze regel niet haalt, is er geen. Zie punt 1. */
function keurBestemming(url) {
  if (!url) return { ok: false, reden: 'er is geen RTG_ANKERPOST_URL gezet; de post is niet in bedrijf' };
  let u;
  try { u = new URL(url); } catch { return { ok: false, reden: 'RTG_ANKERPOST_URL is geen adres: ' + url }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:')
    return { ok: false, reden: 'een anker gaat naar een andere MACHINE, niet naar "' + u.protocol + '" -- dezelfde schijf is geen bestemming' };
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host === '127.0.0.1' || host.endsWith('.localhost'))
    return { ok: false, reden: 'de bestemming wijst naar deze machine zelf (' + host + '); dan ankert het blok niets' };
  if (u.protocol === 'http:' && process.env.RTG_ANKERPOST_ONVEILIG !== '1')
    return { ok: false, reden: 'de bestemming is onversleuteld; zet RTG_ANKERPOST_ONVEILIG=1 als dit een gesloten intern netwerk is' };
  return { ok: true, url: u.toString() };
}

function maakAnkerpost({ ankerdienst, nu, haal, omgeving } = {}) {
  const tijd = nu || klok.nu;
  const env = omgeving || process.env;
  const fetchen = haal || globalThis.fetch;

  const instelling = () => ({
    url: env.RTG_ANKERPOST_URL || null,
    sleutel: env.RTG_ANKERPOST_SLEUTEL || null,
    seconden: Number(env.RTG_ANKERPOST_SECONDEN || 10)
  });

  async function spreek(pad, lijf) {
    const inst = instelling();
    const keur = keurBestemming(inst.url);
    if (!keur.ok) return { ok: false, inBedrijf: false, reden: keur.reden };
    if (!fetchen) return { ok: false, inBedrijf: false, reden: 'deze omgeving heeft geen fetch; de post kan niet spreken' };
    const kop = { 'content-type': 'application/json' };
    if (inst.sleutel) kop.authorization = 'Bearer ' + inst.sleutel;
    try {
      const a = await fetchen(new URL(pad, keur.url).toString(), {
        method: lijf ? 'POST' : 'GET', headers: kop,
        body: lijf ? JSON.stringify(lijf) : undefined,
        signal: AbortSignal.timeout(Math.max(1, inst.seconden) * 1000)
      });
      const tekst = await a.text();
      let json = null;
      try { json = tekst ? JSON.parse(tekst) : null; } catch { /* zie punt 4 */ }
      if (!a.ok) return { ok: false, inBedrijf: true, status: a.status, reden: 'de tweede machine antwoordde ' + a.status, antwoord: json };
      if (!json) return { ok: false, inBedrijf: true, reden: 'de tweede machine antwoordde geen leesbaar blok', ruw: tekst.slice(0, 200) };
      return { ok: true, inBedrijf: true, antwoord: json };
    } catch (e) {
      return { ok: false, inBedrijf: true, reden: 'de tweede machine was niet te bereiken: ' + (e && e.message || e) };
    }
  }

  /* Het blok van NU wegbrengen. Alleen bijschrijven (punt 3). */
  async function post() {
    const blok = ankerdienst.blok();
    const uit = await spreek('anker', { blok, at: new Date(tijd()).toISOString() });
    return Object.assign({ blok }, uit);
  }

  /* Het laatst weggebrachte blok terughalen en ermee afrekenen. Het blok is
     INVOER (punt 4): het gaat ongewijzigd naar de ankerdienst. */
  async function afrekenen() {
    const uit = await spreek('anker/laatste', null);
    if (!uit.ok) return Object.assign({ afgerekend: false }, uit);
    const eerder = uit.antwoord && (uit.antwoord.blok || uit.antwoord);
    if (!eerder || !eerder.punten)
      return { afgerekend: false, inBedrijf: true, ok: false,
        reden: 'wat terugkwam is geen ankerblok; de tweede machine praat anders dan verwacht' };
    return Object.assign({ afgerekend: true, inBedrijf: true }, ankerdienst.reken(eerder));
  }

  /* De stand van de POST, met de grens er elke keer bij (punt 5). */
  function stand() {
    const inst = instelling();
    const keur = keurBestemming(inst.url);
    return {
      inBedrijf: keur.ok,
      bestemming: keur.ok ? keur.url : null,
      soort: 'tweede machine binnen RTG',
      reden: keur.ok ? null : keur.reden,
      ondertekend: !!inst.sleutel,
      grens: 'een tweede machine binnen RTG ziet kopafknipping door één hand. ' +
        'Wie beide machines bestuurt, kan beide koppen afknippen -- daarvoor is een partij ' +
        'buiten dit huis nodig, en dat besluit is niet genomen.'
    };
  }

  return { post, afrekenen, stand, keurBestemming };
}

module.exports = { maakAnkerpost, keurBestemming };
