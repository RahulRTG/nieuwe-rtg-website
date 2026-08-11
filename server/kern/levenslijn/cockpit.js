/* Levenslijn, deelbestand "cockpit": het levens-command-center (LEVEN.md
   par. 1.5).

   Drie vragen, en verder rust: hoe sta ik ervoor, wat komt eraan, moet ik
   iets doen. Dezelfde vorm als de cockpit van RTG Geld, met EEN verschil dat
   in LEVEN.md par. 0 staat en hier het hele ontwerp bepaalt: deze wereld
   voert niets uit. Er zijn twee niveaus, 'kijken' en 'openen', en zelfs
   'openen' wijst alleen een deur aan. Een derde niveau dat handelt bestaat
   niet en hoort hier nooit bij te komen.

   WAT HIER GEEN UITZONDERING IS, en dat is de moeilijkste keuze in dit
   bestand: een fase die NIET speelt. Geen studie, geen kinderen, geen
   pensioen -- dat is geen ontbrekend iets, dat is een leven dat anders loopt
   (LEVEN.md par. 1.1). Alleen datums die het lid ZELF ergens heeft ingevuld
   worden hier een regel, want die heeft hij bedoeld als afspraak met zichzelf.
   Wie ooit "u heeft nog geen X" als kaart wil toevoegen, leest eerst par. 2.2:
   het platform mag nooit de reden zijn dat iemand zich tekort voelt schieten. */
'use strict';

/* De vensters van de Control Tower, oplopend. Alleen de eerste twee halen de
   cockpit: wat achterstallig is en wat deze week speelt. De rest staat op de
   lijn zelf -- een cockpit die alles toont is een lijst, en dan is er geen
   uitzondering meer (uitzonderingsgestuurd, ONTWERP.md). */
const DRINGEND = new Set(['achterstallig', 'week']);

const UUR = { ochtend: 'Goedemorgen', middag: 'Goedemiddag', avond: 'Goedenavond' };

function groetVan(uur, fase) {
  const deel = uur < 12 ? 'ochtend' : uur < 18 ? 'middag' : 'avond';
  return { fase: fase ? fase.naam : '', zin: UUR[deel] };
}

/* Een termijn wordt een uitzondering. De gegevens-regels zijn de
   verantwoording (LEVEN.md par. 2.10): waar komt dit vandaan, en wanneer.
   Ze noemen de BRON en niet de mens -- er staat nooit een oordeel in. */
function uitTermijn(t) {
  const gegevens = [t.bron + ': ' + t.titel];
  if (t.wanneer) gegevens.push(t.bron + ': datum ' + t.wanneer);
  if (Number.isFinite(t.dagen)) {
    gegevens.push(t.dagen < 0
      ? 'termijnen: ' + Math.abs(t.dagen) + ' dagen verlopen'
      : 'termijnen: over ' + t.dagen + ' dagen');
  }
  return {
    id: t.id,
    soort: t.venster === 'achterstallig' ? 'achterstallig' : 'komt',
    titel: t.titel,
    wanneer: t.wanneer || null,
    uitleg: t.dagen < 0
      ? 'Deze datum is voorbij. Er gebeurt niets vanzelf; u beslist wat ermee moet.'
      : 'Dit komt eraan. Het staat hier zodat u het niet op de verkeerde dag tegenkomt.',
    gegevens,
    /* ALTIJD 'kijken' zolang de termijn geen deur heeft. De motor van de
       levensgraaf draagt wel de naam van de bron-app mee maar geen adres, en
       een knop die nergens uitkomt is erger dan geen knop -- die fout stond
       vandaag nog in de geldcockpit (een actie naar een stand die niet
       bestond). Krijgt een termijn ooit een echt adres mee, dan wordt dit
       'openen' met een opening erbij, en geen dag eerder. */
    niveau: 'kijken',
    opening: null
  };
}

/* Achterstallig eerst, dan wat het dichtstbij is. Binnen dezelfde dag op
   titel, zodat de volgorde niet per aanroep verspringt -- een cockpit die
   danst leest als iets nieuws terwijl er niets veranderd is. */
function rangschik(rijen) {
  return rijen.sort((a, b) => {
    const av = a.soort === 'achterstallig' ? 0 : 1;
    const bv = b.soort === 'achterstallig' ? 0 : 1;
    if (av !== bv) return av - bv;
    return String(a.wanneer || '9999').localeCompare(String(b.wanneer || '9999')) ||
      String(a.titel).localeCompare(String(b.titel));
  });
}

module.exports = ({ feiten }) => {

  function cockpit(key) {
    const f = feiten(key);

    const dringend = f.achterstallig.concat(f.komt.filter(t => DRINGEND.has(t.venster)));
    const uitzonderingen = rangschik(dringend.map(uitTermijn));

    const huidige = (f.lijn.fasen || []).find(x => x.id === (f.lijn.nu && f.lijn.nu.faseId)) || null;

    return {
      groet: groetVan(new Date().getHours(), huidige),
      telling: f.telling,
      uitzonderingen,
      lijn: f.lijn,
      /* De stille bronnen reizen mee tot in het scherm. Een levensbeeld met
         een gat erin dat er compleet uitziet, is het gevaarlijkste dat deze
         laag kan opleveren: dan denkt iemand dat er niets speelt. */
      stil: f.stil,
      bronnen: f.bronnen
    };
  }

  return { cockpit };
};
