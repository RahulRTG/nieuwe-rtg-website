/* Magnaat: LOONDIENST -- een speler die voor een andere speler werkt.

   DIT IS STAP 1 UIT VERHAAL.md, en hij staat er met opzet ZONDER permanentie.
   Alles hieronder leeft in het potje en gaat er niet uit: geen carriere, geen
   werkverleden, geen profielregel. Dat komt in stap 2 en valt dan onder de
   18+-grens (./grens.js een map hoger), want een bewaard dienstverband tussen
   twee mensen is bewaarde progressie. Hier gaat het om de vraag die je niet op
   papier kunt beantwoorden: is het leuk om voor een ander te werken?

   HIJ STAAT NAAST ./beheer.js EN DAT IS DE HELE POINTE. Je zaken kunnen draaien
   door een AI-manager of door een MENS, en het zijn twee echte antwoorden op
   dezelfde vraag:

     de AI      is er meteen, vraagt niets, doet precies wat er in zijn regels
                staat, en zijn tarief VERLAAT DE WERELD (./beheer.js: het gaat
                naar een beheerder buiten de tafel, en telt als lek);
     een mens   moet je vinden, hij bepaalt zelf of hij komt, hij kan opzeggen,
                hij doet dingen die niet in een regel passen -- en zijn loon
                gaat naar een ANDERE SPELER aan tafel.

   Dat tweede is geen detail maar de economische les die deze laag draagt: geld
   dat naar een mens gaat blijft in de economie, geld dat naar een dienst gaat
   niet. De geldpompkeuring meet het ook zo -- een salaris tussen twee spelers is
   NEUTRAAL (een pure overdracht, elke afwijking is fout), waar een beheertarief
   LEKKEND is.

   VIER GRENZEN, en drie ervan komen rechtstreeks uit VERHAAL.md:

   1. EEN BAAN IS GEEN ARBEIDSOVEREENKOMST. Niets hier schept een verplichting
      buiten het spel: geen loon, geen uren, geen bescherming.
   2. EEN BAAN KOST NOOIT EEN PAS. Wie voor een andere speler wil werken hoeft
      niets te kopen. Zou dat wel zo zijn, dan is "je begint als afwasser met
      412 euro" een verkoopgesprek. Dit is dezelfde regel die CONCERN.md al
      draagt voor de echte kant.
   3. OPZEGGEN KAN ALTIJD, van beide kanten en zonder boete. Een baan waar je
      niet uit kunt is een verplichting, en verplichtingen vallen onder de
      afwezigheidsgrens: weg zijn mag niets kosten.
   4. EEN WERKNEMER DOET NIETS WAT DE EIGENAAR NIET OOK KAN. Hij loopt door
      dezelfde ACTIES -- exact de wet van de AI-manager, en om exact dezelfde
      reden: een tweede manier om een vestiging te veranderen is een tweede
      economie. Daarom krijgt deze module de actietabel geinjecteerd (zie
      ./dienst-acties.js) en zit hij zelf niet aan de staat.

   OP CODENAAM, en dat is niet nieuw maar overgenomen: `kern/concern/employment.js`
   doet het al zo, en dat is ook het model waar stap 2 op gaat leunen in plaats
   van het na te bouwen (PLATFORM.md: een super app orkestreert domeinsoftware,
   ze vervangt die niet). */
const rond = (n) => Math.round(n);

/* WAT IEMAND KAN ZIJN staat in ./dienst-rollen.js -- de tabel en wat een rol
   waard is. Dit bestand gaat over de MACHINERIE eromheen, en die verandert niet
   als er een rol bij komt. */
const { ROLLEN, ROLLIJST, LOONBAND, loonband, loonVoor, magRol } = require('./dienst-rollen');

/* Hoe lang een openstaande functie blijft staan als niemand reageert. Een
   vacature die eeuwig blijft hangen is geen aanbod maar meubilair. */
const FUNCTIE_MAANDEN = 6;



/* ------------------------------------------------------------------ */

/* De lijsten in de staat, lui aangemaakt zoals de rest van deze map dat doet. */
function functies(st) { return (st.functies = st.functies || []); }
function dienstverbanden(st) { return (st.diensten = st.diensten || []); }

const lopend = (st) => dienstverbanden(st).filter(d => d.status === 'loopt');
const dienstVan = (st, h) => lopend(st).find(d => d.werknemer === h) || null;
const dienstenBij = (st, vestigingId) => lopend(st).filter(d => d.vestiging === vestigingId);

