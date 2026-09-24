/* ============================================================================
   BEDIENBAAR, OPNIEUW GEDEFINIEERD -- wat de proef van een app moet raken, en
   hoeveel tikken ze daarvoor krijgt.

   WAAROM. Op 24 september 2026 stond `bedienbaar` voor alle 112 onderdelen op
   NIET_GETEST, en drie apps die op 7 september BEWEZEN waren, vielen terug. Een
   diagnose in twee rondes (trechter, spoor per ronde, stadia per herkomst) wees
   vier fouten in de METER aan en geen enkele in een app:

     1. NAVIGATIE. Een tik op een merk- of kruimelpadlink van de schil navigeert
        pas na de url-controle weg; de volgende ronde zag 0 knoppen op een andere
        pagina en concludeerde "geen nieuwe knop". 50 van de 97 schermen stopten
        zo te vroeg.
     2. DE NOEMER GROEIDE ONDER HET EXAMEN. `gevonden` was het maximum over alle
        rondes, dus een paneel dat de proef zelf opende telde mee (Buurtruil
        23 -> 43 na een tik op de zoekknop).
     3. DE SCHIL. Van de zichtbare knoppen hoorde het merendeel bij de gedeelde
        schil (de Edge alleen: 1923 op 93 schermen, waarvan 993 onder een laag),
        en de lus koos op DOM-volgorde, dus de rondes gingen op aan schilknoppen.
     4. HET BUDGET. Met een vaste limiet van veertien en een drempel van de helft
        was de drempel op 86 van de 97 schermen wiskundig onhaalbaar.

   WAT HIER STAAT, in de volgorde waarin de proef het gebruikt:

     inventaris bij het laden  (in de browser, scripts/appwerkt.js)
       -> plan(): per knop herkomst en raakbaarheid, en DE NOEMER BEVRIEST
          (alleen app-knoppen die bij het laden te raken zijn)
       -> budget en drempel volgen uit die noemer
       -> de proef tikt alleen knoppen uit die bevroren noemer
       -> oordeel()

   DE SCHIL IS GEEN PLEK OM FOUTEN TE VERBERGEN. Ze krijgt een eigen bewijs
   (`RTG-schil` in APPWERKT.json), en elke app draagt die uitslag als
   afhankelijkheid mee. "De eigen bediening van deze app is bewezen" en "een
   gedeelde afhankelijkheid heeft een gebrek" staan dus naast elkaar en worden
   nooit samengevoegd tot "deze app werkt".
   ========================================================================== */
'use strict';

/* DE SCHIL: topcontainers die een gedeeld script AANMAAKT. Het criterium is de
   herkomst in de code, niet hoe vaak iets voorkomt: test/bedieningsmeting.test.js
   zoekt voor elke regel het script in public/shared/ dat het teken noemt, en zakt
   als het er niet is. Een app die zelf een element met zo'n klasse maakt, hoort
   er dus niet in; een nieuw gedeeld onderdeel hoort erbij te komen. */
const SCHIL = [
  { teken: 'rtg-edge-chrome', bron: 'public/shared/rtg-edge-2-loader.js' },
  { teken: 'ios-nav', bron: 'public/shared/rtg-adaptive-edge-claim.js' },
  { teken: 'ios-thuis', bron: 'public/shared/ios.js' },
  { teken: 'rtgsprong', bron: 'public/shared/sprong.js' },
  { teken: 'rtgsprong-greep', bron: 'public/shared/sprong.js' },
  { teken: 'rnd-toets', bron: 'public/shared/randen.js' },
  { teken: 'rtg-rahul-page', bron: 'public/shared/rahul-tab.js' },
  { teken: 'rtg-lang-scrim', bron: 'public/shared/i18n.js' },
  { teken: 'mgz-sheet', bron: 'public/shared/metgezel.js' },
  { teken: 'hv-chat', bron: 'public/shared/handenvrij-scherm.js' },
  { teken: 'hv-balk', bron: 'public/shared/handenvrij-bureau/handenvrij-bureau-01.js' },
  { teken: 'hv-werk', bron: 'public/shared/handenvrij-bureau/handenvrij-bureau-01.js' },
  { teken: 'amn-knop', bron: 'public/shared/appmenu.js' },
  { teken: 'tos-topbar', bron: 'public/shared/travel-os.js' },
  { teken: 'tos-security', bron: 'public/shared/travel-os.js' },
  { teken: 'rtg-intel-scrim', bron: 'public/shared/social-intelligence-runtime.js' },
  { teken: 'rtg-intel-strip', bron: 'public/shared/social-intelligence-runtime.js' },
  { teken: 'rtgplek', bron: 'public/shared/plek.js' },
  { teken: 'rahulfab', bron: 'public/shared/metgezel.js' },
  { teken: 'rahulsheet', bron: 'public/shared/command/bladhaak.js' },
  { teken: 'rtg-duimbalk', bron: 'public/shared/rtg-edge-2-context.js' }
];
const SCHILTEKENS = new Set(SCHIL.map((s) => s.teken));

