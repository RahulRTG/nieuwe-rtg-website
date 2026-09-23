/* Zelfzorg, pijler 3: REPAREREN. Herstelt wat structureel kapot maar veilig te
   herstellen is: een kerncollectie die ontbreekt of het verkeerde type heeft
   (alleen als hij ONTBREEKT; een verkeerd type wordt een advies), zekeringen die een nieuwe versie nog niet kent,
   en tellers die uit de pas lopen. De grens is hard: klantdata en geld worden
   nooit "gerepareerd" door de automaat; wat daar scheef zit wordt een advies
   met het grootboek ernaast, en een mens beslist. */

const techniek = require('../../techniek');

module.exports = (ctx) => {
  const { db, save, schrijf, pay, bank } = ctx;
  const d = () => db.data;

  /* De kerncollecties die routes zonder eigen vangnet aanraken: bestaat er
     een niet of heeft hij het verkeerde type, dan crasht een lezer op
     Object.keys/filter.

     ONTBREEKT er een, dan wordt het lege type aangelegd: er gaat niets
     verloren. Heeft hij het VERKEERDE TYPE, dan wordt hij NIET meer
     teruggezet -- dat is een ADVIES voor een mens. Hier stond dat de kapotte
     waarde "als bewijsstuk in het journaal-item mee" ging, en dat gebeurde
     niet: orders en boekingen (klantdata) en kantoorAudit (een spoor) werden
     op een knopdruk leeg gezet zonder dat de oude waarde ergens bleef, een
     herstel zonder terugweg (BESTUUR.md 6.5; ARBEID.md par. 4 punt 9). Alleen
     de eigen staat van deze module mag hij zelf terugzetten. */
  const EIGEN = new Set(['zelfzorg']);
  const KERN = [
    ['orders', 'array'], ['boekingen', 'array'], ['snaps', 'array'], ['stories', 'array'],
    ['notifications', 'object'], ['kantoorChat', 'object'], ['kantoorAudit', 'array'],
    ['zelfzorg', 'object']
  ];

  function herstel(door) {
    const reparaties = [];
    const adviezen = [];

    for (const [naam, soort] of KERN) {
      const v = d()[naam];
      const goed = soort === 'array' ? Array.isArray(v) : (v && typeof v === 'object' && !Array.isArray(v));
      if (v === undefined || v === null) {
        d()[naam] = soort === 'array' ? [] : {};
        reparaties.push({ wat: 'ontbrekende collectie "' + naam + '" aangelegd' });
      } else if (!goed && EIGEN.has(naam)) {
        d()[naam] = soort === 'array' ? [] : {};
        reparaties.push({ wat: 'collectie "' + naam + '" had het verkeerde type (' + (Array.isArray(v) ? 'array' : typeof v) + ') en is teruggezet' });
      } else if (!goed) {
        adviezen.push({ ernst: 'hoog', tekst: 'De collectie "' + naam + '" heeft het verkeerde type (' +
          (Array.isArray(v) ? 'array' : typeof v) + ' in plaats van ' + soort + '). Die wordt niet automatisch geleegd: ' +
          'er kan klantdata of een spoor in staan. Herstel is mensenwerk, met een back-up erbij.', waar: 'techniekbord' });
      }
    }

    // zekeringen die een nieuwe versie meebracht maar deze kast nog niet kent
    if (!d().techniek) d().techniek = {};
    if (!d().techniek.zekeringen) d().techniek.zekeringen = {};
    const std = techniek.standaardZekeringen();
    for (const k of Object.keys(std)) {
      if (!d().techniek.zekeringen[k]) { d().techniek.zekeringen[k] = std[k]; reparaties.push({ wat: 'ontbrekende zekering "' + k + '" bijgeplaatst' }); }
    }

    // geld: alleen kijken, nooit aanraken. Faalt een sluitcontrole, dan is
    // dat een advies voor een mens met het grootboek erbij.
    if (pay && pay.sluitcontrole) {
      const s = pay.sluitcontrole();
      if (!s.klopt) adviezen.push({ ernst: 'hoog', tekst: 'De wallet sluit niet (som ' + s.som + '). Reparatie van geld is mensenwerk: grootboek nalopen op het techniekbord.', waar: 'techniekbord (PAY-02)' });
    }
    if (bank && bank.gezondheid) {
      const g = bank.gezondheid();
      if (g.sluit && !g.sluit.klopt) adviezen.push({ ernst: 'hoog', tekst: 'De bank sluit niet (som ' + g.sluit.som + '). Reparatie van geld is mensenwerk.', waar: 'techniekbord (BANK-01)' });
    }

    // kapotte journaal-regels (bijv. na een half weggeschreven snapshot)
    const zj = d().zelfzorg && d().zelfzorg.journaal;
    if (Array.isArray(zj)) {
      const voor = zj.length;
      d().zelfzorg.journaal = zj.filter(r => r && typeof r === 'object' && r.at);
      if (voor - d().zelfzorg.journaal.length) reparaties.push({ wat: 'kapotte journaalregels verwijderd', aantal: voor - d().zelfzorg.journaal.length });
    }

    if (reparaties.length) save();
    const regel = schrijf('repareren', door, reparaties.map(r => ({ wat: r.wat, aantal: r.aantal || 1 })), adviezen);
    return { ok: true, reparaties, adviezen, gezond: !reparaties.length && !adviezen.length, at: regel.at };
  }

  return { herstel };
};
