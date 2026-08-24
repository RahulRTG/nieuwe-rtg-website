/* DE VEILIGE NOODSTAND -- de stand die BESCHERMT in plaats van uitzet.

   WAAROM HIJ ER MOEST KOMEN. kern/incidentcontrole.js kende drie standen en
   alle drie zetten iets UIT: waakzaam (niets uit, alleen gemarkeerd), beperkt
   (deze functies uit) en isolatie (alles uit plus de hoofdzekering). Wat er
   ontbrak is de stand uit BESTUUR.md grens 6.10: "Een noodknop die alles
   platlegt, wordt niet gebruikt." Een organisatie platleggen om haar te
   beschermen is bijna altijd duurder dan de storing -- dus staat er onder druk
   iemand te aarzelen tussen niets doen en alles dichtgooien, en dat is precies
   het moment waarop je een derde knop wilt hebben.

   DE METHODE IS HIER HET VERKEERDE SIGNAAL, en dat is gemeten en niet gevoeld.
   De eerste vorm van deze stand was "elke niet-GET wordt tegengehouden, lezen
   loopt door". In dit huis staan 3728 POST-routes tegenover 35 GET-routes: het
   lezen gaat hier grotendeels óók per POST. Die regel zou dus alles hebben
   tegengehouden, en dan is het isolatie met een vriendelijkere naam -- exact de
   knop die volgens 6.10 niet gebruikt wordt.

   DE REGEL IS DAAROM: PER CATEGORIE BEVRIEZEN, MET EEN GESLOTEN LIJST
   UITZONDERINGEN. Zes van de zestien categorieën dragen wat 6.10 bedoelt met
   "nieuwe bevoorrechte handelingen" en "mutaties van derden"; de andere tien
   werken door. Binnen een bevroren categorie loopt een GET altijd door, en
   loopt een handvol met naam genoemde functies door omdat ze stilzetten duurder
   is dan de storing.

   DRIE FAIL-FASTS, en ze staan er alle drie om dezelfde reden: een lijst die
   stil verkeerd wordt, is erger dan geen lijst.

   1. ELKE CATEGORIE STAAT IN PRECIES EEN VAN BEIDE EMMERS. Een nieuwe categorie
      in de functiecatalogus laat deze module bij het laden omvallen in plaats
      van stilzwijgend door te lopen. Dat is de goede kant om fout te gaan:
      een nieuwe categorie die niemand indeelde, hoort niet vanzelf te blijven
      schrijven tijdens een incident.
   2. ELKE UITZONDERING BESTAAT. Wordt `tg-inlog` ooit hernoemd, dan valt deze
      module om bij het starten. Zonder deze controle zou de uitzondering stil
      verdwijnen en zou de beschermstand het INLOGGEN bevriezen -- en dan is
      "lezen loopt door" een zin zonder inhoud, want je komt er niet meer in.
   3. ELKE UITZONDERING ZIT IN EEN BEVROREN CATEGORIE. Een uitzondering op een
      categorie die toch al doorloopt, is dode tekst die de lezer laat denken
      dat er iets geregeld is.

   De indeling zelf staat in ./beschermstand-lijst.js, met per categorie de
   reden erbij. */
'use strict';

const { BEVRIEST, LOOPT_DOOR, UITZONDERINGEN, onderdelen } = require('./beschermstand-lijst');

/* ---------- de fail-fasts, bij het laden en niet bij het eerste incident ---------- */
function keurIn(functies) {
  const lijst = functies.FUNCTIES || [];
  const categorieën = [...new Set(lijst.map(f => f.categorie))];
  const dubbel = categorieën.filter(c => BEVRIEST[c] && LOOPT_DOOR[c]);
  if (dubbel.length) throw new Error('beschermstand: "' + dubbel.join(', ') + '" staat zowel op de ' +
    'bevroren als op de doorlopende lijst. Een categorie hoort in precies één emmer.');
  const nergens = categorieën.filter(c => !BEVRIEST[c] && !LOOPT_DOOR[c]);
  if (nergens.length) throw new Error('beschermstand: de categorie "' + nergens.join(', ') + '" is ' +
    'niet ingedeeld. Zet hem in BEVRIEST of in LOOPT_DOOR, met de reden erbij -- een categorie die ' +
    'niemand indeelde, hoort tijdens een incident niet vanzelf te blijven schrijven.');
  const verzonnen = Object.keys(UITZONDERINGEN).filter(id => !lijst.some(f => f.id === id));
  if (verzonnen.length) throw new Error('beschermstand: de uitzondering "' + verzonnen.join(', ') +
    '" bestaat niet (meer) in de functiecatalogus. Zonder deze controle zou hij stil verdwijnen, ' +
    'en dan bevriest de beschermstand iets wat juist door moet lopen.');
  const overbodig = Object.keys(UITZONDERINGEN).filter(id => {
    const f = lijst.find(x => x.id === id);
    return f && !BEVRIEST[f.categorie];
  });
  if (overbodig.length) throw new Error('beschermstand: de uitzondering "' + overbodig.join(', ') +
    '" zit in een categorie die toch al doorloopt. Dat leest als iets wat geregeld is en regelt niets.');
  return categorieën.length;
}

/* ---------- de beslissing zelf ---------- */
function maakBeschermstand({ functies }) {
  const categorieën = keurIn(functies);

  /* Geeft null (laat door) of een reden (houd tegen). De aanroeper weet de
     modus; deze module beslist niet OF de stand aanstaat maar wat hij betekent. */
  function houdtTegen(pad, methode) {
    if (/^(GET|HEAD|OPTIONS)$/i.test(String(methode || ''))) return null;
    const f = functies.functieVoorPad(pad);
    /* Geen functie achter dit pad: dan valt er ook niets in te delen, en een pad
       tegenhouden op grond van niets is raden. De schakelkast heeft dezelfde
       regel; wie dat wil dichtzetten, doet dat met de functiecatalogus. */
    if (!f) return null;
    if (!BEVRIEST[f.categorie]) return null;
    if (UITZONDERINGEN[f.id]) return null;
    return { functie: f.id, naam: f.naam, categorie: f.categorie, waarom: BEVRIEST[f.categorie] };
  }

  return { houdtTegen, onderdelen, BEVRIEST, LOOPT_DOOR, UITZONDERINGEN, categorieën };
}

module.exports = { maakBeschermstand, onderdelen, BEVRIEST, LOOPT_DOOR, UITZONDERINGEN };
