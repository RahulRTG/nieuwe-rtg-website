/* ============================================================================
   DE BESCHERMZAAK -- de dataklasse, en vooral wat zij WEIGERT.

   WAAROM DIT GEEN CASUS IS. kern/rtfos/casus.js is de hulpvraag: iemand heeft
   iets nodig, wij zoeken er een lokale partner bij, en na afronding staat er
   twee jaar een dossier. Alle drie die eigenschappen zijn bij geweld,
   uitbuiting of vlucht geen functies maar risico's:

     - een partner in dezelfde stad is soms precies de plek waar de dader werkt,
       of waar zijn zus werkt;
     - een adresveld is bij een opvangplek levensgevaarlijk;
     - 730 dagen bewaren is 730 dagen waarin een dossier gevonden kan worden.

   Dus is dit geen strenger afgestelde casus maar een ANDERE DATAKLASSE
   (HDI.md par. 5.2). Het verschil zit niet in instellingen maar hierin: dit
   bestand WEIGERT, het filtert niet. Een aanroeper die een adres meestuurt
   krijgt geen zaak zonder adres -- hij krijgt geen zaak, met de reden erbij.
   Filteren is stil, en stil betekent dat de volgende versie het veld gewoon
   bewaart.

   DE VIJF STANDEN, en ze zijn een KETEN en geen keuzelijst:

     veiligheid     is deze mens nu veilig, en kan iemand meekijken? Meer wordt
                    er in deze stand niet gevraagd. Niets.
     minimaal       alleen wat nodig is om iets te kunnen doen.
     toestemming    expliciet, en per ONTVANGER met naam.
     stabilisatie   er wordt iets geregeld.
     overdracht     gecontroleerd, naar die genoemde ontvanger.
     gesloten       met een uitkomst en een zelfgekozen bewaartermijn.

   WAT ER GEEN VELD VOOR IS, KOMT NERGENS TERECHT. Dat is dezelfde regel als in
   casus.js, en hier strenger: geen adres, geen telefoonnummer, geen naam, geen
   geboortedatum, geen letsel, geen daderomschrijving. Wie een dader wil
   beschrijven, doet dat bij de politie en niet in onze database -- wij zijn
   geen opsporingsdienst en een omschrijving die wij bewaren, kan tegen het
   slachtoffer gebruikt worden zodra iemand hem verkeerd leest.
   ========================================================================== */
'use strict';

const STANDEN = ['veiligheid', 'minimaal', 'toestemming', 'stabilisatie', 'overdracht', 'gesloten'];

/* De keten. Een lege lijst is een eindpunt. Terug naar 'toestemming' is geen
   omweg maar de weg terug: wie zijn toestemming intrekt en later opnieuw ja
   zegt, hoort niet in een dood spoor te belanden. */
const KETEN = {
  veiligheid: ['minimaal'],
  minimaal: ['toestemming', 'gesloten'],
  toestemming: ['stabilisatie', 'gesloten'],
  stabilisatie: ['overdracht', 'toestemming', 'gesloten'],
  overdracht: ['stabilisatie', 'toestemming', 'gesloten'],
  gesloten: []
};

/* De aanleidingen. Bewust grof: dit is wat een medewerker moet weten om de
   juiste hulp te zoeken, en niet wat er is gebeurd. Het verschil tussen
   'seksueel-geweld' en een verslag van wat er is gebeurd, is het verschil
   tussen een werkbare zaak en een dossier dat niemand mag lezen. */
const AANLEIDINGEN = ['huiselijk-geweld', 'seksueel-geweld', 'uitbuiting', 'mensenhandel',
  'stalking', 'eergerelateerd', 'kindveiligheid', 'dakloos', 'anders'];

/* VELDEN DIE DEZE KLASSE WEIGERT, met per veld waarom. Dit is geen zwarte lijst
   die je omzeilt door het anders te noemen -- het is de vangnet-laag onder een
   klasse die deze velden simpelweg niet HEEFT. Hij staat er omdat een
   goedbedoelende aanroeper anders `adres` meestuurt, niets hoort, en denkt dat
   het bewaard is.

   HIJ STAAT ALS PARENLIJST EN NIET ALS OBJECT, EN DAT IS EEN REPARATIE.

   Eerst stond hier `const WEIGERT = { adres: '...', bsn: '...' }`. Leesbaar, en
   toch fout: scripts/afleidbaar.js leest elk objectliteraal in server/ als een
   stel velden dat SAMEN REIST, en bouwt daar een graaf van. Voor die meter zag
   deze weigerlijst er dus uit als een record waarin `geboortedatum` en `bsn`
   naast elkaar wonen. Het gevolg stond in test/afleidbaar.test.js: het bsn werd
   vanuit een codenaam bereikbaar in twee stappen (codenaam -> geboortedatum ->
   bsn), precies de bevinding die op NUL hoort te staan.

   Er was niets gelekt -- er is geen beschermzaak die een bsn draagt, en deze
   lijst zorgt er juist voor dat dat niet kan. Maar de meter had gelijk over wat
   hij zag, en de verleiding was hem een uitzondering te leren. Dat zou de
   verkeerde helft repareren: een meter met een uitzonderingenlijst wordt precies
   zo blind als de fout die hij moest vinden. De VORM was fout. Een weigerlijst
   is een lijst van paren en geen record, en zo staat hij er nu.

   Wie hier een veld bijzet: houd de parenvorm aan. Een object met veldnamen als
   sleutels zet de meter opnieuw op rood, en de volgende lezer weet dan niet meer
   of het een vals alarm is of een echt lek. */
