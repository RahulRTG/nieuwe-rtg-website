/* DE WERKRUIMTE VAN EEN DEELNEMER -- dezelfde reis, per mens een andere blik.

   Stap 3 van "Five People. Five Private Contexts. One Shared Outcome". De
   groepsberekening (./reisgezelschap-opties.js) rekent een keer; deze module
   maakt daar per lezer een PROJECTIE van, en de server beslist welke blokken,
   gegevens en handelingen in die projectie staan. Het scherm tekent alleen wat
   hier staat (public/apps/reizen-samen-besluit.js) -- het kiest geen blok zelf.

   DRIE DELEN, en hun grens is de hele module:
     groep        voor ELKE deelnemer van deze reis byte voor byte gelijk, op
                  `voortgang` na (die alleen de reiziger krijgt). Wat hier staat,
                  kan dus niemand iets vertellen dat een ander niet ook ziet.
     jij          alleen over de lezer: zijn eigen opgave en per optie zijn
                  eigen uitkomst met zijn eigen redenen.
     uitleg       wat Rahul zegt. Hij wordt opgebouwd uit `groep` en `jij` van
                  DEZE lezer en uit niets anders -- de functie krijgt de
                  opgaven van anderen niet eens mee. Dat is de structurele vorm
                  van "Rahul onthult nooit iets van een ander": hij kan het niet.

   RAHUL ZONDER MODEL. De uitleg is regelwerk (kern/ai/router.js: regels gaan
   voor). Een taalmodel mag hem later anders verwoorden, maar dan op deze tekst
   en niet op de opgaven: die gaan nooit in een prompt.

   `kenmerk` is een vingerafdruk van het GEDEELDE deel. Het scherm vergelijkt
   hem bij elke ronde; is hij veranderd, dan is wat er stond niet meer actueel
   en wordt dat zo getoond tot de nieuwe uitkomst er is. */
'use strict';

const crypto = require('crypto');

const BLOKKEN = Object.freeze({
  eigenaar: ['groepsvoortgang', 'groepsuitkomst', 'voorlegging', 'venster', 'opties', 'optieZetten', 'mijnOpgave', 'mijnKnelpunten'],
  reisgenoot: ['groepsuitkomst', 'voorlegging', 'venster', 'opties', 'mijnOpgave', 'mijnKnelpunten']
});
const HANDELINGEN = Object.freeze({
  eigenaar: ['opgave.zet', 'opgave.wis', 'optie.zet', 'optie.wis', 'voorstel.leg', 'voorstel.trek', 'instem'],
  reisgenoot: ['opgave.zet', 'opgave.wis', 'instem']
});

// zonder locale: de server kent de taal van de lezer hier niet, en een vaste is erger dan geen
const euro = c => '€ ' + Math.round(c / 100);

