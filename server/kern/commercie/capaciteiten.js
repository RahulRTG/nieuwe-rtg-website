/* WAT MAG EEN TREDE? Capabilities, en niet nog eens 77 pas-id-controles.

   HET PROBLEEM DAT DIT VOORKOMT. Zevenenzeventig bestanden noemen een pas-id.
   Zou Business Lite worden uitgerold zoals de vorige passen, dan komt er in al
   die bestanden een regel bij van de vorm:

       if (pas === 'business-lite')

   en bij de zesde trede opnieuw. Dat is dezelfde fout als drie kopieen van de
   pasprijs, alleen groter: de vraag "mag deze klant dit" wordt dan op zeventig
   plaatsen los beantwoord, en die antwoorden lopen uiteen zodra iemand er een
   vergeet. Dat is precies hoe kern/thuis/zakelijk.js aan een eigen commissie van
   10 procent kwam terwijl de rest 12 gebruikte.

   DUS: een trede kent geen rechten toe, een PRODUCTPROFIEL doet dat. De code
   vraagt niet welke pas iemand heeft maar wat hij mag:

       mag(pas, 'can_use_pos')      in plaats van    pas === 'business'

   Bij een zesde trede hoeft er dan geen enkel bestand open: er komt een profiel
   bij in deze tabel, en klaar.

   DE NAMEN ZIJN ENGELS en de rest van dit huis is Nederlands. Dat is met opzet:
   het zijn sleutels in een tabel, geen zinnen voor een mens. Ze staan zo ook in
   COMMERCIE.md par. 6, en een sleutel die in het ontwerp anders heet dan in de
   code is een vertaalslag die iemand een keer verkeerd maakt.

   WAT DIT NIET IS: het derde rechtenmodel. CONCERN.md is daar duidelijk over --
   toegang verlenen gebeurt waar de rol woont, en er komt geen extra
   rechtensysteem bij. Deze tabel gaat niet over WIE iemand is (dat blijft de
   rol) maar over WAT ZIJN ABONNEMENT bevat. Een manager met alle rollen van de
   wereld kan geen kassa draaien als het abonnement van de zaak die niet bevat,
   en een lid met het duurste abonnement is nog steeds geen manager. Twee vragen,
   twee antwoorden, en ze worden allebei gesteld. */
'use strict';

/* De capabilities. Elke regel zegt wat hij betekent, want een sleutel zonder
   uitleg wordt bij de eerste twijfel verkeerd geraden. */
const CAPS = {
  can_use_workos: 'het Werk OS: roosters, taken, werkplekken',
  can_manage_staff: 'personeel: contracten, uren, salaris',
  can_use_pos: 'de kassa en het afrekenen ter plaatse',
  can_use_ai: 'de AI-assistent binnen het inbegrepen tegoed',
  can_use_enterprise_governance: 'governance: vier-ogen, audit, beleidsregels per organisatie',
  can_use_dedicated_support: 'een vaste contactpersoon in plaats van de gewone lijn',
  can_use_lifestyle_service: 'de menselijke concierge en volledige regie',
  can_be_partner: 'een bedrijfscode aanvragen en als partner op het platform staan'
};

/* De profielen per trede. Wat er NIET in staat, mag niet -- er is geen
   erfelijkheid tussen treden en dat is bewust: "Business Lite krijgt alles van
   RTG Pass plus wat extra" leest prettig tot iemand iets uit RTG Pass haalt en
   het stil uit drie andere profielen verdwijnt. Elke trede staat voluit. */
const PROFIEL = {
  gratis: [],

  rtg: ['can_use_ai'],

  /* Business Lite: veel software, geen twintig losse modules. De standaard
     zakelijke capabilities die bij het bedrijfstype horen, plus de partnerpoort
     -- dat laatste is het besluit van 20 augustus 2026 (COMMERCIE.md 3b), want
     de poort eiste een Business Pass en die is vanaf 5.000 euro. Geen enterprise
     governance en geen vaste contactpersoon: dat is waar Business voor is. */
  'business-lite': ['can_use_workos', 'can_manage_staff', 'can_use_pos', 'can_use_ai', 'can_be_partner'],

  business: ['can_use_workos', 'can_manage_staff', 'can_use_pos', 'can_use_ai',
    'can_use_enterprise_governance', 'can_use_dedicated_support', 'can_be_partner'],

  /* Lifestyle is geen zwaardere Business. De menselijke regie is er wel, de
     bedrijfsvoering niet: het is een persoonlijke pas, geen zakelijke. Wie beide
     wil, heeft beide nodig -- en dat is eerlijker dan een pas die stilzwijgend
     alles kan. */
  lifestyle: ['can_use_ai', 'can_use_dedicated_support', 'can_use_lifestyle_service']
};

function capsVan(pas) {
  const p = PROFIEL[String(pas || '')];
  return Array.isArray(p) ? p.slice() : [];
}

/* De vraag die de code stelt. Een onbekende pas of een onbekende capability
   geeft false: niet mogen is de veilige uitkomst, en een tikfout in een
   capability-naam hoort niet stilzwijgend toegang te geven. */
function mag(pas, cap) {
  if (!CAPS[cap]) return false;
  return capsVan(pas).includes(cap);
}

/* Welke treden hebben deze capability? Voor schermen die willen zeggen "hiervoor
   heeft u Business Lite of hoger nodig" zonder die lijst zelf op te schrijven. */
function tredenMet(cap) {
  return Object.keys(PROFIEL).filter(p => mag(p, cap));
}

/* Het profiel als leesbaar geheel, voor de boardroom en voor een verkooppagina.
   `onbekend` hoort leeg te zijn; staat er iets in, dan verwijst een profiel naar
   een capability die niet bestaat -- een tikfout die anders pas opvalt als
   iemand er niet in kan. */
function overzicht() {
  return Object.entries(PROFIEL).map(([pas, caps]) => ({
    pas,
    caps: caps.slice(),
    onbekend: caps.filter(c => !CAPS[c])
  }));
}

module.exports = { CAPS, PROFIEL, capsVan, mag, tredenMet, overzicht };
