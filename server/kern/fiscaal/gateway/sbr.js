/* DE AANGIFTEGATEWAY (deelmodule): HET KANAAL -- en waarom het niet aan staat.

   Dit is de eerste adapter op de generieke kern: SBR/Digipoort, de Nederlandse
   weg voor btw- en loonaangiften. Hij beschrijft wat dat kanaal VRAAGT en
   weigert te versturen.

   DAT WEIGEREN IS DE FUNCTIE, niet een gat. Wat er ontbreekt om hem aan te
   zetten is geen code maar drie dingen die geen van alle in een repository
   thuishoren: een PKIoverheid-servicecertificaat, een aansluiting bij Digipoort
   met een eigen kenmerk, en het besluit dat RTG namens ondernemers indient. Dat
   laatste staat vandaag als `voorbehouden` in kern/fiscaal/zekerheid.js, en de
   kern (./index.js) kijkt daar als eerste naar -- vóór dit bestand.

   Er is dus GEEN vlag die hem aanzet. Wie hem aanzet, vervangt `actief` en
   verandert het zekerheidsregister, en dat zijn twee bewuste handelingen met
   een naam eronder. Een omgevingsvariabele zou van dat besluit een
   configuratieregel maken.

   WAT ER WEL AL STAAT: de vorm. `eist` is wat een zending moet dragen voordat
   dit kanaal hem uberhaupt zou aannemen, en dat is nu al te controleren. Zo is
   een zending die vandaag wordt klaargezet straks niet ineens onvolledig. */
'use strict';

/* Wat SBR van een zending verlangt. Bewust hier en niet in de kern: een tweede
   kanaal (een ander land, een andere instantie) heeft andere eisen, en die
   horen bij dat kanaal te staan en niet in een gedeelde lijst met vlaggetjes. */
const EIST = Object.freeze({
  btw: ['tijdvak', 'omzetbelastingNummer', 'rubrieken'],
  loonheffing: ['tijdvak', 'loonheffingennummer', 'collectief', 'nominatief']
});

/* Een zending nalopen tegen wat dit kanaal vraagt. Puur, en te draaien zonder
   dat er ooit iets verstuurd wordt -- dat is precies waarvoor hij er nu is. */
function eist(zending) {
  const nodig = EIST[zending && zending.soort];
  if (!nodig) return { ok: false, ontbreekt: [],
    reden: 'SBR kent de soort "' + ((zending && zending.soort) || '?') + '" niet.' };
  const p = (zending && zending.payload) || {};
  const ontbreekt = nodig.filter(v => p[v] === undefined || p[v] === null || p[v] === '');
  return ontbreekt.length
    ? { ok: false, ontbreekt, reden: 'Deze velden ontbreken voor SBR: ' + ontbreekt.join(', ') + '.' }
    : { ok: true, reden: 'De zending draagt alles wat SBR voor een ' + zending.soort + '-aangifte vraagt.' };
}

const kanaal = {
  naam: 'SBR / Digipoort',
  /* NIET AAN. Zie de kop: dit is een besluit en geen instelling. */
  actief: false,
  let: 'Dit kanaal is voorbereid, niet aangesloten. Er is geen servicecertificaat, geen Digipoort-aansluiting, ' +
    'en RTG dient niet namens ondernemers in -- dat laatste staat als grens in het zekerheidsregister.',
  eist,
  /* De handtekening op een SBR-bericht is een XML-signature met een
     PKIoverheid-certificaat. Die is hier NIET nagebouwd met een eigen sleutel:
     een zelfgemaakte handtekening die er officieel uitziet, is erger dan geen.
     Wat er wel is, is de verzegeling van de inhoud (kern/fiscaal/gateway/
     zegel.js) -- die bewijst intern wat er lag, en doet niet alsof hij meer is. */
  ondertekening: { soort: 'XML-signature (PKIoverheid)', aanwezig: false,
    let: 'Niet nagebouwd. De inhoud is wel verzegeld met sha256; dat is intern bewijs en geen rechtsgeldige handtekening.' },
  async verstuur(zending) {
    return { ok: false,
      error: 'Het SBR-kanaal is niet aangesloten; er is niets verstuurd.',
      zending: zending && zending.id };
  }
};

module.exports = { kanaal, eist, EIST };
