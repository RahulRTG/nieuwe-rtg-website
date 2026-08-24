/* Horeca (kern): WAT RAHUL MAG -- het register van handelingen en hun laag.

   De horeca kende twee rechten: `supplierAuth` (bent u van deze zaak) en
   `managerOnly` (bent u de baas). Dat is genoeg voor een MENS achter een scherm
   en veel te grof voor een AI die handelingen voorstelt. "Mag Rahul dit" is
   namelijk geen vraag over wie hij is, maar over WAT de handeling doet.

   VIER LAGEN, en de volgorde is de strengheid:

     verboden       nooit, ook niet als voorstel. Er bestaat geen instelling die
                    dit aanzet, en er is geen knop waarmee een manager het
                    alsnog goedkeurt -- want een voorstel dat een mens moet
                    afwijzen, is al een duw in een richting die niet mag.
     mensbevestigt  Rahul mag het VOORBEREIDEN; een mens bevestigt. Het voorstel
                    verandert niets: pas de bevestiging doet iets.
     mag            Rahul mag het uitvoeren, met een actiebon.
     onbekend       valt terug op `mensbevestigt`. Een handeling die hier niet
                    staat, is niet vrijgegeven -- dat is de veilige kant, en het
                    is ook de enige kant die klopt: iets wat niemand heeft
                    beoordeeld, hoort niet zelfstandig te gebeuren.

   DE ZES UIT DE OPDRACHT staan hieronder, en waar ze staan is een besluit:

   - een medewerker beoordelen -> VERBODEN. Grens 5 zegt dat er geen ranglijst
     op mensen komt; een AI-oordeel over een medewerker is die ranglijst, alleen
     dan met één regel.
   - alcoholbeperkingen negeren -> VERBODEN. Er bestaat geen situatie waarin dat
     legitiem is, dus ook geen voorstel.
   - een allergie aanpassen -> mensbevestigt, en bij de pas nog een keer. Grens
     1: generatieve AI bepaalt nooit of iets veilig is om te eten.
   - een betaling uitvoeren -> mensbevestigt. Geld verlaat het huis nooit
     vanzelf (GELD.md).
   - voorraadverschillen wegboeken -> mensbevestigt. Een verschil dat vanzelf
     verdwijnt, is een diefstal die niemand ziet.
   - een hoge korting toekennen -> mensbevestigt BOVEN de grens van de zaak. En
     zolang die grens niet is ingesteld, geldt hij voor ELKE korting: een
     drempel verzinnen zou hier een getal maken dat niemand heeft afgesproken
     (HORECA.md, grens 7).

   WAT ER NIET IN STAAT, staat er niet omdat het onbelangrijk is maar omdat het
   dan automatisch `mensbevestigt` is. Toevoegen mag; stilzwijgend vrijgeven
   niet. */
'use strict';

const HANDELINGEN = {
  /* ---- lezen en samenstellen: dit mag ---- */
  'werklijst.samenvatten': { laag: 'mag', wat: 'de werklijst samenvatten',
    waarom: 'Alleen lezen en herformuleren; er verandert niets aan de zaak.' },
  'gang.voorstellen': { laag: 'mag', wat: 'een gang voorstellen om vrij te geven',
    waarom: 'Een voorstel op het scherm; vrijgeven blijft een tik van de zaal.' },
  'mise.adviseren': { laag: 'mag', wat: 'mise-en-place adviseren',
    waarom: 'Een advies met de rekensom erbij; de chef beslist.' },

  /* ---- de zes uit de opdracht ---- */
  'allergie.aanpassen': { laag: 'mensbevestigt', wat: 'een allergie op een regel aanpassen',
    waarom: 'Generatieve AI bepaalt nooit of iets veilig is om te eten. Een mens bevestigt, en bij de pas nog een keer.' },
  'betaling.uitvoeren': { laag: 'mensbevestigt', wat: 'een betaling uitvoeren',
    waarom: 'Geld verlaat het huis nooit vanzelf.' },
  'voorraad.wegboeken': { laag: 'mensbevestigt', wat: 'een voorraadverschil wegboeken',
    waarom: 'Een verschil dat vanzelf verdwijnt, is een diefstal die niemand ziet.' },
  'korting.toekennen': { laag: 'mensbevestigt', wat: 'een korting toekennen',
    waarom: 'Boven de grens van de zaak bevestigt een mens. Is er geen grens ingesteld, dan geldt dat voor elke korting.' },
  'medewerker.beoordelen': { laag: 'verboden', wat: 'een medewerker beoordelen',
    waarom: 'Er komt geen ranglijst op mensen (HORECA.md, grens 5). Een AI-oordeel over een medewerker is die ranglijst met een regel.' },
  'alcohol.negeren': { laag: 'verboden', wat: 'een alcoholbeperking negeren',
    waarom: 'Er bestaat geen situatie waarin dat legitiem is, dus ook geen voorstel.' }
};

const LAGEN = ['mag', 'mensbevestigt', 'verboden'];

/* Een handeling opzoeken. Onbekend is NOOIT `mag`: wat niemand heeft
   beoordeeld, hoort niet zelfstandig te gebeuren. */
function handeling(id) {
  const sleutel = String(id || '').trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(HANDELINGEN, sleutel)) {
    return Object.assign({ id: sleutel, bekend: true }, HANDELINGEN[sleutel]);
  }
  return { id: sleutel, bekend: false, laag: 'mensbevestigt',
    wat: sleutel || 'een onbenoemde handeling',
    waarom: 'Deze handeling staat niet in het register. Wat niemand heeft beoordeeld, hoort niet zelfstandig te gebeuren.' };
}

// het hele register, leesbaar -- een rechtenmodel dat geheim is, is geen model
function register() {
  return Object.keys(HANDELINGEN).map((id) => Object.assign({ id }, HANDELINGEN[id]));
}

module.exports = { HANDELINGEN, LAGEN, handeling, register };
