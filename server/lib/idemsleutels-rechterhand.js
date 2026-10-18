/* HET IDEM-REGISTER, deel "rechterhand" -- de premium apps van de Lifestyle
   Pass (Reisboek, Cellier, Table, Maison, Garde-robe, Mecenaat, Nalatenschap,
   Logboek, Cercle, Hangar, Entourage, Attenties; routes/member/rechterhand.js).

   GEVONDEN DOOR DE TESTWERELD (18 oktober 2026). De voltooiproef van Reisboek
   (scripts/lib/voltooi/reisboek.js) tikte twee keer tegelijk op "nieuwe reis"
   en kreeg twee reizen; een verzoek dat de client opgaf en daarna opnieuw
   stuurde, ook. Geen van deze routes had een verklaring, dus de idem-poort liet
   ze allebei door (server/lib/idem-poort.js: geen verklaring, geen afwijking).
   Elke regel hieronder is op de HANDLER in kern/rechterhand/ nagelezen.

   DRIE GROEPEN:
     leest           het boek, de kelder, de lijst -- en twee rekenvragen
                     (waarheen, gezelschap) die niets bewaren;
     zelfdeVerzoek   iets toevoegen of overschrijven met wat in de body staat,
                     en elk /weg op id: een woordelijk gelijk verzoek binnen het
                     venster is een dubbeltik, en de tweede keer weg is al weg;
     nietIdempotent  een fles inschenken. Dat is een TELLER (aantal - 1), en twee
                     flessen van dezelfde wijn op een avond zijn twee flessen.
   De adviseur (/ai) staat er met opzet niet in: dat is een modelvraag, en die
   hoort bij de AI-laag en niet bij deze ronde. */
'use strict';

const P = '/api/member/rechterhand/';
const leest = { leest: true };
const zelfde = { zelfdeVerzoek: true };

const SLEUTELS = {};
for (const pad of ['reisboek', 'cellier', 'table', 'maison', 'garderobe', 'mecenaat', 'nalatenschap',
  'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'cercle/waarheen', 'entourage/gezelschap']) {
  SLEUTELS['POST ' + P + pad] = leest;
}
for (const pad of [
  'reis/zet', 'reis/weg', 'reis/item', 'reis/item/weg',
  'cellier/zet', 'cellier/weg',
  'table/zet', 'table/weg', 'table/gast', 'table/gast/zet', 'table/gast/weg', 'table/menu', 'table/menu/weg',
  'maison/staf', 'maison/staf/weg', 'maison/taak', 'maison/taak/klaar', 'maison/taak/weg', 'maison/log/weg',
  'garderobe/stuk', 'garderobe/stuk/weg', 'garderobe/vakman', 'garderobe/vakman/weg',
  'mecenaat/gift', 'mecenaat/gift/weg', 'mecenaat/betaald',
  'nalatenschap/doc', 'nalatenschap/doc/weg', 'nalatenschap/contact', 'nalatenschap/contact/weg',
  'nalatenschap/wens', 'nalatenschap/wens/weg',
  'logboek/object', 'logboek/object/weg', 'logboek/regel', 'logboek/regel/weg',
  'cercle/club', 'cercle/club/weg', 'cercle/gast', 'cercle/gast/terug',
  'hangar/toestel', 'hangar/toestel/weg', 'hangar/vlucht', 'hangar/vlucht/weg',
  'entourage/persoon', 'entourage/persoon/weg', 'entourage/doc', 'entourage/doc/weg',
  'attenties/relatie', 'attenties/relatie/weg', 'attenties/gift', 'attenties/gift/weg']) {
  SLEUTELS['POST ' + P + pad] = zelfde;
}
SLEUTELS['POST ' + P + 'cellier/schenk'] = { nietIdempotent: true,
  waarom: 'een fles inschenken telt het aantal een omlaag; twee flessen van dezelfde wijn op een avond zijn twee handelingen en geen dubbeltik' };

module.exports = { SLEUTELS };