/* Rahul, in de u-vorm van het reisscherm (het blad Samen spreekt zo). Alleen uit wat deze lezer al ziet. */
function uitlegVoor(rol, groep, jij, voortgang) {
  const zinnen = [];
  if (!groep.vastTeStellen) {
    zinnen.push(groep.waaromNiet + (voortgang ? ' (' + voortgang.ingevuld + ' van ' + voortgang.deelnemers + ' ingevuld)' : ''));
    if (!jij.opgave) zinnen.push('Geef uw eigen wensen op; niemand anders ziet ze.');
    return zinnen;
  }
  const passen = groep.opties.filter(o => o.voorIedereen === true);
  if (!groep.opties.length) {
    zinnen.push(rol === 'eigenaar'
      ? 'Iedereen heeft zijn wensen opgegeven. Zet een of meer opties klaar om te zien wat voor de hele groep past.'
      : 'Iedereen heeft zijn wensen opgegeven. De reiziger zet de opties klaar.');
  } else if (passen.length) {
    zinnen.push(passen.length + ' van de ' + groep.opties.length + ' opties ' + (passen.length === 1 ? 'past' : 'passen') +
      ' voor iedereen: ' + passen.map(o => o.titel).join(', ') + '.');
  } else {
    zinnen.push('Er is nog geen optie die voor iedereen past. ' + (rol === 'eigenaar'
      ? 'U kunt de reisdata of het voorstel aanpassen.'
      : 'De reiziger kan het voorstel aanpassen, en u kunt uw eigen wensen bijstellen.'));
  }
  if (groep.venster && groep.venster.length) {
    zinnen.push('Iedereen die data opgaf, kan ' + groep.venster.map(v => v.van === v.tot ? 'op ' + v.van : 'van ' + v.van + ' tot ' + v.tot).join(' of ') + '.');
  } else if (groep.venster) {
    zinnen.push('Er is geen dag waarop iedereen die data opgaf, kan.');
  }
  const v = groep.voorlegging;
  if (v) {
    if (v.stand === 'aangenomen') {
      zinnen.push('Iedereen stemde in met versie ' + v.versie + ': ' + v.optie.titel + '. Dat is een besluit binnen het gezelschap; er is nog niets geboekt of betaald.');
    } else if (v.stand === 'open') {
      zinnen.push('Versie ' + v.versie + ' (' + v.optie.titel + ') ligt voor: ' + v.instemmingen.ja + ' van ' + v.instemmingen.totaal + ' stemden in. ' +
        (jij.instemming === 'ja' ? 'U stemde in.' : jij.instemming === 'nee' ? 'U stemde niet in.' : 'U heeft nog niet geantwoord.'));
    } else {
      zinnen.push('Versie ' + v.versie + ' telt niet meer: ' + v.reden + ' Instemmingen erop zijn vervallen.');
    }
  }
  for (const o of groep.opties) {
    const mijn = jij.opties[o.id];
    if (mijn && !mijn.past) zinnen.push('Voor u past ' + o.titel + ' (' + euro(o.prijsPP) + ' p.p.) niet: ' + mijn.redenen.join(' '));
  }
  return zinnen;
}

/* `rauw` komt uit de groepsberekening en bevat alleen wat al gefilterd is:
   per optie `voorIedereen` en per optie de uitkomst van DEZE lezer. */
function projectie(rol, rauw) {
  const groep = {
    vastTeStellen: rauw.vastTeStellen, waaromNiet: rauw.waaromNiet, venster: rauw.venster,
    opties: rauw.opties.map(o => ({ id: o.id, titel: o.titel, prijsPP: o.prijsPP, van: o.van, tot: o.tot,
      kenmerken: o.kenmerken, voorIedereen: o.voorIedereen })),
    toetsingen: rauw.toetsingen, nietGezegd: rauw.nietGezegd, grens: rauw.grens,
    voorlegging: (rauw.voorlegging && rauw.voorlegging.groep) || null
  };
  const kenmerk = crypto.createHash('sha256').update(JSON.stringify(groep)).digest('hex').slice(0, 16);
  const voortgang = rol === 'eigenaar' ? { deelnemers: rauw.deelnemers, ingevuld: rauw.ingevuld } : null;
  if (voortgang) groep.voortgang = voortgang;
  const jij = { opgave: rauw.mijn, opties: Object.fromEntries(rauw.opties.filter(o => o.voorJou).map(o => [o.id, o.voorJou])),
    instemming: rauw.voorlegging && rauw.voorlegging.jij ? rauw.voorlegging.jij.instemming : null };
  return {
    status: 200, ok: true, stand: 'voorlopig', rol, kenmerk, berekendOp: rauw.berekendOp,
    groep, jij, uitleg: uitlegVoor(rol, groep, jij, voortgang),
    werkruimte: { blokken: BLOKKEN[rol].slice(), handelingen: HANDELINGEN[rol].slice() }
  };
}

module.exports = { BLOKKEN, HANDELINGEN, projectie, uitlegVoor };
