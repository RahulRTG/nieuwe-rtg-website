/* VAN EEN BETAALDE PAS NAAR GAST -- besluit C5 van de eigenaar (27 september 2026).

   Er was geen weg terug: een pas ontstond bij een menselijk besluit en ging nooit
   meer omlaag, dus churn mat niets (AUTONOMIE.md par. 5, punt 2). Nu drie wegen:

   1. HET LID ZELF, en hij kiest: NU (hij ziet af van de rest van zijn periode) of
      AAN HET EIND van zijn periode (hij zegt op langs de bestaande opzegweg en de
      ronde hieronder voert het op de einddatum uit). Die tweede is ZIJN opdracht,
      geen besluit van RTG, en hangt dus niet aan een schakelaar.
   2. HET KANTOOR, met de hand, op naam en met een reden.
   3. AUTOMATISCH, met drie regels die elk een schakelaar zijn en standaard UIT
      staan -- alleen de eigenaar zet ze aan:
        afgelopen   een opgezegd contract bereikt zijn einddatum;
        wacht       hetzelfde, maar pas N dagen later, met een bericht vooraf;
        onbetaald   N vervallen termijnen staan nog open.
      Staan `afgelopen` en `wacht` allebei aan, dan wint `wacht`: bij twijfel de
      zachtste. Een lid zonder vastgelegd contract gaat NOOIT automatisch -- "ik
      vind geen afspraak" is geen "er is niets afgesproken" (AFSPRAAK.md).

   WAT ELKE WEG DOET. De pas gaat naar gast (accounts.setTier, zodat de
   pasgeschiedenis het vastlegt) en de lopende sessies vervallen
   (accounts.zetSessiegrens) -- anders houdt een ingelogde telefoon de oude pas.
   Facturen, betaalschema en bewijsstukken blijven staan: rechten hangen per
   capability en niet per account, en een opzegging is geen straf.

   WAT GEEN WEG DOET: geld verplaatsen of een verplichting kwijtschelden. Wie NU
   gast wordt, blijft gebonden aan zijn opzegtermijn; dat staat in het antwoord. */
'use strict';

const NAAM = 'pasNaarGast';
const REGELS = Object.freeze({
  afgelopen: { standaard: { aan: false } },
  wacht: { standaard: { aan: false, dagen: 30 } },
  onbetaald: { standaard: { aan: false, termijnen: 2 } }
});
const DAG = 86400000;

