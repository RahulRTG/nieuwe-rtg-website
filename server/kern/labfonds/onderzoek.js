/* ============================================================================
   HET LAB-FONDS EN HET ONDERZOEK -- de schakel die er niet was.

   Het fonds haalde geld op VOOR onderzoek en wist niet WELK. Een lid kon dus
   zien dat het EUR 40 had bijgedragen aan de pot van Amsterdam, en nergens dat
   daar onderzoek RTF-AMS-2026-0003 mee is betaald. Dat is de duurste ontbrekende
   schakel uit de meting (scripts/onderzoeksketen.js): het fonds is het enige
   station dat om het onderzoek heen ging in plaats van eraan vast te zitten.

   HOE HIJ IS GELEGD, EN WAAROM ZO.

   1. EEN VOORSTEL NOEMT HET ONDERZOEK, HET ONDERZOEK NOEMT GEEN VOORSTEL.
      De verwijzing staat op EEN plek -- bij het voorstel -- en de andere kant
      wordt afgeleid (`financiering`). Twee lijsten die naar elkaar wijzen lopen
      uit de pas zodra er een voorstel wordt afgewezen of een studie verdwijnt.

   2. EEN MENS TIKT HET NUMMER, DE SOFTWARE BEWAART DE SLEUTEL. Het
      onderzoeksnummer is voor mensen en met opzet geen sleutel (zie
      livinglab/onderzoeksnummer.js regel 2). Wie het intikt krijgt het nummer
      opgezocht; wat er wordt vastgelegd is de interne studie-id, zodat een
      tweede lab met dezelfde stadsafkorting een lelijkheid blijft en geen fout.

   3. HIJ WIJST NOOIT NAAR NIETS. Een voorstel dat een onbestaand onderzoek
      noemt, wordt geweigerd met de reden -- niet aangemaakt met een dood
      verwijzingsveld erin. Verdwijnt het onderzoek daarna alsnog, dan zegt de
      kaart dat ("dit onderzoek staat niet meer in het lab") in plaats van het
      veld stil weg te laten.

   4. HIJ TOONT NOOIT MEER DAN DE OPENBARE RING. Van het onderzoek komen alleen
      nummer, titel, soort en stap mee -- precies wat livinglab/studie.js aan een
      willekeurige voorbijganger toont. Het fonds is een openbare ledenpagina; er
      mag geen dossierinhoud langs deze weg naar buiten lekken, ook niet van een
      gescheiden studie.

   5. HET IS EEN TOEZEGGING EN GEEN BETALING, en het wordt NOOIT opgeteld bij de
      gemeten infrastructuurkosten in het onderzoeksgrootboek. Dat is dezelfde
      regel als begroting-naast-infrastructuur in livinglab/ledger.js: het ene is
      door mensen toegezegd, het andere door de meter geteld, en een saldo van die
      twee suggereert een nauwkeurigheid die er niet is.
   ========================================================================== */
'use strict';

const VORM = require('../livinglab/onderzoeksnummer').VORM;

/* Wat er van een onderzoek MEE mag naar het fonds. Een lijstje en geen
   spreidoperator: een veld dat morgen aan de openbare ring wordt toegevoegd,
   hoort niet vanzelf op een fondspagina te verschijnen. */
const openbaar = (s) => ({ id: s.id, nummer: s.nummer || null, titel: s.titel,
  soort: s.soort || null, stap: s.stap || null, labId: s.labId || null });

module.exports = (ctx) => {
  /* Late binding: het Living Lab wordt in dezelfde opzetlaag gebouwd, maar wie
     hier een waarde zou bevriezen, koppelt de volgorde van kernlaag2 aan het
     bestaan van deze schakel. Ontbreekt het lab, dan zegt dit domein dat -- het
     verzint geen leeg onderzoek. */
  const lab = () => (typeof ctx.livinglab === 'function' ? ctx.livinglab() : ctx.livinglab) || null;

  /* Zoek een onderzoek op wat een mens intikte: een onderzoeksnummer
     (RTF-AMS-2026-0003) of de interne id. Geeft altijd een REDEN terug en nooit
     een lege uitkomst. */
  function zoek(ref) {
    const t = String(ref == null ? '' : ref).trim();
    if (!t) return { gevonden: false, reden: 'Er is geen onderzoek genoemd.' };
    const l = lab();
    if (!l || typeof l.S !== 'function')
      return { gevonden: false, reden: 'Het onderzoeksplatform is hier niet beschikbaar; koppelen kan nu niet.' };
    const studies = (l.S().studies || []);
    const boven = t.toUpperCase();
    const s = VORM.test(boven)
      ? studies.find(x => String(x.nummer || '').toUpperCase() === boven)
      : studies.find(x => x.id === t);
    if (!s) return { gevonden: false, reden: VORM.test(boven)
      ? 'Onderzoek ' + boven + ' staat niet in het Living Lab.'
      : 'Dit onderzoek kennen we niet. Neem het onderzoeksnummer over, bijvoorbeeld RTF-AMS-2026-0001.' };
    return { gevonden: true, studie: openbaar(s) };
  }

  /* Het beeld van de koppeling bij EEN voorstel. De titel wordt hier opgehaald
     en niet meegekopieerd bij het indienen: een titel mag veranderen, en dan
     hoort de fondspagina de nieuwe te tonen. Het NUMMER is wel bevroren, want
     dat verandert per definitie nooit (regel 1 van onderzoeksnummer.js) en het
     is het enige waarmee een lezer het onderzoek nog terugvindt als het uit het
     lab verdwenen is. */
  function beeld(v) {
    if (!v || !v.studieId) return null;
    const r = zoek(v.studieId);
    if (r.gevonden) return { nummer: r.studie.nummer, titel: r.studie.titel,
      soort: r.studie.soort, stap: r.studie.stap, studieId: r.studie.id };
    return { nummer: v.studieNummer || null, titel: null, studieId: v.studieId,
      nietTeZeggen: 'Dit onderzoek staat niet meer in het lab: ' + r.reden };
  }

  /* De andere kant, afgeleid: welk fondsgeld is aan DIT onderzoek toegezegd.
     Toegekend en nog-open staan apart -- een open voorstel is een wens en geen
     financiering, en samengeteld zou het dat wel lijken. */
  function financiering(studieId, eur) {
    const id = String(studieId || '');
    const alle = (ctx.F().voorstellen || []).filter(v => v.studieId === id);
    const toe = alle.filter(v => v.status === 'toegekend');
    const open = alle.filter(v => v.status === 'open');
    const locNaam = (locId) => (ctx.F().locaties[locId] || {}).naam || locId;
    return {
      toegezegd: {
        bedrag: eur(toe.reduce((s, v) => s + v.centen, 0)),
        graad: 'gemeten',
        herkomst: 'geteld uit het fondsgrootboek (kern/labfonds)',
        voorstellen: toe.map(v => ({ id: v.id, titel: v.titel, bedrag: eur(v.centen),
          locatie: locNaam(v.locId), at: (v.besluit && v.besluit.at) || v.at }))
      },
      openVoorstellen: open.map(v => ({ id: v.id, titel: v.titel, bedrag: eur(v.centen),
        locatie: locNaam(v.locId), at: v.at })),
      zegtNiet: [
        'Dit is wat leden hebben TOEGEZEGD in het fondsgrootboek, geen verwerkte betaling.',
        'Het zegt niet of het geld al is besteed, en het hoort niet bij de gemeten infrastructuurkosten opgeteld te worden.',
        'Een openstaand voorstel is een wens: er is nog niet over gestemd.'
      ]
    };
  }

  return { zoek, beeld, financiering, openbaar };
};
