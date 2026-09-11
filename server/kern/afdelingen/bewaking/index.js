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
  /* Zelfde bedrading als ../integratiekamer.js: `bijeen` en `inBundel` reizen
     niet door de contextketen, `save` wel -- zodat een aanroeper die zijn eigen
     save meegeeft niet stilletjes wordt omzeild. */
  const dbModule = require('../../../db');
  const vastleggenAudit = require('../../../lib/duurzaam')({
    bijeen: dbModule.bijeen, save, inBundel: dbModule.inBundel, bron: 'auditspoor' });

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
  /* HET SPOOR WORDT VASTGELEGD, NIET GEPLAND -- en dat is een reparatie.

     Hier stond de gewone `save()`. Die is write-behind: hij plant een
     schrijfactie en keert meteen terug. Voor afgeleide toestand is dat precies
     goed; voor het logboek dat zegt WIE WELKE KNOP OMZETTE niet, en de belofte
     twee regels hierboven ("achteraf is altijd te herleiden") was daarmee niet
     waar te maken.

     GEMETEN, en niet bedacht. /api/office/aidata/export draagt in zijn eigen kop
     "Elke export komt in het auditlog". A/B met een herstart ertussen:

       schoon            -> 200, 287 bytes geleverd, na de herstart 1 auditregel
       schrijf-verloren  -> 200, 287 bytes geleverd, na de herstart GEEN sleutel
                            kantoorAudit -- nul regels

     De complete AI-dataset ging de deur uit en er bleef niets van over. Dat is
     dezelfde grond waarop integratiekamer.js en command/uitrolregie.js al op de
     lijst van `npm run check` regel 47 staan: gemeten als `schrijf-verloren`
     -> 200.

     WAAROM HIER EN NIET PER ROUTE. De 89 aanroepen in 21 bestanden doen allemaal
     dezelfde belofte; 89 kopieën van deze zes regels is 89 plekken die uit de pas
     kunnen lopen (LAT.md regel 4). Dus een plek.

     ASYNC, EN DAT BREEKT NIEMAND: geen enkele aanroeper gebruikt vandaag de
     teruggave van audit(). Wie hem NIET afwacht krijgt wat hij altijd al kreeg,
     alleen nu met een commit die bevestigd wordt in plaats van gepland. Wie het
     spoor als VOORWAARDE wil -- eerst vastleggen, dan pas leveren -- kan hem
     afwachten en leest dan `null` of een foutantwoord. */
  async function audit(wie, wat) {
    const regel = { wie: String(wie || 'kantoor').replace(/[<>]/g, '').slice(0, 30), wat: String(wat || '').replace(/[<>]/g, '').slice(0, 200), at: nu() };
    return vastleggenAudit(() => {
      const rij = auditRij();
      rij.unshift(regel);
      if (rij.length > 2000) rij.pop();
    });
  }

  /* de wereldkaart en de doos-regie draaien op dezelfde context, met het
     gedeelde audit erbij (zodat elke wereldknop in hetzelfde logboek belandt) */
  const wereldLaag = require('./wereld')({ ...ctx, audit });

  return Object.assign(
    { paniekRij, paniekStel, paniekBesluit, paniekBericht, paniekLijst, auditRij, audit },
    wereldLaag);
};
