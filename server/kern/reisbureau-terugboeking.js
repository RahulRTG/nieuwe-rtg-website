/* DE WEG TERUG VAN EEN REIS -- de toepassing van ECON-01.

   Puur, net als ./reisbureau-geldrijen.js: er gaan bewaarde herkomstrijen in en
   er komen spiegelrijen uit. Geen db, geen pay. De opslag blijft bij de eigenaar
   van de collectie (./reisbureau-betaling.js), want twee schrijvers op een
   verklaarde bak is wat keuringsregel 63 tegenhoudt.

   DE REGEL ZELF STAAT HIER NIET. Hij woont in kern/waarde/omkering.js als
   ECON-01 -- `geldrichting is niet hetzelfde als economische eigendom` -- en
   dat is met opzet: dezelfde vraag komt terug bij een chargeback, een storno,
   een voucher, een correctieboeking en een afwikkeling met een leverancier. Wie
   hem hier zou uitschrijven, zet dezelfde waarheid op zeven plekken en laat de
   zevende afdrijven.

   Deze module doet dus drie dingen die WEL van reizen zijn: welke rijen mogen
   terug (niet twee keer, niet een rij die zelf al een spiegel is), wat een
   gedeeltelijke terugboeking betekent, en of de uitslag daarna nog sluit. */
'use strict';

const { keerOm, schendingen, REGEL } = require('./waarde/omkering');

/* ---------- de spiegel ----------
   `rijen` zijn de BEWAARDE herkomstrijen van een betaalde reis; `kiesIds` is
   null (alles) of een lijst id's voor een gedeeltelijke terugboeking. */
function spiegelVoor({ rijen, kiesIds, reden, boekingId }) {
  const alles = Array.isArray(rijen) ? rijen : [];
  if (!alles.length) {
    return { ok: false, waarom: 'er zijn geen herkomstrijen om terug te draaien', rijen: [] };
  }
  const grond = String(reden || '').trim();
  if (grond.length < 4) {
    /* EEN TERUGBOEKING ZONDER REDEN IS BIJ EEN GESCHIL NIETS WAARD, en hij is
       ook niet te controleren: een bedrag dat terugloopt zonder dat iemand heeft
       opgeschreven waarom, ziet er hetzelfde uit als een fout. */
    return { ok: false, waarom: 'een terugboeking draagt een reden, en die ontbreekt', rijen: [] };
  }

  const kies = kiesIds == null ? null : new Set(kiesIds.map(String));
  const gekozen = kies ? alles.filter(r => kies.has(String(r.id))) : alles.slice();
  if (kies && gekozen.length !== kies.size) {
    return { ok: false, rijen: [],
      waarom: 'niet elke opgegeven herkomstrij hoort bij deze reis; er wordt niets teruggedraaid ' +
        'zolang de opgave niet klopt' };
  }
  /* AL TERUGGEDRAAID IS GEEN TWEEDE KEER. Een rij die zelf een spiegel is, of
     waarvan de spiegel al bestaat, mag niet nog eens -- dat zou het bedrag
     verdubbelen terwijl de reis een keer is teruggedraaid. */
  const alGespiegeld = new Set(alles.filter(r => r.spiegelVan).map(r => String(r.spiegelVan)));
  const bruikbaar = gekozen.filter(r => !r.spiegelVan && !alGespiegeld.has(String(r.id)));
  if (!bruikbaar.length) {
    return { ok: false, rijen: [], waarom: 'deze rijen zijn al teruggedraaid' };
  }

  const rijenUit = [];
  for (const r of bruikbaar) {
    const om = keerOm(r, { grond: 'terugbetaling', reden: grond,
      bronObject: boekingId ? ('payboeking:' + boekingId) : r.bronObject,
      bewijs: REGEL + ': spiegel van herkomstrij ' + r.id });
    if (!om.ok) return { ok: false, rijen: [], waarom: om.waarom };
    /* DE HANDHAVER DRAAIT OP DE UITKOMST EN NIET OP HET VERTROUWEN. keerOm en
       schendingen komen uit dezelfde module, dus dit vangt geen fout in de
       spiegel maar een fout in DEZE laag: een rij die hier wordt aangepast
       voordat hij wordt bewaard, komt er niet meer doorheen. */
    const fout = schendingen(r, om.rij);
    if (fout.length) return { ok: false, rijen: [], waarom: fout.join(' | ') };
    rijenUit.push({ spiegelVan: r.id, rij: om.rij });
  }

  const terug = rijenUit.reduce((a, x) => a + Math.abs(x.rij.bedragCenten), 0);
  return { ok: true, rijen: rijenUit, terugCenten: terug, volledig: bruikbaar.length === alles.length, waarom: null };
}

/* Klopt de waarheid achteruit? Neemt ALLE rijen (origineel plus spiegels) en
   zegt of de uitslag is wat hij na deze terugboeking hoort te zijn. Losse
   functie, zodat een toets hem kan voeden zonder server -- en zodat de betaallaag
   hem kan aanroepen vóórdat hij iets bewaart. */
function kloptAchteruit(alleRijen, bereken) {
  const u = bereken(alleRijen);
  return {
    sluit: u.sluit, verschil: u.verschil,
    bruto: u.bruto, doorbelasting: u.doorbelasting, bijdragebasis: u.bijdragebasis,
    overig: u.overig,
    /* Bij een VOLLEDIGE terugboeking horen alle drie op nul te staan. Staat er
       dan nog iets, dan heeft een spiegel een andere bak geraakt dan zijn
       origineel -- en dat is precies de fout die de kop hierboven beschrijft. */
    allesNul: u.bruto === 0 && u.doorbelasting === 0 && u.bijdragebasis === 0
  };
}

module.exports = { spiegelVoor, kloptAchteruit };
