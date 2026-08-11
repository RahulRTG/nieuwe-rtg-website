/* Wat er buiten staat: online gaan, wijzigingen publiceren, een moment
   plannen, uit de lucht halen -- en het spoor van wie dat deed.

   Dit staat apart van het bouwen van een ontwerp omdat het een ander soort
   besluit is. Bij een zaak zit hier de grens van de leiding omheen
   (routes/zaakweb.js); bij een lid is het zijn eigen site. */
module.exports = ({ store, save, slug, haal, bevries, spoor }) => {
  /* Publiceren op een gekozen moment staat in ./webmaker-plan.js, met een
     eigen veger. */
  const planlaag = require('./webmaker-plan')({ store, save, bevries, spoor });

  function publiceer(key, id, adresIn, wie) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    const a = slug(adresIn || d.adres || d.titel);
    if (a.length < 2) return { error: 'Kies een adres van minstens twee tekens (letters, cijfers, koppelteken).', status: 400 };
    const bezet = store().lijst.find(x => x.adres === a && x.id !== d.id);
    if (bezet) return { error: 'Dit adres is al bezet. Kies een ander.', status: 409 };
    d.adres = a; d.online = true; d.bij = new Date().toISOString();
    bevries(d);              // online gaan is ook het eerste publiceren
    spoor.noteer(d.id, 'online gezet op ' + a, wie);
    save();
    return { ok: true, adres: a, online: true };
  }
  /* De wijzigingen die in het concept staan naar buiten brengen. Een aparte
     handeling, want dit is het moment waarop het web verandert -- bij een zaak
     is dat werk van de leiding (zie routes/webmaker.js). */
  function zetLive(key, id, wie) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    if (!d.online || !d.adres) return { error: 'Zet de site eerst online; dan kun je wijzigingen publiceren.', status: 400 };
    bevries(d);
    spoor.noteer(d.id, 'wijzigingen gepubliceerd', wie);
    save();
    return { ok: true, op: d.liveOp };
  }
  function plan(key, id, moment, wie) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    return planlaag.plan(d, moment, wie);
  }
  function spoorVan(key, id) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    return { ok: true, lijst: spoor.lees(d.id) };
  }

  function offline(key, id, wie) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    d.online = false;
    spoor.noteer(d.id, 'uit de lucht gehaald', wie);
    save();
    return { ok: true, online: false };
  }

  return { publiceer, zetLive, offline, plan, spoorVan, rijp: planlaag.rijp, veeg: planlaag.veeg };
};
