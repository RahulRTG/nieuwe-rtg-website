/* Onderneming-deelmodule "zaakkant": de onderneming zoals de WERKVLOER haar mag
   kennen.

   WAAROM DIT BESTAAT. `scripts/ondernemerslus.js` meet of de ondernemerslus EEN
   onderwerp draagt, en zijn kopgetal `zaakZietOnderneming` stond op nul: geen
   enkel bestand onder routes/supplier/ of routes/staff/ kende het
   ondernemingsobject. De lus liep dus eenrichtingsverkeer de verkeerde kant op
   -- kern/onderneming kent de zaak (hij heeft `vanZaak` en `koppel`), maar de
   zaak wist niet dat hij een onderneming HAD. Station 11 kon niet weten waar
   station 2 het over had.

   DE BRUG LOOPT EEN KANT OP, EN DAT IS EEN BESLUIT VAN DE EIGENAAR. De
   werkvloer krijgt context uit het ondernemingsobject; het ondernemingsobject
   trekt daardoor niets operationeels terug. Dat is dezelfde regel als bij
   kern/mobiliteit/appbrug.js, en om dezelfde reden: twee lijsten die elkaar
   bijwerken hebben geen waarheid meer. Deze module LEEST en schrijft niets.

   DE PROJECTIE WORDT OPGEBOUWD UIT EEN POSITIEVE LIJST, nooit uit het hele
   beeld met velden eraf. Dat gaat over RICHTING en niet over stijl, en de regel
   staat al in dit huis (AI-CONTEXT-01): bij `{ ...beeld }` gevolgd door
   `delete` passeert elk NIEUW veld van ondernemingBeeld() vanzelf deze grens,
   bij `{ naam: beeld.naam }` blijft elk nieuw veld buiten tot iemand het er
   bewust bij zet. ondernemingBeeld() groeit mee met het ondernemersdomein; deze
   view hoort niet vanzelf mee te groeien.

   WAT ER NIET IN ZIT STAAT IN HET ANTWOORD, MET DE REDEN. Een leeg vak wordt
   gevuld met iemands eigen indruk (SERVICE.md par. 12). `nietGedeeld` is dus
   geen documentatie maar onderdeel van het antwoord: wie op de vloer dit scherm
   leest, ziet wat het NIET zegt even groot als wat het wel zegt.

   EN ER KOMT GEEN TWEEDE RECHTENMODEL BIJ. Deze view is voor IEDEREEN op de
   leveranciersessie hetzelfde -- de afwasser en de eigenaar krijgen dezelfde
   regels. Hij is daarom versmald tot wat veilig is voor de minst bevoegde mens
   die hier binnenkomt. De eigenaar die meer wil zien, gebruikt zijn EIGEN
   ledenroutes (/api/onderneming/*), waar hij als eigenaar bekend is. Een
   rolafhankelijke variant hier zou een derde rechtenmodel zijn naast de
   ledenkant en de zaakrollen, en dat is precies wat CONCERN.md tegenhoudt. */
'use strict';

/* WAT DEZE VIEW BEWUST NIET DRAAGT. De lijst staat hier als DATA en niet als
   commentaar, want hij gaat mee in het antwoord: een grens die de lezer niet
   ziet, is voor hem geen grens maar een gat. */
const NIET_GEDEELD = [
  { veld: 'eigenaar',
    reden: 'wie deze onderneming bezit is een mens, en die hoort niet op het scherm van de ploeg.' },
  { veld: 'kvk',
    reden: 'een inschrijvingsnummer voert via een openbaar register terug naar een echte naam -- ' +
      'dezelfde reden waarom het documentnummer uit kern/vakbewijs.js in de identiteitskluis woont ' +
      'en niet naast een codenaam.' },
  { veld: 'feiten',
    reden: 'klanten, personeel en vestigingen zijn bedrijfscijfers. De vloer krijgt context, geen ' +
      'boekhouding.' },
  { veld: 'volgende',
    reden: 'de volgende stap is advies aan de ONDERNEMER over zijn bedrijf, niet aan zijn ploeg.' },
  { veld: 'bestuur',
    reden: 'bestuurders en aandeelhouders hangen aan de onderneming en niet aan de zaak; die vraag ' +
      'loopt langs ondernemingBestuur() op de ledenkant.' },
  { veld: 'plan',
    reden: 'het ondernemingsplan is het denkwerk van de ondernemer en geen werkinstructie.' }
];

module.exports = ({ vanZaak, ondernemingBeeld }) => {

  /* De onderneming achter DEZE zaak, versmald tot wat de werkvloer mag zien.
     Geeft altijd een antwoord: is er geen koppeling, dan zegt hij dat mét de
     reden en met de weg ernaartoe -- null met stilte eromheen leest als een
     storing (dezelfde regel als `geweerd` in ./beeld.js). */
  function ondernemingAchterZaak(code) {
    const o = vanZaak(code);
    if (!o) return {
      ok: true,
      onderneming: null,
      reden: 'Deze zaak is niet aan een onderneming gekoppeld. Dat doet de eigenaar zelf, vanuit zijn ' +
        'eigen account (/api/onderneming/koppel); de zaak kan zichzelf niet koppelen.',
      nietGedeeld: NIET_GEDEELD
    };

    const beeld = ondernemingBeeld(o);
    if (!beeld) return {
      ok: true,
      onderneming: null,
      reden: 'De onderneming achter deze zaak is niet te lezen.',
      nietGedeeld: NIET_GEDEELD
    };

    /* De fase zelf WEL, de ladder eronder niet: de trede verklaart waarom de
       ploeg bepaalde onderdelen wel of niet ziet, de ladder zou de bereikte
       mijlpalen (en daarmee een grove vorm van de klantcijfers) alsnog
       prijsgeven. */
    const trede = (beeld.ladder || []).find(f => f.id === beeld.fase) || null;

    return {
      ok: true,
      onderneming: {
        id: beeld.id,
        naam: beeld.naam,
        fase: beeld.fase ? { id: beeld.fase, label: trede ? trede.label : null } : null,
        rechtsvorm: beeld.rechtsvorm ? { kort: beeld.rechtsvorm.kort, label: beeld.rechtsvorm.label } : null,
        caps: beeld.caps || [],
        /* Mét de reden, net als op de ledenkant: een knop die zonder uitleg
           ontbreekt leest als een storing. */
        geweerd: beeld.geweerd || [],
        werkvormen: beeld.werkvormen || []
      },
      nietGedeeld: NIET_GEDEELD
    };
  }

  return { ondernemingAchterZaak, NIET_GEDEELD };
};
