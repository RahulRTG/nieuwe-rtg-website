/* ============================================================================
   HET SEMANTISCHE IDENTITEITSCONTRACT PER CAPABILITY.

   WAT DIT IS, EN WAT HET NADRUKKELIJK NIET IS.

   `./idemsleutels.js` verklaart per ROUTE wat hetzelfde verzoek is. Dat werkt
   zolang een handeling precies een ingang heeft. Zodra dezelfde opdracht ook
   via Rahul, een wachtrij of een partner binnenkomt, is "dezelfde route met
   hetzelfde lijf" geen bruikbare vraag meer -- dan gaat het om de BETEKENIS van
   de handeling.

   Dit bestand verandert GEEN gedrag. Het declareert wat de code vandaag al doet
   en op dit moment per handeling met de hand herontdekt. Dat omdraaien is het
   hele punt: wat in een handler staat kan niemand van buiten die handler lezen,
   en een tweede transport erft het niet.

   ------------------------------------------------------------------------
   DRIE ASSEN, EN ZE WORDEN MET OPZET NIET SAMENGEPERST

     identiteit   hoe herkennen we dezelfde opdracht
     herhaling    wat betekent het om hem opnieuw uit te voeren
     levering     welke garantie heeft een transport nodig

   De verleiding is een enkele enum. Dat breekt precies bij een transportwissel,
   en dit huis draagt daar al een litteken van: `magHerhalen()` in
   ../kern/mutatie.js geeft `false` voor vier klassen die voor een wachtrij
   TEGENGESTELD zijn -- `hooguitEens` ("haal er een mens bij") is iets anders dan
   `nietHerhaalbaar` ("opnieuw is precies de bedoeling"). Een consumer die die
   boolean leest, kan die twee niet uit elkaar houden.

   ------------------------------------------------------------------------
   DE KERNREGEL

     Een capability mag zijn semantische identiteit alleen NAUWER definieren dan
     het bestaande transportgedrag; nooit breder, tenzij bewezen is dat
     inhoudelijk gelijke verzoeken werkelijk dezelfde handeling zijn.

   Verbreden slikt een geldige tweede opdracht op, en dat valt niemand op --
   een dubbele boeking wel, een verdwenen boeking niet.

   ------------------------------------------------------------------------
   CANONIEKE TYPES: EEN KLEINE GESLOTEN LIJST, GEEN HEURISTIEK

   Canonicalisatie hoort bij de BETEKENIS van een veld en niet bij zijn
   javascript-type. Een generieke trim() of toLowerCase() over elke string laat
   de infrastructuur businessbetekenis verzinnen: voor een valuta is uppercase
   canoniek, voor een wachtwoordhint is dat verlies. Kan een capability geen
   veilige canonicalisatie benoemen, dan blijft de waarde EXACT -- dat is de
   standaard en niet de uitzondering. */
'use strict';

/* De gesloten lijst. Elke waarde noemt wat hij doet en waarom dat veilig is;
   staat een veld hier niet in, dan is het `exact`. */
const CANONIEK = {
  /* Een geldbedrag naar hele centen. Dit is de enige canonicalisatie in dit
     bestand die vandaag al ECHT gebeurt: /api/supplier/betaalverzoek accepteert
     `centen` en `bedrag` en rekent beide om, dus die twee vormen zijn nu al
     dezelfde opdracht. */
  geldbedrag: v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Math.round(Number(v)),
  /* Een valutacode. Uppercase is hier canoniek omdat ISO 4217 dat is. */
  valuta: v => (typeof v === 'string' && v.trim()) ? v.trim().toUpperCase() : null,
  /* Een ondoorzichtige verwijzing (ref, id, codenaam). Geen hoofdletterregel:
     een codenaam is een sleutel en geen woord. Alleen de randen eraf. */
  opaqueId: v => (typeof v === 'string' && v.trim()) ? v.trim() : (v == null ? null : String(v)),
  /* De standaard, en met opzet de saaiste: laat de waarde staan. */
  exact: v => (v === undefined ? null : v)
};

