/* Afdelingen (deelmodule): de bewaking: de paniekvoorstellen (voorstellen met
   besluit en gesprek) en het auditspoor. schakel komt via de context binnen
   nadat kern/afdelingen.js de boardroomlaag heeft gemount. Krijgt de gedeelde
   context een keer bij het opstarten.

   Dit is de orkestrator: het logboek (audit) en de paniekkamer wonen hier; de
   wereldkaart van de zaakdozen en de doos-regie op afstand staan in ./wereld,
   die het gedeelde audit meekrijgt. */
module.exports = (ctx) => {
  const { save, crypto, nu, d, functies } = ctx;
  const { schakel, functiesStand } = ctx;

  function paniekRij() {
    if (!Array.isArray(d().paniekVoorstellen)) d().paniekVoorstellen = [];
    return d().paniekVoorstellen;
  }
  function paniekStel({ functie, aan, doelgroep, reden }) {
    if (!functies.OP_ID[functie]) return { status: 404, error: 'Onbekende functie.' };
    if (doelgroep && !functies.DOELGROEP_IDS.includes(doelgroep)) return { status: 400, error: 'Onbekende doelgroep.' };
    const rij = paniekRij();
    if (rij.some(v => v.status === 'open' && v.functie === functie && (v.doelgroep || null) === (doelgroep || null)))
      return { status: 409, error: 'Voor deze knop ligt al een voorstel bij de boardroom.' };
    const v = {
      id: crypto.randomBytes(4).toString('hex'),
      functie, functieNaam: functies.OP_ID[functie].naam,
      aan: aan === true, doelgroep: doelgroep || null,
      reden: String(reden || '').replace(/[<>]/g, '').trim().slice(0, 300),
      status: 'open', discussie: [], at: nu()
    };
    rij.unshift(v);
    if (rij.length > 200) rij.pop();
    save();
    return { ok: true, voorstel: v };
  }
  function paniekBesluit(id, besluit) {
    const v = paniekRij().find(x => x.id === id);
    if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    if (v.status !== 'open') return { status: 409, error: 'Dit voorstel is al afgehandeld.' };
    if (besluit === 'accepteer') {
      const r = schakel(v.functie, v.aan, v.doelgroep, 'boardroom (paniekvoorstel)');
      if (r.error) return r;
      v.status = 'geaccepteerd';
    } else if (besluit === 'wijs-af') {
      v.status = 'afgewezen';
      audit('boardroom', 'Paniekvoorstel afgewezen: ' + v.functieNaam + ' ' + (v.aan ? 'AAN' : 'UIT'));
    } else return { status: 400, error: 'Kies accepteer of wijs-af.' };
    v.beslotenAt = nu();
    save();
    return { ok: true, voorstel: v };
  }
  function paniekBericht(id, wie, tekst) {
    const v = paniekRij().find(x => x.id === id);
    if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    const t = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 500);
    if (!t) return { status: 400, error: 'Schrijf een bericht.' };
    v.discussie.push({ wie: wie === 'boardroom' ? 'boardroom' : 'paniekkamer', tekst: t, at: nu() });
    if (v.discussie.length > 50) v.discussie.shift();
    save();
    return { ok: true, voorstel: v };
  }
  function paniekLijst() { return { ok: true, voorstellen: paniekRij().slice(0, 50) }; }

  /* ---------- het logboek: wie deed wat (audittrail) ----------
     Elke schakeling, elk paniekbesluit en elke wereldknop komt hier in, met
     naam en tijd. Onmisbaar voor een 9+-beveiliging: achteraf is altijd te
     herleiden wie welke knop heeft omgezet. */
  function auditRij() {
    if (!Array.isArray(d().kantoorAudit)) d().kantoorAudit = [];
    return d().kantoorAudit;
  }
  function audit(wie, wat) {
    const rij = auditRij();
    rij.unshift({ wie: String(wie || 'kantoor').replace(/[<>]/g, '').slice(0, 30), wat: String(wat || '').replace(/[<>]/g, '').slice(0, 200), at: nu() });
    if (rij.length > 2000) rij.pop();
    save();
  }

  /* de wereldkaart en de doos-regie draaien op dezelfde context, met het
     gedeelde audit erbij (zodat elke wereldknop in hetzelfde logboek belandt) */
  const wereldLaag = require('./wereld')({ ...ctx, audit });

  return Object.assign(
    { paniekRij, paniekStel, paniekBesluit, paniekBericht, paniekLijst, auditRij, audit },
    wereldLaag);
};
