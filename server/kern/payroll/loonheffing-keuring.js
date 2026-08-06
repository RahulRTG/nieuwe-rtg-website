/* Payroll OS: DE KEURING VAN EEN LOONHEFFINGSTABEL.

   Afgesplitst van ./loonheffing.js, dat over de 10 KB ging. De snede loopt langs
   een echte grens: hiernaast staat hoe je MET een tabel rekent, hier staat
   wanneer iets een tabel IS. Dat tweede hoort bij het binnenhalen (zie
   ./regelpakket.js) en het eerste bij het rekenen; ze raken elkaar alleen via
   deze ene functie.

   WAAROM DIT GEEN VRIENDELIJKE CONTROLE IS. Een pakket dat hier doorheen komt,
   mag straks een definitieve loonrun dragen. Een schijventabel die terugspringt
   of een tarief van 370% is geen tabel maar een leesfout in de bron -- en die
   hoort tegengehouden te worden voordat er een strook op draait, niet erna. */
'use strict';

/* De keuring van een tabel, voor ./regelpakket.js. Een tabel met schijven die
   niet oplopen of met een tarief boven de 100% is geen tabel maar een fout in
   de bron -- en die hoort tegengehouden te worden voordat er een strook op
   draait, niet erna. */
function keurTabel(lh) {
  const bez = [];
  if (!lh || typeof lh !== 'object') return ['loonheffing ontbreekt of is geen object.'];
  if (!Array.isArray(lh.schijven)) {
    if (!Number.isFinite(lh.tarief)) bez.push('loonheffing heeft geen schijven en geen vlak tarief.');
    else if (lh.tarief < 0 || lh.tarief > 0.75) bez.push('loonheffing.tarief (' + lh.tarief + ') is niet aannemelijk.');
    return bez;
  }
  let vorige = 0;
  for (let i = 0; i < lh.schijven.length; i++) {
    const s = lh.schijven[i];
    if (!s || typeof s !== 'object') { bez.push('schijf ' + i + ' is geen object.'); continue; }
    if (typeof s.deel !== 'number' || s.deel < 0 || s.deel > 0.75)
      bez.push('schijf ' + i + ': deel (' + s.deel + ') is niet aannemelijk als deel van 1.');
    const laatste = i === lh.schijven.length - 1;
    if (s.tot == null && !laatste) bez.push('schijf ' + i + ' heeft geen bovengrens maar is niet de laatste.');
    if (s.tot != null) {
      if (typeof s.tot !== 'number' || s.tot <= vorige)
        bez.push('schijf ' + i + ': tot (' + s.tot + ') loopt niet op.');
      else vorige = s.tot;
    }
  }
  if (lh.bijzonderTarief != null && (typeof lh.bijzonderTarief !== 'number' ||
      lh.bijzonderTarief < 0 || lh.bijzonderTarief > 0.75))
    bez.push('loonheffing.bijzonderTarief (' + lh.bijzonderTarief + ') is niet aannemelijk.');
  if (lh.periodenPerJaar != null && ![12, 13, 26, 52].includes(lh.periodenPerJaar))
    bez.push('loonheffing.periodenPerJaar (' + lh.periodenPerJaar + ') is geen gangbare loonperiode.');

  const k = lh.heffingskortingen;
  if (k != null) {
    if (typeof k !== 'object' || Array.isArray(k)) bez.push('heffingskortingen moet een object van tabellen zijn.');
    else for (const naam of Object.keys(k)) {
      if (!Array.isArray(k[naam]) || !k[naam].length) { bez.push('heffingskorting "' + naam + '" is geen rij stukken.'); continue; }
      let onder = 0;
      k[naam].forEach((s, i) => {
        if (!s || typeof s !== 'object') return bez.push('heffingskorting "' + naam + '" stuk ' + i + ' is geen object.');
        if (s.vast != null && (typeof s.vast !== 'number' || s.vast < 0))
          bez.push('heffingskorting "' + naam + '" stuk ' + i + ': vast is geen positief bedrag in centen.');
        if (s.deel != null && (typeof s.deel !== 'number' || Math.abs(s.deel) > 1))
          bez.push('heffingskorting "' + naam + '" stuk ' + i + ': deel (' + s.deel + ') is niet aannemelijk.');
        if (s.tot != null) {
          if (typeof s.tot !== 'number' || s.tot <= onder)
            bez.push('heffingskorting "' + naam + '" stuk ' + i + ': tot loopt niet op.');
          else onder = s.tot;
        }
      });
    }
  }
  return bez;
}


module.exports = { keurTabel };
