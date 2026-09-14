/* ============================================================================
   Handgelezen contracten voor de GEZINSDEUR van het Lab-fonds.

   De acht routes op /api/rtf/labfonds/* zijn op 14 september 2026 bijgekomen
   (routes/labfonds.js) en roepen dezelfde kern aan als de ledenkant. Zonder
   uitspraak landen ze in MUTATIECONTRACT.json als
   LEGACY_PENDING_CLASSIFICATION -- de enige stand daar die naar nul moet.

   ELKE REGEL HIERONDER IS GEMETEN EN NIET AANGENOMEN.
   test/rtf-labfonds-deur.test.js roept elke route TWEE keer aan tegen een echte
   server en kijkt daarna in het grootboek. Wat daar uitkwam staat hier, ook waar
   het antwoord "hij telt gewoon op" is: een route die met opzet een tweede
   handeling uitvoert is KLAAR zodra dat vaststaat en bewezen is
   (MUTATIECONTRACT.md). Wat hier NIET staat is een belofte van idempotentie die
   niemand heeft beproefd.

   EN DRIE DINGEN WORDEN HIER MET OPZET UIT ELKAAR GEHOUDEN:

   - `nietHerhaalbaar` -- de tweede aanroep IS een tweede gebeurtenis, en dat is
     de bedoeling. Twee keer tien euro toezeggen is twintig euro toezeggen; een
     fonds dat de tweede negeert, verliest een echte toezegging. Er is ook niets
     recht te zetten, want er ging niets fout.
   - `idempotent` -- de tweede aanroep verandert niets meer. Bij `stem` is dat
     gemeten: dezelfde stem twee keer blijft EEN stem, zodat wie het vaakst klikt
     niet het hardst stemt.
   - `hooguitEens` voor `beslis`, en met opzet NIET `idempotent`. De tweede
     aanroep wordt GEWEIGERD met 409 "Over dit voorstel is al beslist". Naar de
     letter blijft de stand gelijk, maar een herhaling die wordt geweigerd is een
     TOESTANDSCONTROLE en geen idempotentie (MUTATIECONTRACT.md): wie hem
     idempotent noemt, geeft een taakloper toestemming om automatisch opnieuw te
     proberen op iets wat hij nooit ongemerkt mag herhalen.
   ========================================================================== */
'use strict';

/* Alle acht dragen dezelfde poort: gezinsPoort (gezinscode + profieltoken,
   gasten eruit) met de gezinscode als objectveld. Vijf dragen daarnaast
   volwassenGezin; dat is geen TOEGANGSklasse maar een extra eis binnen dezelfde
   klasse, en hij staat daarom in de uitspraak en niet in `toegang`. */
const PROFIEL = { klasse: 'OBJECT_SCOPED', objectVeld: 'code' };
const AFGETEKEND = {
  door: 'gelezen handler plus test/rtf-labfonds-deur.test.js tegen een echte server',
  op: '2026-09-14'
};
const contract = (mutatieId, klasse, uitspraak) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse }, toegang: PROFIEL,
  stand: 'PROTECTED',
  bewijs: { gemeten: 'test/rtf-labfonds-deur.test.js ' + uitspraak, op: '2026-09-14' },
  nagekeken: 'De sleutel in het grootboek is de HANDLE van het profiel ' +
    '(rtf:CODE:pid) en niet de gezinscode: twee profielen uit hetzelfde gezin ' +
    'houden ieder hun eigen bijdrage. Met een mutatie nagetrokken.',
  afgetekend: AFGETEKEND
});

const CONTRACTEN = {
  'POST /api/rtf/labfonds/overzicht': contract('rtf.labfonds.overzicht',
    'idempotent', 'leest het fonds; drie leesrondes achter elkaar bewegen de pot niet'),
  'POST /api/rtf/labfonds/financiering': contract('rtf.labfonds.financiering',
    'idempotent', 'leest wat er aan EEN onderzoek is toegezegd; verandert niets'),
  'POST /api/rtf/labfonds/scheidsrechter': contract('rtf.labfonds.scheidsrechter',
    'idempotent', 'vraagt het oordeel op; herhalen laat het fonds ongemoeid'),
  'POST /api/rtf/labfonds/locatie/maak': contract('rtf.labfonds.locatie.maak',
    'idempotent', 'dezelfde locatie twee keer aanmaken levert er EEN op'),
  'POST /api/rtf/labfonds/doneer': contract('rtf.labfonds.doneer',
    'nietHerhaalbaar', 'twee keer tien toezeggen staat als twintig in het grootboek -- ' +
    'een tweede toezegging IS een tweede toezegging'),
  'POST /api/rtf/labfonds/voorstel/maak': contract('rtf.labfonds.voorstel.maak',
    'nietHerhaalbaar', 'een tweede identiek voorstel krijgt een EIGEN id en staat er als tweede; ' +
    'samenvoegen zou de tweede indiener zijn stem afnemen'),
  'POST /api/rtf/labfonds/stem': contract('rtf.labfonds.stem',
    'idempotent', 'dezelfde stem twee keer blijft EEN stem (voor: 1, tegen: 0)'),
  'POST /api/rtf/labfonds/beslis': contract('rtf.labfonds.beslis',
    'hooguitEens', 'de tweede aanroep wordt GEWEIGERD met 409 "al beslist" -- ' +
    'dat is een grendel en geen idempotentie')
};

module.exports = { CONTRACTEN };
