/* De zelfzorg van het platform: de code ruimt zichzelf op, beschermt zichzelf,
   repareert zichzelf en upgradet zichzelf. Vier pijlers, elk met een knop in de
   boardroom en de kamers Intern & IT en Ingenieurs, plus een stille automaat
   die de veilige delen periodiek zelf draait.

   De morele grens is dezelfde als overal in RTG: de AI en de automaat doen
   alleen wat veilig en omkeerbaar is (vegen wat verlopen is, ontbrekende
   structuur aanvullen, een back-up maken). Alles wat geld, rechten of
   klantdata zou kunnen raken wordt een ADVIES aan een mens, nooit een
   automatische ingreep. Elke run komt in het journaal: wat, wanneer, door
   wie, en precies welke acties. */

module.exports = (deps) => {
  const { db, save } = deps;

  const z = () => {
    if (!db.data.zelfzorg || typeof db.data.zelfzorg !== 'object') db.data.zelfzorg = {};
    const s = db.data.zelfzorg;
    if (!Array.isArray(s.journaal)) s.journaal = [];
    if (!s.laatste || typeof s.laatste !== 'object') s.laatste = {};
    return s;
  };

  /* Het journaal: elke run een regel, nieuwste bovenaan, begrensd. */
  function schrijf(soort, door, acties, adviezen) {
    const s = z();
    const regel = {
      at: Date.now(), soort, door: String(door || 'automaat').replace(/[<>]/g, '').slice(0, 40),
      acties: (acties || []).slice(0, 30), adviezen: (adviezen || []).slice(0, 15)
    };
    s.journaal.unshift(regel);
    if (s.journaal.length > 200) s.journaal.length = 200;
    s.laatste[soort] = { at: regel.at, door: regel.door, acties: regel.acties.length, adviezen: regel.adviezen.length };
    save();
    return regel;
  }

  const ctx = { ...deps, z, schrijf };
  const api = {};
  Object.assign(api, require('./opruimen')(ctx));
  Object.assign(api, require('./beschermen')(ctx));
  ctx.opruim = api.opruim; // de upgrade-migratie veegt eenmalig mee
  Object.assign(api, require('./repareren')(ctx));
  Object.assign(api, require('./upgraden')(ctx));

  /* Het overzicht voor de knoppenkaart: versie, schema, wachtende upgrades,
     de laatste run per pijler en het recente journaal. */
  api.status = () => {
    const s = z();
    return {
      ok: true,
      versie: api.pakketVersie(),
      schema: db.data.__schema || 1,
      doelSchema: api.doelSchema(),
      wachtend: api.wachtendeMigraties(),
      laatste: s.laatste,
      journaal: s.journaal.slice(0, 12),
      automaat: { aan: api.automaatAan(), elkeUren: api.automaatUren() }
    };
  };

  /* De stille automaat: de veilige pijlers (opruimen + de bescherm-scan)
     draaien vanzelf. Alleen op de schrijver, uit te zetten met
     RTG_ZELFZORG_MS=0; upgrades en reparaties blijven altijd een knop. */
  const AUTO_MS = Number(process.env.RTG_ZELFZORG_MS || 6 * 3600000);
  api.automaatAan = () => AUTO_MS > 0;
  api.automaatUren = () => Math.round(AUTO_MS / 3600000 * 10) / 10;
  api.autoStart = () => {
    if (!AUTO_MS) return null;
    const t = setInterval(() => {
      if (!db.writable) return;
      try { api.opruim('automaat'); api.bescherm('automaat'); } catch (e) { /* nooit de server omtrekken */ }
    }, AUTO_MS);
    if (t.unref) t.unref();
    return t;
  };

  return { zelfzorg: api };
};