const WEIGERT_LIJST = [
  ['adres', 'Een beschermzaak heeft geen adresveld. Een opvangadres in een database is de kortste weg van een dossier naar een voordeur.'],
  ['straat', 'Zie adres.'],
  ['postcode', 'Ook een postcode wijst een plek aan; in een klein dorp wijst hij een huis aan.'],
  ['huisnummer', 'Zie adres.'],
  ['woonplaats', 'Zie adres. De stad van de zaak staat al vast en is genoeg om hulp te zoeken.'],
  ['telefoon', 'Contactgegevens horen in de kluis van de organisatie die de hulp geeft, niet in deze zaak.'],
  ['email', 'Zie telefoon.'],
  ['naam', 'Deze klasse draait op een codenaam. De naam staat in de kluis, en wie hem nodig heeft opent hem daar.'],
  ['achternaam', 'Zie naam.'],
  ['geboortedatum', 'Een geboortedatum naast een codenaam voert die codenaam terug naar een mens.'],
  ['bsn', 'Nooit. Niet hier, en niet in een veld dat er anders heet.'],
  ['dader', 'Wij zijn geen opsporingsdienst. Een daderomschrijving die wij bewaren, kan tegen het slachtoffer gebruikt worden zodra iemand hem verkeerd leest.'],
  ['letsel', 'Medische gegevens horen bij een behandelaar. Wij noteren dat er hulp nodig is, niet wat er te zien was.'],
  ['zoek', 'Deze klasse kent geen vrije zoekfunctie. Wie een zaak zoekt, kent zijn codenaam; een zoekveld over deze zaken is een zeef waarmee je mensen vindt.']
];
/* Een Map en geen object: hetzelfde opzoeken, zonder dat er ergens een literaal
   met veldnamen als sleutels ontstaat. */
const WEIGERT = new Map(WEIGERT_LIJST);

/* De poort die WEIGERT in plaats van filtert. Hij kijkt naar de sleutels die
   binnenkomen, niet naar wat wij ervan overnemen -- dat is het hele punt. */
function keurInvoer(b) {
  for (const sleutel of Object.keys(b || {})) {
    const reden = WEIGERT.get(sleutel.toLowerCase());
    if (reden) {
      return { status: 400, error: 'Het veld "' + sleutel + '" bestaat niet in een beschermzaak. ' + reden };
    }
  }
  return null;
}

/* HET BEELD IN EEN LIJST DRAAGT GEEN INHOUD. Codenaam, stand, aanleiding en
   datum -- en niet `wat`. Wie de zaak wil lezen, opent hem apart, en dat laat
   een auditregel achter (zie ./index.js). Een lijst die de omschrijving toont,
   is een lijst die op een gedeeld scherm in een buurthuis wordt opengelaten. */
const lijstbeeld = z => ({
  id: z.id, codenaam: z.codenaam, stad: z.stad, aanleiding: z.aanleiding,
  stand: z.stand, at: z.at, bijgewerkt: z.bijgewerkt || z.at,
  toestemmingStaat: !!(z.toestemming && !z.ingetrokken),
  gesloten: z.gesloten || null
});

/* Het volledige beeld, alleen na een expliciete opening. Ook hier geen contact
   en geen plek: die bestaan niet in deze klasse. */
const beeld = z => Object.assign(lijstbeeld(z), {
  wat: z.wat,
  veiligheid: z.veiligheid || null,
  toestemming: z.toestemming ? { at: z.toestemming.at, ontvanger: z.toestemming.ontvanger, tekst: z.toestemming.tekst } : null,
  ingetrokken: z.ingetrokken ? { at: z.ingetrokken.at, reden: z.ingetrokken.reden } : null,
  overdrachten: (z.overdrachten || []).slice(0, 20),
  /* Alleen de IDs van de meldcode-dossiers die hieruit zijn ontstaan. Wie er een
     wil lezen, opent hem daar -- en dat laat zijn eigen spoor na. */
  meldcodes: (z.meldcodes || []).slice(0, 10),
  stappen: (z.stappen || []).slice(0, 40),
  bewaarTot: z.bewaarTot || null
});

module.exports = { STANDEN, KETEN, AANLEIDINGEN, WEIGERT, WEIGERT_LIJST, keurInvoer, beeld, lijstbeeld };