/* Een herkomst ziet eruit als `div.rtg-edge-chrome` of `button#osMenuBtn.amn-knop`:
   tag, eventueel #id, eventueel .eerste-klasse. De tekens zijn het id en de klasse. */
function tekens(herkomst) {
  return String(herkomst || '').split(/[.#]/).slice(1).filter(Boolean);
}
function isSchil(herkomst) {
  return tekens(herkomst).some((t) => SCHILTEKENS.has(t));
}

/* Het hoogste budget dat een scherm krijgt. Het budget volgt uit de noemer
   (elke app-knop een keer), en dit plafond houdt een uitzonderlijk scherm binnen
   een ronde van redelijke duur. Het plafond mag de drempel nooit onhaalbaar
   maken: dan faalt plan() hard, zie hieronder. */
const BUDGET_PLAFOND = 80;

class MeterConfigFout extends Error {
  constructor(bericht) { super(bericht); this.name = 'MeterConfigFout'; }
}

/* HET PLAN. `knoppen` is de inventaris bij het laden, vOOR er getikt wordt:
   [{ merk, herkomst, raakpunten, onomkeerbaar }] met raakpunten 0..5 (de hittest op vijf
   punten). Te raken is minstens een punt: een knop waarvan alleen het midden
   onder een laag ligt, is voor een mens vaak gewoon te bedienen.

   De noemer is DE LIJST app-knoppen die te raken zijn, op merk en ontdubbeld.
   Wat de proef later zelf openlegt, komt er nooit meer bij. */
function plan(knoppen, opties = {}) {
  const plafond = opties.plafond || BUDGET_PLAFOND;
  const app = [], schil = [];
  const nietRaakbaar = { app: 0, schil: 0 };
  /* Knoppen die de proef met opzet niet aanraakt (betalen, verwijderen,
     uitloggen: ONOMKEERBAAR in scripts/appwerkt.js) horen niet in de noemer --
     anders maakt een scherm met veel betaalknoppen zijn drempel onhaalbaar --
     maar ze verdwijnen ook niet: ze worden apart geteld. */
  const onomkeerbaar = { app: 0, schil: 0 };
  const gezien = new Set();
  for (const k of knoppen || []) {
    if (!k || gezien.has(k.merk)) continue;
    gezien.add(k.merk);
    const kant = isSchil(k.herkomst) ? 'schil' : 'app';
    if (!(k.raakpunten > 0)) { nietRaakbaar[kant]++; continue; }
    if (k.onomkeerbaar) { onomkeerbaar[kant]++; continue; }
    (kant === 'app' ? app : schil).push(k.merk);
  }
  const maak = (lijst, wat) => {
    const drempel = Math.ceil(lijst.length / 2);
    const budget = Math.min(lijst.length, plafond);
    /* DE INVARIANT. Een drempel die het budget niet kan halen is een fout van de
       METER, en hij mag nooit als NIET_GETEST bij een app terechtkomen -- dan
       vermomt een intern probleem zich als uitspraak over het product. */
    if (drempel > budget) {
      throw new MeterConfigFout(wat + ': de drempel (' + drempel + ') ligt boven het budget (' + budget +
        ') bij een noemer van ' + lijst.length + '; verhoog BUDGET_PLAFOND of splits het scherm, maar meet zo niet');
    }
    return { noemer: lijst, drempel, budget };
  };
  return { app: maak(app, 'app'), schil: maak(schil, 'schil'), nietRaakbaar, onomkeerbaar };
}

/* HET OORDEEL over een kant (app of schil), uit wat de proef deed. */
function oordeel(p, uitslag) {
  const n = p.noemer.length;
  const u = uitslag || {};
  const trechter = n + ' te raken bij het laden, ' + (u.geprobeerd || 0) + ' geprobeerd, ' + (u.gelukt || 0) +
    ' gelukt, ' + (u.effect || 0) + ' met zichtbaar effect' +
    (u.nietMeerGevonden ? ', ' + u.nietMeerGevonden + ' niet meer gevonden' : '') +
    (u.overgeslagen ? ', ' + u.overgeslagen + ' overgeslagen (onomkeerbaar)' : '') +
    (u.teruggekeerd ? ', ' + u.teruggekeerd + 'x teruggekeerd na navigatie' : '');
  if (n === 0) return { status: 'NIET_GETEST', reden: 'geen knop die bij het laden te raken is; wat dit scherm doet loopt via links of formulieren' };
  if ((u.gelukt || 0) < p.drempel) {
    return { status: 'NIET_GETEST', reden: trechter + ' -- de drempel is ' + p.drempel + ', dus dit is niet beproefd' };
  }
  return { status: 'BEWEZEN', reden: trechter };
}

module.exports = { SCHIL, isSchil, tekens, plan, oordeel, MeterConfigFout, BUDGET_PLAFOND };