module.exports = ({ db, save, A, B, contracten, accounts, zegOpZelf, meldLid, nu }) => {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/aanmeldingen/naargast', bezit: { [NAAM]: 'kaart' } });
  const klok = () => Date.parse(typeof nu === 'function' ? nu() : new Date().toISOString());
  const kaart = () => { const k = eigen.bak(NAAM); if (!k.gepland) k.gepland = {}; if (!k.regels) k.regels = {}; return k; };

  function regels() {
    const k = eigen.kijk(NAAM), r = k.regels || {};
    const uit = {};
    for (const [id, d] of Object.entries(REGELS)) uit[id] = Object.assign({}, d.standaard, r[id] || {});
    return uit;
  }

  /* De eigenlijke overgang, voor alle drie de wegen. */
  function naarGast(accountId, bron) {
    const u = accounts.getUserById(Number(accountId));
    if (!u) return { status: 404, error: 'Dit account bestaat niet.' };
    if (u.tier === 'guest') return { status: 409, error: 'Dit account is al gast.' };
    if (!accounts.setTier(u.id, 'guest')) return { status: 500, error: 'De pas kon niet worden gewijzigd.' };
    accounts.zetSessiegrens(u.id);
    return { ok: true, van: u.tier, naar: 'guest', bron };
  }

  const lopendContract = (aanmelding) => {
    const rij = B().find(r => r.aanmeldingId === String(aanmelding.id));
    const c = rij && rij.contractId ? contracten.vind(rij.contractId) : null;
    return { rij, c };
  };
  const mijnAanmelding = (accountId) => A().find(a => Number(a.accountId) === Number(accountId) && a.status === 'geaccepteerd'
    && (() => { const { c } = lopendContract(a); return c && (contracten.LOPEND.has(c.status) || c.status === contracten.STATUS.OPZEGGEND); })());

  /* 1a. Het lid: nu. Een lopend contract wordt opgezegd (de verplichting loopt tot
     de einddatum), en de pas gaat meteen. */
  function lidNu(accountId) {
    const a = mijnAanmelding(accountId);
    let eindigtOp = null;
    if (a) { const z = zegOpZelf(accountId); if (z.error) return z; eindigtOp = z.eindigtOp; }
    const r = naarGast(accountId, 'lid-nu');
    if (r.error) return r;
    delete kaart().gepland[String(accountId)]; save();
    return Object.assign(r, { betalingLooptTot: eindigtOp,
      let: eindigtOp ? 'Je bent nu gast. Je afspraak loopt tot ' + eindigtOp.slice(0, 10) + '; tot dan blijven de termijnen staan.'
        : 'Je bent nu gast.' });
  }

  /* 1b. Het lid: aan het eind van zijn periode. Zonder afspraak is er geen eind. */
  function lidEinde(accountId) {
    const a = mijnAanmelding(accountId);
    if (!a) return { status: 409, error: 'Er is geen afspraak met een einddatum. Wil je gast worden, kies dan voor nu.' };
    const z = zegOpZelf(accountId);
    if (z.error) return z;
    kaart().gepland[String(accountId)] = { op: z.eindigtOp, sinds: new Date(klok()).toISOString() };
    save();
    return { ok: true, gepland: true, gastOp: z.eindigtOp, let: 'Je blijft lid tot ' + String(z.eindigtOp).slice(0, 10) + ' en wordt daarna gast.' };
  }

  /* 2. Het kantoor, op naam en met een reden. */
  function kantoor(accountId, door, reden) {
    const tekst = String(reden || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (tekst.length < 4) return { status: 400, error: 'Een pas naar gast zetten kan alleen met een reden.' };
    if (!door) return { status: 403, error: 'Dit doet een mens op naam, niet de gedeelde kantoorcode.' };
    const r = naarGast(accountId, 'kantoor');
    return r.error ? r : Object.assign(r, { door, reden: tekst });
  }

  /* 3. De schakelaars. Alleen de eigenaar, en elke wijziging draagt wie en wanneer. */
  function regelZet(id, patch, door) {
    if (!REGELS[id]) return { status: 400, error: 'Onbekende regel.' };
    const p = patch || {}, nieuw = { aan: p.aan === true, door: String(door || '').slice(0, 80), op: new Date(klok()).toISOString() };
    if (id === 'wacht') { const d = Math.round(Number(p.dagen)); if (!(d >= 1 && d <= 365)) return { status: 400, error: 'Een wachttijd van 1 tot 365 dagen.' }; nieuw.dagen = d; }
    if (id === 'onbetaald') { const t = Math.round(Number(p.termijnen)); if (!(t >= 1 && t <= 12)) return { status: 400, error: 'Van 1 tot 12 open termijnen.' }; nieuw.termijnen = t; }
    kaart().regels[id] = nieuw;
    save();
    return { ok: true, regels: regels() };
  }

  /* DE RONDE. Voert de geplande overgangen uit en, waar een schakelaar aan staat,
     de automatische. Geeft tellingen terug en geen namen. */
  function ronde() {
    const t = klok(), r = regels(), uit = { gepland: 0, afgelopen: 0, wacht: 0, aangekondigd: 0, onbetaald: 0 };
    const k = eigen.kijk(NAAM);
    for (const [id, g] of Object.entries(k.gepland || {})) {
      if (Date.parse(g.op) > t) continue;
      const x = naarGast(id, 'lid-gepland');
      if (x.ok || x.status === 409 || x.status === 404) { delete kaart().gepland[id]; if (x.ok) uit.gepland += 1; }
    }
    const wacht = r.wacht.aan, dagen = r.wacht.dagen;
    for (const a of A().filter(x => x.status === 'geaccepteerd' && x.accountId != null)) {
      const { rij, c } = lopendContract(a);
      if (!c) continue;   // geen vastgelegde afspraak: nooit automatisch
      if ((wacht || r.afgelopen.aan) && c.status === contracten.STATUS.OPZEGGEND && c.eindigtOp && Date.parse(c.eindigtOp) <= t) {
        if (wacht && Date.parse(c.eindigtOp) + dagen * DAG > t) {
          const kk = kaart(); kk.aangekondigd = kk.aangekondigd || {};
          if (!kk.aangekondigd[a.id] && typeof meldLid === 'function') {
            try { meldLid('user-' + a.accountId, { icon: 'pas', title: 'Je lidmaatschap is afgelopen',
              body: 'Over ' + dagen + ' dagen word je gast. Was dit een vergissing, neem dan contact op.' }); } catch (e) { /* bericht is een extra */ }
            kk.aangekondigd[a.id] = new Date(t).toISOString(); uit.aangekondigd += 1;
          }
          continue;
        }
        contracten.beeindig(c);
        if (naarGast(a.accountId, wacht ? 'regel-wacht' : 'regel-afgelopen').ok) uit[wacht ? 'wacht' : 'afgelopen'] += 1;
        continue;
      }
      if (r.onbetaald.aan && contracten.LOPEND.has(c.status) && rij) {
        const open = (rij.termijnen || []).filter(x => x.status === 'gepland' && Date.parse(x.vervalt) < t).length;
        if (open >= r.onbetaald.termijnen && naarGast(a.accountId, 'regel-onbetaald').ok) uit.onbetaald += 1;
      }
    }
    if (Object.values(uit).some(n => n > 0)) save();
    return uit;
  }

  return { naarGast: { lidNu, lidEinde, kantoor, regels, regelZet, ronde, REGELS: Object.keys(REGELS) } };
};
