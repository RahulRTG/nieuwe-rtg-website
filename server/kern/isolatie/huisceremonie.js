/* DE CEREMONIE VAN HET HUIS -- de enige drager wiens stand deze laag niet bezit.

   Het huis staat met opzet niet in de eigen dragers van ./index.js: zijn stand
   woont in kern/incidentcontrole.js, waar hij altijd al woonde, en hem hierheen
   kopiëren zou twee waarheden maken over dezelfde stand. Wat deze laag wél kan
   leveren is de CEREMONIE eromheen, want die is voor alle dragers dezelfde -- en
   een tweede ceremonie naast de eerste zou binnen een jaar iets anders eisen.

   DE TAAKVERDELING IS DAARMEE SCHERP: de isolatielaag zegt of er genoeg bewijs
   is, de incidentcontrole zet de stand. Geen van beide kan het alleen, en dat is
   het ontwerp en geen omweg -- een module die allebei kan, kan zichzelf
   goedkeuren.

   Hij staat in een eigen bestand omdat ./index.js anders over de tienduizend
   bytes gaat. Dat is geen boekhoudkundige reden: de snede loopt langs een echte
   naad, want dit is het enige stuk van de laag dat over een stand gaat die zij
   niet bezit. */
'use strict';

module.exports = function maakHuisceremonie({ ontsluiting, spoor, save, beveilig, fout }) {

  function vraagHuisOntsluiting({ van, naar, door, reden, tweedeMens }) {
    return ontsluiting.start({ drager: 'huis', sleutel: null, van: van || 'isolatie',
      naar: naar || 'normaal', door, reden, tweedeMens });
  }

  /* DE POORT die kern/incidentcontrole.js meekrijgt. Hij gooit bij elk gebrek,
     en dat is het punt: een poort die `false` teruggeeft, is een poort die een
     aanroeper kan vergeten te lezen. */
  function huisCeremoniePoort({ id, actor, van, naar }) {
    if (!id) {
      fout(400, 'De stand van het platform verlagen vraagt een voltooide ontsluitceremonie. ' +
        'Vraag er een aan (passkey, een vertrouwd apparaat en een tweede paar ogen) en geef het ' +
        'nummer ervan mee.');
    }
    const v = ontsluiting.vind(id);
    if (!v) fout(404, 'Onbekende ontsluitceremonie.');
    if (v.drager !== 'huis') fout(403, 'Deze ceremonie gaat over "' + v.drager + '" en niet over het platform.');
    /* DE CEREMONIE MOET OVER DEZE OVERGANG GAAN. Zonder deze twee regels kan een
       ceremonie die voor een lichte overgang is afgegeven, een zware dekken --
       en dan is de zwaarte van de eisen een formaliteit. */
    if (naar && String(v.naar) !== String(naar)) {
      fout(409, 'Deze ceremonie is aangevraagd voor "' + v.naar + '" en niet voor "' + naar + '".');
    }
    if (van && String(v.van) !== String(van)) {
      fout(409, 'Deze ceremonie is aangevraagd vanuit "' + v.van + '" en het platform staat nu in "' +
        van + '". Vraag een nieuwe aan voor de stand die er werkelijk is.');
    }
    /* Het aftekenen gebeurt hier en niet eerder: zo bestaat er geen moment
       waarop een voltooide ceremonie ongebruikt rondslingert en een tweede
       verlaging zou kunnen dekken. commit() weigert een tweede aanroep. */
    const uit = ontsluiting.commit(id, { door: actor && actor.id ? 'user-' + actor.id : 'eigenaar' });
    spoor({ drager: 'huis', sleutel: null, van: uit.verzoek.van, naar: uit.verzoek.naar,
      richting: uit.verzoek.noodontsluiting ? 'verlaagd-nood' : 'verlaagd',
      door: uit.verzoek.voltooidDoor, ceremonie: uit.verzoek.id });
    if (save) save();
    if (beveilig) {
      beveilig.meld('isolatie', uit.verzoek.noodontsluiting ? 'kritiek' : 'waarschuwing',
        (uit.verzoek.noodontsluiting
          ? 'NOODONTSLUITING van het platform: er was niemand anders om goed te keuren. '
          : 'Ontsluiting van het platform met een tweede paar ogen. ') +
        'Ceremonie ' + uit.verzoek.id + ', ' + uit.verzoek.van + ' -> ' + uit.verzoek.naar + '.',
        { bron: 'isolatie:huisceremonie' });
    }
    return { ceremonie: uit.verzoek.id, vereisten: uit.verzoek.vereisten,
      noodontsluiting: uit.verzoek.noodontsluiting === true,
      noodWaarom: uit.verzoek.noodWaarom || null,
      voltooidDoor: uit.verzoek.voltooidDoor, op: uit.verzoek.voltooidOp };
  }

  return { vraagHuisOntsluiting, huisCeremoniePoort };
};
