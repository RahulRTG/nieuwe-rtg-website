/* RTG School: de taallaag -- niet overal een vertaalknop.

   Het hele punt van deze laag staat in een zin: TAAL LEREN is iets anders dan
   LEREN ONDANKS EEN TAALBARRIERE. Bij Nederlands is de taal zelf wat je meet;
   vertaal je de opgave volledig, dan meet je niets meer. Bij wiskunde en
   natuurkunde meet je het concept, en dan is thuistaalsteun gewoon hulp.

   Drie standen van steun:

     volledig   -- de les en de uitleg mogen in de thuistaal ernaast staan;
     instructie -- alleen de VRAAGSTELLING mag mee ("vul in", "wat is de stam"),
                   de te meten inhoud blijft in het Nederlands;
     geen       -- geen thuistaal bij deze stof.

   Het Nederlands verdwijnt nooit. Steun staat ERNAAST en vervangt niets: naast
   elkaar lezen is precies hoe je een taal erbij leert (zie school/taal.js).

   DE HARDE REGEL. Een school mag dit beleid aanpassen -- scholen verschillen,
   en wie hier lesgeeft weet beter wat zijn kinderen nodig hebben. Maar bij de
   taalvakken kan het NOOIT op 'volledig'. Dat is geen instelling maar de
   meting zelf: een school die dat aanzet, meet vanaf dat moment niets meer en
   merkt het pas bij het examen. Vandaar dat het hier staat en niet in een
   schermpje met een schuifje. */
const STANDEN = ['geen', 'instructie', 'volledig'];

/* De vakken waar de TAAL het onderwerp is. Bij deze vakken is 'instructie' het
   maximum, wat de school ook instelt. */
const TAALVAKKEN = ['taal', 'nederlands', 'engels', 'duits', 'frans', 'spaans', 'latijn', 'grieks'];

/* De standaard per vak. Concepten mogen volledig; wat over taal gaat niet.
   Onbekende vakken vallen op 'instructie' terug: dat is de veilige middenweg,
   want een vak dat we niet kennen kan een taalvak zijn. */
const STANDAARD = {
  rekenen: 'volledig', wiskunde: 'volledig', natuurkunde: 'volledig', scheikunde: 'volledig',
  biologie: 'volledig', natuur: 'volledig', economie: 'volledig', aardrijkskunde: 'volledig',
  geschiedenis: 'volledig', verkeer: 'volledig', techniek: 'volledig', informatica: 'volledig',
  burgerschap: 'volledig', rekenen_vo: 'volledig'
};
const TERUGVAL = 'instructie';

const isTaalvak = (vak) => TAALVAKKEN.includes(String(vak || '').toLowerCase().trim());

/* Het maximum dat een vak toestaat. Hier zit de harde regel: bij een taalvak
   komt er nooit 'volledig' uit, ook niet als de school dat instelt. */
function maximum(vak) {
  return isTaalvak(vak) ? 'instructie' : 'volledig';
}

/* Wat mag er voor dit vak, gegeven het beleid van de school. Het beleid kan
   alleen NAAR BENEDEN afwijken van wat het vak toestaat. */
function steunVoor(vak, beleid) {
  const naam = String(vak || '').toLowerCase().trim();
  const gevraagd = beleid && STANDEN.includes(beleid[naam]) ? beleid[naam] : (STANDAARD[naam] || TERUGVAL);
  const max = maximum(naam);
  return STANDEN.indexOf(gevraagd) > STANDEN.indexOf(max) ? max : gevraagd;
}

/* De uitleg erbij, want een leerling die geen vertaling krijgt hoort te weten
   waarom -- anders voelt het als een deur die voor hem dichtgaat. */
function reden(vak) {
  return isTaalvak(vak)
    ? 'Bij dit vak is de taal zelf wat je leert. De opgave blijft daarom in het Nederlands; alleen de vraagstelling mag ernaast in je eigen taal.'
    : 'Bij dit vak gaat het om het idee en niet om de taal. Je eigen taal mag er daarom volledig naast staan.';
}

/* Het beleid dat een school opgeeft, geschoond. Onbekende vakken en onbekende
   standen vallen eruit; het maximum wordt hier al toegepast, zodat er niets
   wordt opgeslagen wat niet mag. */
function schoonBeleid(rauw) {
  const uit = {};
  for (const [vak, stand] of Object.entries(rauw && typeof rauw === 'object' ? rauw : {}).slice(0, 60)) {
    const naam = String(vak).toLowerCase().trim().slice(0, 40);
    if (!naam || !STANDEN.includes(stand)) continue;
    const max = maximum(naam);
    uit[naam] = STANDEN.indexOf(stand) > STANDEN.indexOf(max) ? max : stand;
  }
  return uit;
}

module.exports = { steunVoor, maximum, reden, schoonBeleid, isTaalvak, STANDEN, TAALVAKKEN, STANDAARD, TERUGVAL };
