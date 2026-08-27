/* DE AI-TOEZICHTHOUDER -- de laag die over de agents heen kijkt.

   Een agent die iets mag, is nog geen agent die het onbeperkt mag. Deze module
   houdt drie dingen tegen die een enkele agent zelf nooit kan zien:

   1. DUBBEL WERK. Twee agents die tegelijk aan hetzelfde object beginnen. De
      een zet een rit op "gepland", de ander op "geannuleerd", en welke wint is
      een kwestie van milliseconden. Een claim per object lost dat op: wie hem
      heeft, werkt; de ander krijgt nee met de naam van de eerste erbij.

   2. WEGLOPEN. Een agent die door een fout in een lus komt, doet in tien
      minuten wat hij op een dag hoort te doen. De teller per uur en per dag is
      daar de rem op, en de grenzen staan in het beleid zodat ze zonder
      code-wijziging te verschuiven zijn.

   3. AFWIJKEN. Een agent die vaker misgaat dan hij goed gaat, wordt gestopt --
      niet gewaarschuwd. Waarschuwingen leest niemand om vier uur 's nachts.

   WAAROM DE TOEZICHTHOUDER ZELF GEEN AGENT IS. Hij rekent, hij redeneert niet.
   Een toezichthouder die zelf een taalmodel is, kan overtuigd worden door
   degene op wie hij toeziet; deze kan dat niet, want hij kent alleen getallen
   en grenzen. Dat is een bewuste beperking en geen gebrek. */
'use strict';

