/* Foundation OS, deel "projecten-besluit": de statusovergang van een project.

   VIER POORTEN, VIER ZINNEN. Ze vragen om vier verschillende vervolgstappen, en
   een gedeelde 403 zou ze alle vier onzichtbaar maken:

   1. HET BEHEER. Zit u in deze stad, en staat de module van dit project aan.

   2. HET VERSCHIL TUSSEN OPSCHUIVEN EN BESLISSEN. Een projectleider mag zijn
      eigen project indienen en ter beoordeling aanbieden -- dat is beheer. Wat
      hij niet mag, is het besluit: goedkeuren en afkeuren vragen
      'project.besluit', en dat recht zit alleen bij het stadsbestuur en
      landelijk. Zou de hele overgang achter 'project.besluit' hangen, dan kan
      een projectleider zijn eigen project niet eens indienen; zou hij helemaal
      vrij zijn, dan keurt hij hem zelf goed.

   3. DE KETEN. Van "idee" naar "actief" springen betekent: een project dat
      nooit beoordeeld is, geeft geld uit.

   4. VIER OGEN EN DE LIMIET. Wie indient, keurt niet zelf goed; en boven de
      goedkeuringslimiet van de eigen rol beslist het landelijke bestuur. Dat
      getal komt uit dezelfde functie als bij de uitgaven (basis.js: limietVan),
      zodat de twee nooit uit elkaar lopen.

   Afgesplitst uit projecten.js op de 10 KB van keuringsregel 13. */

module.exports = (ctx, eigen) => {
  const { nu, euro, audit, wie, rolIn, magRecht, poort, limietVan, save } = ctx;
  const { vind, beeld, STATUS, KETEN } = eigen;

  /* De statusovergang, met de vier poorten die ertoe doen: het beheer, de
     keten, de vierogen en de limiet. Elk met een eigen zin, want ze vragen om
     vier verschillende vervolgstappen.

     HET VERSCHIL TUSSEN OPSCHUIVEN EN BESLISSEN. Een projectleider mag zijn
     eigen project indienen en ter beoordeling aanbieden -- dat is beheer. Wat
     hij niet mag, is het besluit zelf: goedkeuren en afkeuren vragen
     'project.besluit', en dat recht zit alleen bij het stadsbestuur en
     landelijk. Zou de hele overgang achter 'project.besluit' hangen, dan kan
     een projectleider zijn eigen project niet eens indienen; zou hij helemaal
     vrij zijn, dan keurt hij hem zelf goed. */
  const BESLUIT = ['goedgekeurd', 'afgekeurd'];
  function status(req, id, naar) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    const w = wie(req);
    const g = poort(w, p.stad, 'project.beheren', p.vlag);
    if (!g.ok) return g;
    const st = String(naar || '');
    if (!STATUS.includes(st)) return { status: 400, error: 'Deze status kennen we niet.' };
    if (BESLUIT.includes(st) && !magRecht(w, p.stad, 'project.besluit')) {
      return { status: 403, error: 'Een project goed- of afkeuren doet het stadsbestuur of het landelijke bestuur, niet de projectleider.' };
    }
    const mag = KETEN[p.status] || [];
    if (!mag.includes(st)) {
      return { status: 400, error: 'Van "' + p.status + '" kan een project naar ' +
        (mag.length ? mag.join(' of ') : 'niets meer') + ', niet naar "' + st + '".' };
    }
    if (st === 'goedgekeurd') {
      const rol = rolIn(w, p.stad);
      if (p.aanvrager && p.aanvrager === w.key) {
        return { status: 403, error: 'Wie een project indient, keurt het niet zelf goed. Laat een ander uit het bestuur kijken.' };
      }
      const grens = limietVan(g.stad, rol);
      if (p.budgetCenten > grens) {
        return { status: 403, error: 'Met een budget van ' + euro(p.budgetCenten) + ' euro gaat dit project boven uw grens van ' +
          (grens === Infinity ? 'onbeperkt' : euro(grens)) + ' euro. Het landelijke RTF-bestuur beslist hierover.' };
      }
      p.besluit = { door: w.key, rol, at: nu() };
    }
    if (st === 'aanvraag') p.aanvrager = w.key;
    const oud = p.status;
    p.status = st;
    audit(w.key, 'project.status', p.naam, oud + ' -> ' + st);
    save();
    return { ok: true, project: beeld(p) };
  }

  return { status };
};
