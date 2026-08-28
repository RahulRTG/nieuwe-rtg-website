/* Routes "festival" (deelmodule): DE NORM, DE VOORSPELLING, HET GEHEUGEN EN DE
   TIJDLIJN.

   VIER ONDERWERPEN IN EEN BESTAND, EN DAT IS EEN KEUZE. Ze horen bij elkaar
   omdat ze alle vier over TIJD gaan: wat er straks hoort te staan, wat er
   straks misgaat, wat er gisteren gebeurde en waar dat uit blijkt. Wie hier een
   vijfde bij zet dat daar niet over gaat, splitst het bestand.

   DE NORM IS MANAGERWERK. Wat er ergens hoort te staan, is een uitspraak over
   het festival en niet over een dienst; wie hem mag zetten, mag ook het rooster
   maken. Hem LEZEN mag iedereen die er staat: een barman die ziet dat hij met
   twee van de vier is, is de eerste die het kan melden.

   HET MOMENT KOMT VAN DE SERVER. De vraag "hoeveel mensen horen hier nu te
   staan" wordt beantwoord op de klok van de server en niet op die van het
   toestel -- dezelfde regel als bij de poort en het podiumbeeld, en hier omdat
   een gat van een uur geleden een ander gat is dan het gat van nu.

   AFSLUITEN IS ONOMKEERBAAR GENOEG OM ER EEN NAAM AAN TE HANGEN. Die komt uit
   de sessie. Een afdruk die zegt "afgesloten door Marta" terwijl het lichaam
   dat mocht invullen, is geen verslag maar een invulveld. */
'use strict';

module.exports = (kern, deur) => {
  const { app, festival, logActivity, managerOnly, supplierAuth } = kern;
  const { mijn, editieVan, geenFestival, stuur } = deur;

  const nu = () => {
    const t = new Date().toISOString();
    return { datum: t.slice(0, 10), tijd: t.slice(11, 16) };
  };

  /* De lopende dag van de server, of niets. Een festivaldag loopt over
     middernacht heen; dat rekent kern/festival/model.js uit en geen scherm. */
  function lopend(f, eid) {
    const e = festival.editieVind(f.id, eid);
    if (!e) return null;
    const t = nu();
    const dag = festival.dagOpMoment(e, t.datum, t.tijd);
    return dag ? { dag, tijd: t.tijd } : null;
  }

  /* ---- de norm ---- */

  app.post('/api/festival/norm', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.normZet(f.id, editieVan(req), req.body || {});
    if (r.ok) logActivity(req.supplier.code, req.actor, 'zette een norm op ' + r.norm.wat);
    stuur(res, r);
  });

  app.post('/api/festival/norm/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.normWeg(f.id, editieVan(req), (req.body || {}).id));
  });

  app.post('/api/festival/normen', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.normenVan(f.id, editieVan(req), (req.body || {}).dag));
  });

  /* ---- de voorspelling ---- */

  /* EEN ANTWOORD OOK BUITEN DE OPENINGSTIJDEN. "Er loopt nu geen dag" is een
     uitspraak en geen fout; een scherm dat daarop een 404 krijgt, gaat zelf
     een dag verzinnen. */
  app.post('/api/festival/vooruit', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const eid = editieVan(req);
    const l = lopend(f, eid);
    if (!l) return stuur(res, { ok: true, geenDag: true, vraag: [], gaten: [], leegloop: null });
    const vraag = festival.vraagOp(f.id, eid, { dag: l.dag.id, tijd: l.tijd });
    const gaten = festival.bemensing(f.id, eid, { dag: l.dag.id, tijd: l.tijd });
    const leeg = festival.leegloop(f.id, eid, { dag: l.dag.id, tijd: l.tijd });
    stuur(res, { ok: true, dag: l.dag.id, tijd: l.tijd,
      vraag: vraag.ok ? vraag.vraag : [], gaten: gaten.ok ? gaten.gaten : [],
      leegloop: leeg.ok ? leeg : null });
  });

  /* ---- het geheugen ---- */

  app.post('/api/festival/dag/sluiten', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.dagSluiten(f.id, editieVan(req), {
      dag: (req.body || {}).dag, opnieuw: (req.body || {}).opnieuw === true,
      door: (req.actor && req.actor.name) || ''      // uit de SESSIE, nooit uit het lichaam
    });
    if (r.ok) logActivity(req.supplier.code, req.actor, 'sloot festivaldag ' + r.afdruk.datum + ' af');
    stuur(res, r);
  });

  app.post('/api/festival/geheugen', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.vergelijk(f.id, editieVan(req)));
  });

  /* DE TIJDLIJN LEEST DE VLOER OOK. Anders dan het geheugen staat hij niet
     achter managerOnly: er staat geen gastgegeven in (scans en passen zijn
     geteld, groepen ontbreken) en het is midden in de nacht juist de crew die
     moet kunnen nakijken wanneer iets is klaargezet of afgetekend. Wat er wel
     in staat -- wie wat besliste -- zien diezelfde mensen ook op Gereed. */
  app.post('/api/festival/tijdlijn', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const b = req.body || {};
    stuur(res, festival.tijdlijn(f.id, editieVan(req), {
      dag: b.dag || null, soorten: Array.isArray(b.soorten) ? b.soorten : null }));
  });
};
