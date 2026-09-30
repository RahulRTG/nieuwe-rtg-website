/* Onderwijs (deelmodule): het beheer van een les door de begeleider -- de
   lescode vernieuwen of intrekken, een leerling zijn toegang ontnemen en de les
   sluiten (CODECREDENTIALS.json, foundation.onderwijs_les_tokens, B17).

   Twee keer gecontroleerd, en dat is met opzet: lesVan() + docentCheck() aan de
   deur (met de rem op het raden van een lessleutel), en daarna opnieuw BINNEN de
   collectietransactie (./toegang-beheer.js) -- een intrekking die net op een
   andere instance landde mag niet door een oudere lezing worden ingehaald.

   Een ingetrokken of gesloten toegang sluit ook de live-verbinding die er nog
   openstond; anders keek een leerling na zijn intrekking gewoon door. */
module.exports = (octx) => {
  const { router, save, nu, toegang, sse, presentie, lesVan, docentCheck, rolVanVerzoek } = octx;

  function sluitStromen(lesId, wie) {
    const set = sse.get(lesId); if (!set) return;
    for (const c of [...set]) if (!wie || wie(c)) { set.delete(c); try { c.res.end(); } catch (e) {} }
  }
  async function beheer(les, req, res, werk) {
    const uit = await werk(les.id, rolVanVerzoek(req).sleutel);
    res.set('Cache-Control', 'no-store');
    if (!uit.ok) { res.status(uit.status).json({ error: uit.error }); return null; }
    return uit;
  }

  /* Vernieuwen: de vorige lescode opent niets meer, en de nieuwe staat kaal
     alleen in dit antwoord (lib/eenmalig-geheim-routes.js). Wie al meedoet,
     houdt zijn eigen sleutel. */
  router.post('/les/code/roteer', async (req, res) => {
    const les = lesVan(req, res); if (!les || !docentCheck(les, req, res)) return;
    const uit = await beheer(les, req, res, (id, s) => toegang.roteerLescode(id, s)); if (!uit) return;
    res.json({ ok: true, lescode: uit.lescode, toegang: uit.toegang });
  });
  router.post('/les/code/intrekken', async (req, res) => {
    const les = lesVan(req, res); if (!les || !docentCheck(les, req, res)) return;
    const uit = await beheer(les, req, res, (id, s) => toegang.intrekLescode(id, s)); if (!uit) return;
    res.json({ ok: true, toegang: uit.toegang });
  });
  router.post('/les/leerling/intrekken', async (req, res) => {
    const les = lesVan(req, res); if (!les || !docentCheck(les, req, res)) return;
    const studentId = String(req.body.studentId || '');
    const uit = await beheer(les, req, res, (id, s) => toegang.intrekLeerling(id, s, studentId)); if (!uit) return;
    const l = Object.prototype.hasOwnProperty.call(les.leerlingen, studentId) ? les.leerlingen[studentId] : null;
    if (l && !l.ingetrokken_at) { l.ingetrokken_at = nu(); save(); }
    sluitStromen(les.id, c => c.studentId === studentId);
    presentie(les.id);
    res.json({ ok: true, studentId });
  });
  router.post('/les/sluit', async (req, res) => {
    const les = lesVan(req, res); if (!les || !docentCheck(les, req, res)) return;
    const uit = await beheer(les, req, res, (id, s) => toegang.sluit(id, s)); if (!uit) return;
    if (!les.gesloten_at) { les.gesloten_at = uit.gesloten_at; save(); }
    sluitStromen(les.id);
    res.json({ ok: true, gesloten_at: uit.gesloten_at });
  });
};
