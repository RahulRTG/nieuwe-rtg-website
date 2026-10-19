/* De werkbalk, deel "uitvoering": wat een BEVESTIGD voornemen werkelijk doet.
   Naast ./handeling-lijst.js, dat zegt WELKE handelingen er zijn en welk recht
   ze vragen; dit zegt wat er dan gebeurt. Afgesplitst uit ./handeling.js, dat
   de deur bewaakt (plan, bevestigingscode, het recht opnieuw, de actiebon).
   Elke handeling schrijft in de bak waar dat soort al woonde -- geen tweede
   opslag naast de modules. */
'use strict';

module.exports = ({ rid, nu, zetWie }) => {
  /* De uitvoering per handeling, in de bak waar dat soort al woonde. Een tabel;
     een onbekende handeling wordt ERBOVEN geweigerd (scripts/laatspoor.js). */
  const UITVOERINGEN = {
    'taak.maak': (g, plan) => {
      const T = (g.w.taken = g.w.taken || {});
      const t = { id: rid(5), titel: plan.velden.titel, projectId: null, ouderId: null,
        omschrijving: null, deadline: null, prioriteit: 'normaal', kolom: 'te doen',
        wachtOp: [], uren: 0, sprint: null, at: nu(), door: plan.door };
      zetWie(g.w, t, 'wie', plan.door);
      T[t.id] = t;
      return { ok: true, resultaat: t, verwijzing: { soort: 'taak', id: t.id, titel: t.titel } };
    },
    'ticket.maak': (g, plan) => {
      const S = (g.w.tickets = g.w.tickets || {});
      const t = { id: rid(5), titel: plan.velden.titel, klantId: null, prioriteit: 'normaal',
        status: 'open', reacties: [], at: nu(), door: plan.door };
      S[t.id] = t;
      return { ok: true, resultaat: t, verwijzing: { soort: 'ticket', id: t.id, titel: t.titel } };
    }
  };
  return (g, plan) => UITVOERINGEN[plan.handeling] ? UITVOERINGEN[plan.handeling](g, plan)
    : { ok: false, status: 409, reden: 'Deze handeling heeft geen uitvoering.', verwijzing: null };
};