function maakToezicht({ opslag, save, journaal, beleid }) {
  function reg() {
    return opslag.bak('commandAgents');
  }
  function claims() {
    return opslag.bak('commandClaims');
  }
  const nu = () => Date.now();
  const uur = 3600 * 1000;

  function agent(naam) {
    const r = reg();
    if (!r[naam]) r[naam] = { naam, gemaakt: new Date().toISOString(), acties: [], centen: [],
      gestopt: false, stopReden: null, mislukt: 0, gelukt: 0, mag: [] };
    return r[naam];
  }

  /* De vensters opschonen bij elke blik: een teller die alleen groeit, meet
     "ooit" en niet "dit uur". */
  function schoonVensters(a, t) {
    a.acties = a.acties.filter(x => t - x < uur);
    a.centen = a.centen.filter(x => t - x.at < 24 * uur);
  }

  function budget(naam) {
    const a = agent(naam), t = nu();
    schoonVensters(a, t);
    const perUur = beleid.getal('agent.actiesPerUur', 200);
    const perDag = beleid.getal('agent.centenPerDag', 5000000);
    const centenGebruikt = a.centen.reduce((n, x) => n + x.centen, 0);
    return { naam, gestopt: a.gestopt, stopReden: a.stopReden,
      actiesDitUur: a.acties.length, actiesMax: perUur, actiesOver: Math.max(0, perUur - a.acties.length),
      centenVandaag: centenGebruikt, centenMax: perDag, centenOver: Math.max(0, perDag - centenGebruikt),
      gelukt: a.gelukt, mislukt: a.mislukt,
      foutkans: a.gelukt + a.mislukt ? Math.round((a.mislukt / (a.gelukt + a.mislukt)) * 100) : 0 };
  }

  /* De poort. Elke agent-handeling gaat hierlangs vóórdat hij gebeurt.
     Geeft {mag:true} of {mag:false, waarom}. */
  function mag(naam, wat) {
    const a = agent(naam), t = nu();
    schoonVensters(a, t);
    const w = wat || {};
    if (a.gestopt) return { mag: false, waarom: 'deze agent is gestopt: ' + (a.stopReden || 'zonder reden genoteerd') };
    const perUur = beleid.getal('agent.actiesPerUur', 200);
    if (a.acties.length >= perUur) return { mag: false, waarom: 'urengrens bereikt (' + perUur + ' handelingen per uur)' };
    const perDag = beleid.getal('agent.centenPerDag', 5000000);
    const gebruikt = a.centen.reduce((n, x) => n + x.centen, 0);
    const centen = Number(w.centen || 0);
    if (centen && gebruikt + centen > perDag)
      return { mag: false, waarom: 'daggrens in geld bereikt (' + Math.round(perDag / 100) + ' euro)' };
    if (a.mag.length && w.actie && !a.mag.includes(w.actie))
      return { mag: false, waarom: 'deze agent mag de handeling "' + w.actie + '" niet' };
    if (w.objectType && w.objectId) {
      const sleutel = w.objectType + ':' + w.objectId;
      const c = claims()[sleutel];
      if (c && c.agent !== naam && t - c.at < 5 * 60 * 1000)
        return { mag: false, waarom: 'botsing: ' + c.agent + ' werkt al aan ' + sleutel };
    }
    return { mag: true };
  }

  /* Boeken wat er gebeurde. Dit is wat de tellers voedt; wie het overslaat,
     zet de toezichthouder uit zonder hem uit te zetten. */
  function boek(naam, wat) {
    const a = agent(naam), t = nu();
    schoonVensters(a, t);
    const w = wat || {};
    a.acties.push(t);
    if (w.centen) a.centen.push({ at: t, centen: Number(w.centen) });
    if (w.gelukt === false) a.mislukt++; else a.gelukt++;
    if (w.objectType && w.objectId) claims()[w.objectType + ':' + w.objectId] = { agent: naam, at: t };
    /* Afwijking: minstens tien handelingen, en meer dan de helft mislukt.
       Onder de tien zegt een foutpercentage nog niets. */
    const totaal = a.gelukt + a.mislukt;
    if (!a.gestopt && totaal >= 10 && a.mislukt / totaal > 0.5) {
      a.gestopt = true;
      a.stopReden = 'meer dan de helft van de laatste ' + totaal + ' handelingen mislukte';
      journaal.noteer({ actor: 'toezicht', actie: 'agent stoppen', objectType: 'agent', objectId: naam,
        niveau: 'auto', reden: a.stopReden, na: { gestopt: true, mislukt: a.mislukt, gelukt: a.gelukt } });
    }
    if (save) save();
    return budget(naam);
  }

  function zetGrenzen(naam, mogen, door, reden) {
    if (!door) return { error: 'Zonder herleidbare actor worden er geen agent-rechten gezet.', status: 403 };
    const a = agent(naam);
    const voor = { mag: a.mag.slice() };
    a.mag = Array.isArray(mogen) ? mogen.map(String) : [];
    if (save) save();
    journaal.noteer({ actor: door, actie: 'agent rechten zetten', objectType: 'agent', objectId: naam,
      niveau: 'hand', reden: String(reden || 'bevoegdheden afgebakend'), voor, na: { mag: a.mag } });
    return { agent: naam, mag: a.mag };
  }

  function stop(naam, door, reden) {
    if (!door) return { error: 'Zonder herleidbare actor wordt er geen agent gestopt.', status: 403 };
    const a = agent(naam);
    a.gestopt = true; a.stopReden = String(reden || 'met de hand gestopt');
    if (save) save();
    journaal.noteer({ actor: door, actie: 'agent stoppen', objectType: 'agent', objectId: naam,
      niveau: 'hand', reden: a.stopReden, na: { gestopt: true } });
    return budget(naam);
  }

  function hervat(naam, door, reden) {
    if (!door) return { error: 'Zonder herleidbare actor wordt er geen agent hervat.', status: 403 };
    const a = agent(naam);
    const voor = { gestopt: a.gestopt, stopReden: a.stopReden, mislukt: a.mislukt };
    a.gestopt = false; a.stopReden = null; a.mislukt = 0; a.gelukt = 0;
    if (save) save();
    journaal.noteer({ actor: door, actie: 'agent hervatten', objectType: 'agent', objectId: naam,
      niveau: 'hand', reden: String(reden || 'hervat na beoordeling'), voor, na: { gestopt: false } });
    return budget(naam);
  }

  const alle = () => Object.keys(reg()).map(budget);

  return { agent, mag, boek, budget, alle, stop, hervat, zetGrenzen };
}

module.exports = { maakToezicht };
