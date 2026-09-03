/* WAAR EEN ALARM HEEN GAAT -- de uitgang van ./alarm.js.

   EEN EIGEN BESTAND, en niet alleen omdat de omvangregel dat afdwong. Wegen en
   melden zijn twee onderwerpen: `alarm.js` beslist OF er iets aan de hand is
   (drempels, controles, de overgang van aan naar af), en dit bestand beslist wie
   dat te horen krijgt. Wie de drempels verandert, hoeft niet te weten hoe een
   webhook eruitziet; wie een kanaal toevoegt, hoeft de controles niet te lezen.

   DRIE KANALEN, en het derde is er bijgekomen omdat de eerste twee allebei
   BINNEN het huis eindigen. Een regel in het journaal staat in het spoor, een
   sein gaat naar het kantoorbord -- en om drie uur 's nachts kijkt naar geen van
   beide iemand. Een alarm dat alleen op een scherm eindigt dat niemand
   openheeft, is een rapportcijfer achteraf (TAKEN.md 7.12).

   Het derde kanaal is de bestaande foutmelder (server/foutmelder.js): een dunne
   webhook-POST met SSRF-keuring, die er al was en op nul aanroepers stond voor
   alarmen. Hij gaat alleen af op de OVERGANG -- aan en af -- en nooit op elke
   ronde; alarm.js roept meld() ook alleen daarvoor aan. Een melding die elke
   dertig seconden terugkomt, leert mensen om hem weg te klikken.

   STILGEZET IS STIL, BEHALVE IN HET SPOOR. Wie een alarm stilzet wil ook geen
   telefoon om drie uur; maar de stilte zelf hoort genoteerd te worden, anders
   verdwijnt met het alarm ook het feit dat iemand hem heeft gedempt.

   EN EEN LEGE URL LEEST ALS "GEEN UITGANG". `buitenStand()` is met opzet een
   uitspraak en geen stilte: staat er geen melder, dan hoort dat naast de alarmen
   op het bord te staan in plaats van eruit te zien als bezorging. De twee redenen
   die hij kan geven verschillen ook echt van elkaar -- "er hangt geen melder aan
   deze laag" is iets anders dan "ERR_WEBHOOK_URL is niet gezet". */
'use strict';

module.exports = ({ journaal, sein, foutmelder }) => {
  /* De melder wordt LAAT opgehaald: hij hangt aan de kern en die is nog niet
     compleet op het moment dat deze laag wordt gebouwd. Vandaar een functie in
     plaats van een waarde, net als `tenant` in ./meetlagen.js. */
  const melderNu = () => {
    try { return typeof foutmelder === 'function' ? foutmelder() : foutmelder; }
    catch (e) { return null; }
  };

  function naarBuiten(a, richting) {
    const m = melderNu();
    if (!m || !m.actief || typeof m.melden !== 'function') return;
    try {
      const kop = richting === 'aan'
        ? 'ALARM ' + String(a.ernst || '').toUpperCase() + ': ' + a.naam
        : 'Alarm opgelost: ' + a.naam;
      /* Een Error en geen los object, want dat is wat melden() verwacht -- maar
         de context zegt er expliciet bij dat dit een ALARM is en geen crash. Wie
         de webhook leest, hoort die twee uit elkaar te kunnen houden. */
      const e = new Error(kop + (richting === 'aan' ? ' -- ' + a.wat : ''));
      e.name = 'RTGAlarm';
      m.melden(e, { soort: 'alarm', id: a.id, ernst: a.ernst, richting, sinds: a.sinds || null });
    } catch (e) { /* bezorging faalt liever dan het alarm te dempen */ }
  }

  function meld(a, richting) {
    const stil = a.stilTot && Date.parse(a.stilTot) > Date.now();
    try {
      journaal.noteer({ actie: richting === 'aan' ? 'alarm aan' : 'alarm af', actor: 'automaat',
        niveau: 'auto', objectType: 'alarm', objectId: a.id,
        reden: a.naam + (richting === 'aan' ? ': ' + a.wat : ' is opgelost') + (stil ? ' (stilgezet)' : '') });
    } catch (e) { /* een journaalstoring mag het alarm niet dempen */ }
    if (stil) return;
    if (typeof sein === 'function') {
      try { sein('sync', { scope: 'alarm', id: a.id, richting, ernst: a.ernst, naam: a.naam }); } catch (e) {}
    }
    naarBuiten(a, richting);
  }

  function buitenStand() {
    const m = melderNu();
    if (!m) return { actief: false, reden: 'er is geen foutmelder aangesloten op deze laag; alarmen blijven binnen het huis' };
    if (!m.actief) return { actief: false, reden: 'ERR_WEBHOOK_URL is niet gezet of werd geweigerd; er gaat niets naar buiten' };
    return { actief: true, reden: null };
  }

  return { meld, buitenStand, naarBuiten };
};