/* MAG DEZE SPELER DIT AAN DEZE VESTIGING VERANDEREN? Twee wegen en niet meer:
   je bent de eigenaar, of je hebt er een dienstverband met een rol die het mag.
   Deze functie is de enige plek waar dat wordt beantwoord, want een tweede
   antwoord op dezelfde vraag is een gat. */
function magAan(st, h, vestigingId, wat) {
  const d = dienstVan(st, h);
  return !!(d && d.vestiging === vestigingId && magRol(d.rol, wat));
}

/* WAT ER DEZE MAAND AAN SALARISSEN BETAALD WORDT, voor EEN werkgever.

   HET IS EEN OVERDRACHT EN GEEN KOSTENPOST DIE VERDWIJNT, en dat verschil is
   het hele punt van deze laag. Het bedrag gaat van de kas van de werkgever naar
   de kas van de werknemer; aan tafel verandert het totaal niet. Daarom telt hij
   ook NIET mee in de leklijst van ./maand-lasten.js -- zou hij dat wel doen, dan
   keurt de geldpompmeter een wereld af waarin mensen elkaar betalen.

   WIE NIET KAN BETALEN, BETAALT TOCH. De kas mag negatief worden; dat kost rood
   staan (de duurste rente die er is) en dat is precies de bedoeling. Een
   werkgever die zijn mensen niet betaalt omdat het even niet uitkomt, is een
   mechaniek die je niet wilt uitleggen. */
function salarissen(st, h, betaal) {
  const uit = [];
  for (const d of lopend(st).filter(x => x.werkgever === h)) {
    const bedrag = rond(d.loon);
    if (bedrag <= 0) continue;
    betaal(h, d.werknemer, bedrag);
    d.betaaldTotaal = rond((d.betaaldTotaal || 0) + bedrag);
    d.maanden = (d.maanden || 0) + 1;
    uit.push({ id: 'dienst:' + d.id, naam: (ROLLEN[d.rol] || {}).naam || d.rol,
      soort: 'salaris', vestiging: d.vestiging, resultaat: -bedrag });
  }
  return uit;
}

/* WAT EEN WERKNEMER DEZE MAAND ONTVING. Dezelfde beweging van de andere kant, en
   hij staat apart omdat hij op een ANDER maandoverzicht hoort: dat van de
   werknemer, die geen vestiging heeft en dus anders geen enkele regel ziet. */
function loonregels(st, h) {
  return lopend(st).filter(d => d.werknemer === h).map(d => ({
    id: 'loon:' + d.id, naam: (ROLLEN[d.rol] || {}).naam || d.rol,
    soort: 'loon', resultaat: rond(d.loon)
  }));
}

/* Openstaande functies opruimen. Gebeurt op de SPELMAAND en niet op de klok,
   want anders verloopt een vacature terwijl er niemand speelt -- dezelfde regel
   als bij de veilinghamer (./veiling.js). */
function verlopen(st) {
  const weg = [];
  for (const f of functies(st))
    if (f.status === 'open' && st.maand - f.maand >= FUNCTIE_MAANDEN) { f.status = 'verlopen'; weg.push(f.id); }
  return weg;
}

/* DE HELE MAAND VAN EEN SPELER wat loondienst betreft: wat hij uitbetaalde en
   wat hij ontving, als regels voor zijn maandoverzicht.

   HIJ STAAT NIET IN ./maand-lasten.js, en dat is de belangrijkste plaatsing van
   deze laag. Dat bestand verzamelt de posten waarbij geld de WERELD verlaat --
   rente, premie, schade, onderzoek, beheer -- en het draagt daarvoor een teller
   die scripts/magnaat-pomp.js aftrekt. Een salaris doet precies het
   omgekeerde: het gaat van de ene speler naar de andere en blijft aan tafel.
   Zou hij daar staan, dan telt de geldpompmeter hem als lek en keurt hij een
   wereld af waarin mensen elkaar betalen -- en dat is nu juist de wereld die
   deze laag wil maken. */
function maandregels(st, h, betaal) {
  return salarissen(st, h, betaal).concat(loonregels(st, h));
}

module.exports = { ROLLEN, ROLLIJST, LOONBAND, FUNCTIE_MAANDEN,
  loonband, loonVoor, magRol, magAan, functies, dienstverbanden, lopend,
  dienstVan, dienstenBij, salarissen, loonregels, maandregels, verlopen };
