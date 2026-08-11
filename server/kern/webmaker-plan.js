/* Publiceren op een moment dat u kiest.

   De ondernemer werkt overdag aan zijn nieuwe kaart en wil hem zondagnacht
   buiten hebben, niet om half drie 's middags tussen de gasten door. Hij zet
   hier een moment; de veger brengt het dan naar buiten.

   Twee dingen die geen detail zijn:

   - ER GAAT NAAR BUITEN WAT ER OP DAT MOMENT KLAARSTAAT, niet wat er stond
     toen u plande. Dat is dezelfde belofte als de knop "zet wijzigingen
     online", alleen later ingedrukt. Zou het de stand van het plannen
     bevriezen, dan verdwijnt alles wat u er daarna nog aan deed -- en dat
     merkt u pas als het buiten staat.
   - PLANNEN KAN ALLEEN VOOR EEN SITE DIE AL ONLINE IS. Online gaan is een
     eigen besluit (met een adres erbij); dat hoort niet per ongeluk vannacht
     te gebeuren omdat iemand een moment invulde. */
module.exports = ({ store, save, bevries, spoor }) => {
  const TIK_MS = 30000;

  function geldigMoment(v) {
    const t = Date.parse(String(v || ''));
    if (!Number.isFinite(t)) return null;
    if (t > Date.now() + 366 * 24 * 3600 * 1000) return null;   // een jaar vooruit is genoeg
    return new Date(t).toISOString();
  }

  /* d is de site zoals hij nu is (de aanroeper heeft het eigenaarschap al
     gecontroleerd). Een leeg moment haalt de planning weg. */
  function plan(d, moment, wie) {
    if (!d.online || !d.adres) return { error: 'Zet de site eerst online; daarna kunt u een publicatiemoment kiezen.', status: 400 };
    if (!moment) {
      delete d.plan;
      spoor.noteer(d.id, 'planning ingetrokken', wie);
      save();
      return { ok: true, plan: null };
    }
    const op = geldigMoment(moment);
    if (!op) return { error: 'Kies een geldig moment (binnen een jaar).', status: 400 };
    if (Date.parse(op) <= Date.now()) return { error: 'Dat moment is al geweest. Kies een moment in de toekomst.', status: 400 };
    d.plan = op;
    spoor.noteer(d.id, 'publicatie gepland', wie);
    save();
    return { ok: true, plan: op };
  }

  /* Is het moment van DEZE site aangebroken, dan gaat hij nu naar buiten.
     Geeft true terug als er iets veranderde (de aanroeper bewaart). */
  function rijp(d) {
    if (!d || !d.plan || !d.online || !d.adres) return false;
    if (Date.parse(d.plan) > Date.now()) return false;
    delete d.plan;
    bevries(d);
    spoor.noteer(d.id, 'gepubliceerd volgens planning', null);
    return true;
  }

  /* De veger loopt alle sites langs. Hij is de achtervang voor sites die
     niemand bezoekt; de bezoekkant vraagt het bovendien per site opnieuw
     (zie webmaker-blader.js), zodat het geplande moment een belofte aan de
     BEZOEKER is en niet aan de klok van deze server. */
  function veeg() {
    let anders = false;
    for (const d of store().lijst) if (rijp(d)) anders = true;
    if (anders) save();
  }

  const timer = setInterval(veeg, TIK_MS);
  if (timer.unref) timer.unref();

  return { plan, veeg, rijp };
};