/* De drie identiteitsmodi. Ze zeggen WIE bepaalt dat twee opdrachten dezelfde
   zijn, niet HOE streng dat is. */
const IDENTITEITSMODI = {
  /* De aanroeper beslist: een verse sleutel is een nieuwe bewuste opdracht, en
     de afgeleide identiteit mag daar nooit overheen walsen. Dit is geen
     voorkeur maar een litteken: bij `bank/pas/uitgeven` besliste ooit de
     vingerafdruk van het lijf, en een lid dat bewust een TWEEDE pas aanvroeg
     kreeg het antwoord van de eerste terug. Zie de kop van
     ./idem-sleutelbepaling.js. */
  CLIENT_KEY_AUTHORITATIVE: 'de sleutel van de aanroeper wint van de inhoud',
  /* RTG mag de identiteit uit de inhoud afleiden. Alleen waar bewezen is dat
     inhoudelijk gelijke verzoeken werkelijk dezelfde handeling zijn. */
  DERIVED_IDENTITY: 'de inhoud bepaalt de identiteit',
  /* Er is geen afgeleide identiteit. Zegt op zichzelf NIETS over of herhalen
     mag -- daarvoor is de herhalingsas, en juist bij deze modus lopen die twee
     het snelst door elkaar. */
  NO_IDENTITY: 'geen afgeleide identiteit'
};

/* De herhalingsas: wat betekent opnieuw uitvoeren. */
const HERHALING = {
  VEILIG: 'er verandert niets, herhalen is per definitie veilig',
  ZELFDE_SLEUTEL_VEREIST: 'een herhaling met dezelfde sleutel is een weergave; met een verse sleutel een tweede handeling',
  TWEEDE_HANDELING: 'herhalen levert een echte tweede gebeurtenis op, en dat is de bedoeling'
};

/* De leveringsas: welke garantie heeft een transport nodig. Bewust apart van de
   herhalingsas, want `herhaalbaar: false` zegt een wachtrij niet of hij het
   opnieuw mag proberen of er een mens bij moet halen. */
const LEVERING = {
  HERPROBEREN_MAG: 'een transport mag opnieuw afleveren, mits dezelfde sleutel meegaat',
  MENS_ERBIJ: 'niet automatisch opnieuw afleveren; eerst navragen wat er gebeurd is'
};

/* De verklaringen wonen apart; zie ./idem-contract-verklaringen.js. */
const { CONTRACTEN } = require('./idem-contract-verklaringen');

/* De identiteit van een opdracht volgens haar contract. Geeft `null` als er
   geen contract is -- een ontbrekend contract is geen lege identiteit, en die
   twee door elkaar halen zou elke onverklaarde handeling met elke andere
   samenvallen. */
function identiteitVan(capability, lijf) {
  const c = CONTRACTEN[capability];
  if (!c) return null;
  const id = c.identiteit;
  if (id.modus === 'NO_IDENTITY') return null;
  const uit = {};
  for (const veld of id.velden) {
    let waarde = lijf ? lijf[veld] : undefined;
    if (waarde === undefined && id.standaarden && veld in id.standaarden) waarde = id.standaarden[veld];
    const soort = (id.canoniek && id.canoniek[veld]) || 'exact';
    uit[veld] = (CANONIEK[soort] || CANONIEK.exact)(waarde);
  }
  const vorm = id.vorm;
  if (!vorm) return capability + '|' + id.velden.map(v => JSON.stringify(uit[v])).join('|');
  const stuk = v => vorm.waarde === 'ruw' ? String(uit[v] == null ? '' : uit[v]) : JSON.stringify(uit[v]);
  return vorm.voorvoegsel + vorm.scheiding + id.velden.map(stuk).join(vorm.scheiding);
}

module.exports = { CANONIEK, IDENTITEITSMODI, HERHALING, LEVERING, CONTRACTEN, identiteitVan };
