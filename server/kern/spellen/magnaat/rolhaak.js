/* Magnaat: WELKE ROL NEEM JE MET DEZE ZET OP JE?

   Een haak voor de platformlaag, en hij staat apart omdat hij daar hoort: de
   beurtbewaking en de leeftijdsgrens in ../partij.js kennen de rollen van dit
   spel niet en hoeven dat ook niet. Ze vragen het hier, en toetsen het antwoord
   aan ../grens.js.

   DE GRENS ZIT OP HET MOMENT VAN AANVAARDEN en niet op dat van aanbieden. Een
   werkgever mag voorstellen wat hij wil; verantwoordelijkheid AANNEMEN waar je
   te jong voor bent kan niet. Dat is dezelfde lezing als bij de rest van de
   16+-laag: wat een zestienjarige niet mag, mag hij niet omdat hij het in het
   echt ook niet kan -- en een bedrijfsleider stuurt mensen aan.

   TWEE ZETTEN NEMEN EEN ROL AAN, en meer zijn het er niet: solliciteren op een
   vacature, en ja zeggen tegen een promotie. Weigeren staat er met opzet niet
   bij -- nee zeggen is geen verantwoordelijkheid. */
'use strict';

module.exports = function rolVanZet(potje, zet) {
  const st = (potje || {}).staat || {};
  if (!zet) return null;
  if (zet.actie === 'solliciteren') {
    const f = (st.functies || []).find(x => x.id === String(zet.id || ''));
    return f ? f.rol : null;
  }
  if (zet.actie === 'promotie-antwoord' && String(zet.antwoord) === 'ja') {
    const p = (st.promoties || []).find(x => x.id === String(zet.id || ''));
    return p ? p.naar : null;
  }
  return null;
};
