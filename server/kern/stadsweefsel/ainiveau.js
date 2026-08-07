/* DE VIJF NIVEAUS: wat mag een machine in deze stad zelf doen?

   RTG Stad had hier al een goede regel: de AI-stadsregisseur adviseert en
   besluit nooit. Die regel was alleen te grof zodra het weefsel erbij kwam.
   "Een bericht sturen" en "een brug afsluiten" zijn niet dezelfde handeling met
   dezelfde afweging, en een systeem dat ze allebei onder "de AI beslist niet"
   schuift, zegt in de praktijk niets: het verbiedt het onschuldige samen met
   het gevaarlijke, en dus wordt de regel op een dag omzeild voor het
   onschuldige -- en dan geldt hij nergens meer.

   Vandaar vijf niveaus, van waarnemen tot verboden. Ze staan hier als PURE
   DATA zodat elk deel van het weefsel dezelfde lijst leest en niemand er een
   eigen versie van maakt.

     0 waarnemen   beschrijven wat er gebeurt
     1 adviseren   een maatregel voorstellen
     2 voorbereiden een conceptbesluit, werkorder of scenario klaarzetten;
                    een mens keurt goed
     3 begrensd    zelf uitvoeren, binnen vooraf goedgekeurde grenzen, en
                    alleen laag-risico
     4 verboden    nooit zonder een expliciete menselijke beslissing

   HET VERSCHIL TUSSEN 3 EN 4 IS GEEN INSCHATTING MAAR EEN LIJST. Wat op niveau
   4 staat, staat er met naam: hulpdiensten inzetten, wegen of bruggen sluiten,
   een vergunning of uitkering weigeren, politie-inzet, een persoonsrisico
   bepalen, kritieke infrastructuur uitschakelen, medische prioriteiten
   wijzigen. Wie een nieuwe handeling toevoegt, kiest hier zijn niveau -- en
   `magAutomatisch()` is de enige plek die daar antwoord op geeft.

   Deze tabel is ook de bron van het algoritmeregister (./algoritmeregister.js),
   want wat een systeem MAG is de eerste vraag die een inwoner erover stelt. */

const NIVEAUS = [
  { n: 0, naam: 'waarnemen', uitleg: 'beschrijft wat er gebeurt en verandert niets' },
  { n: 1, naam: 'adviseren', uitleg: 'stelt een maatregel voor; een mens beslist' },
  { n: 2, naam: 'voorbereiden', uitleg: 'zet een conceptbesluit of werkorder klaar; een mens keurt goed' },
  { n: 3, naam: 'begrensd', uitleg: 'voert zelf uit, alleen laag-risico en binnen vooraf goedgekeurde grenzen' },
  { n: 4, naam: 'verboden', uitleg: 'nooit zonder een expliciete menselijke beslissing' }
];

/* De handelingen die het weefsel kent, met hun niveau. De sleutel is wat er
   GEBEURT, niet welke module het doet: dezelfde handeling hoort overal even
   zwaar te wegen. */
const HANDELINGEN = {
  // niveau 3: laag-risico, omkeerbaar, en het ergste gevolg is een overbodige rit
  'melding-samenvoegen': { niveau: 3, wat: 'twee waarnemingen als een zaak zien', omkeerbaar: true },
  'werkorder-uit-zaak': { niveau: 3, wat: 'een zaak meteen van werk voorzien', omkeerbaar: true },
  'bericht-sturen': { niveau: 3, wat: 'een melder of ploeg een bericht sturen', omkeerbaar: false },
  'meting-vragen': { niveau: 3, wat: 'een extra meting of inspectie aanvragen', omkeerbaar: true },
  'reserveploeg-informeren': { niveau: 3, wat: 'de reserveploeg informeren', omkeerbaar: false },

  // niveau 2: het systeem legt klaar, een mens tekent
  'onderhoud-plannen': { niveau: 2, wat: 'een onderhoudsronde voorstellen', omkeerbaar: true },
  'oorzaak-aanwijzen': { niveau: 2, wat: 'een gedeelde oorzaak aanwijzen', omkeerbaar: true },
  'energie-advies': { niveau: 2, wat: 'een energiemaatregel klaarzetten', omkeerbaar: true },
  'scenario-voorstellen': { niveau: 2, wat: 'een stadsscenario voorstellen', omkeerbaar: true },

  // niveau 4: hier komt geen machine aan, met of zonder sleutel
  'kritiek-onderhoud': { niveau: 4, wat: 'werk aan veiligheidskritieke infrastructuur inplannen', omkeerbaar: false },
  'weg-afsluiten': { niveau: 4, wat: 'een weg of brug afsluiten', omkeerbaar: false },
  'hulpdienst-inzetten': { niveau: 4, wat: 'een hulpdienst laten uitrukken', omkeerbaar: false },
  'infra-uitschakelen': { niveau: 4, wat: 'kritieke infrastructuur uitschakelen', omkeerbaar: false },
  'vergunning-weigeren': { niveau: 4, wat: 'een vergunning of aanvraag afwijzen', omkeerbaar: false },
  'persoonsrisico': { niveau: 4, wat: 'een risico-oordeel over een persoon vormen', omkeerbaar: false },
  'scenario-nood': { niveau: 4, wat: 'de stad in het nood-scenario zetten', omkeerbaar: false }
};

/* De enige plek die "mag dit vanzelf?" beantwoordt. Geeft altijd een REDEN
   terug, ook bij ja: een poort die alleen true/false zegt, is bij het lezen van
   een logregel later niet meer na te vertellen. */
function magAutomatisch(handeling) {
  const h = HANDELINGEN[String(handeling || '')];
  if (!h) return { mag: false, niveau: 4, reden: 'onbekende handeling: wat niet op de lijst staat, gebeurt niet vanzelf' };
  if (h.niveau >= 4) return { mag: false, niveau: 4, reden: h.wat + ': verboden zonder een expliciete menselijke beslissing' };
  if (h.niveau === 3) return { mag: true, niveau: 3, reden: h.wat + ': laag-risico en binnen de vooraf goedgekeurde grenzen' };
  return { mag: false, niveau: h.niveau, reden: h.wat + ': het systeem zet klaar, een mens keurt goed' };
}

// het niveau van een handeling die een OBJECT raakt: een kritiek object trekt
// alles naar 4, ongeacht hoe onschuldig de handeling op zichzelf is
function niveauVoorObject(handeling, object) {
  const basis = HANDELINGEN[String(handeling || '')];
  const n = basis ? basis.niveau : 4;
  if (object && object.risico === 'kritiek') return Math.max(n, 4);
  if (object && object.risico === 'hoog') return Math.max(n, 2);
  return n;
}

module.exports = { NIVEAUS, HANDELINGEN, magAutomatisch, niveauVoorObject };
