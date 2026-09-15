/* DE WEG TERUG -- en waarom de waarheid dan ACHTERUIT moet blijven kloppen.

   Puur, net als ./reisbureau-geldrijen.js: er gaan bewaarde herkomstrijen in en
   er komen spiegelrijen uit. Geen db, geen pay. De opslag blijft bij de eigenaar
   van de collectie (./reisbureau-betaling.js), want twee schrijvers op een
   verklaarde bak is precies wat keuringsregel 63 tegenhoudt.

   ================== DE KEUZE DIE ALLES BEPAALT ==================

   Welke EIGENAAR draagt een spiegelrij? Er zijn twee antwoorden die allebei
   plausibel klinken, en maar een ervan houdt de boeken eerlijk.

   FOUT: eigenaar = `lid`, want het geld gaat terug naar het lid. Dan telt de
   spiegel in de bak `aanDeKlant` en blijven doorbelasting en bijdragebasis op
   hun oude bedrag staan. Na een VOLLEDIGE terugbetaling zegt de uitslag dan nog
   steeds dat RTG EUR 120 heeft verdiend en EUR 1.800 aan derden toekomt, met
   daarnaast een negatieve post van EUR 1.950. Het bruto klopt (nul) en elke
   afzonderlijke bak liegt.

   GOED: eigenaar = DEZELFDE als op de oorspronkelijke rij. Een hotelnacht van
   EUR 610 terugdraaien is min EUR 610 DOORBELASTING, niet een schuld aan de
   klant. Na een volledige terugbetaling staan doorbelasting, bijdragebasis en
   belasting alle drie op nul, en dat is wat er economisch is gebeurd: niemand
   heeft iets overgehouden.

   Wat wel omdraait zijn de twee ANDERE vragen. `economischeHerkomst` wordt
   `rtg` (de waarde komt nu van RTG) en `naarWie` wordt `lid` (daar gaat hij
   heen). Dat is de hele reden dat die drie velden apart bestaan: bij een
   terugboeking bewegen er twee mee en blijft er een staan.

   ================== GEEN GELD, ALLEEN DE WAARHEID ==================

   Deze laag verplaatst niets. Wat eruit komt is de administratieve spiegel plus
   een teruggaveRECHT dat een mens uitvoert -- dezelfde vorm als
   kern/horeca/correctie.js en dezelfde regel als in CLAUDE.md: een afzegging
   verplaatst geen geld maar legt vast wat er niet is geregeld. */
'use strict';

const { geldrij } = require('./waarde/economischeherkomst');

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

  const rijenUit = bruikbaar.map(r => ({
    spiegelVan: r.id,
    rij: geldrij({
      bedragCenten: -Math.abs(Number(r.bedragCenten) || 0),
      valuta: r.valuta,
      /* De waarde komt nu van RTG en gaat naar het lid -- twee velden draaien om. */
      economischeHerkomst: 'rtg',
      /* En dit veld draait NIET om: zie de kop. Een hotelnacht terugdraaien is
         min doorbelasting, geen schuld aan de klant. */
      economischeEigenaar: r.economischeEigenaar,
      naarWie: 'lid',
      grond: 'terugboeking (' + grond + '): ' + (r.grond || ''),
      bronObject: boekingId ? ('payboeking:' + boekingId) : r.bronObject,
      relatie: r.relatie, land: r.land,
      bewijs: 'spiegel van herkomstrij ' + r.id
    })
  }));

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
