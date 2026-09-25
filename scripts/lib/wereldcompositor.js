/* ============================================================================
   DE WERELDCOMPOSITOR -- een app vraagt de wereld die hij nodig heeft, en krijgt
   precies die, opgebouwd uit de wereldbouwers die er al zijn.

   WAAROM DIT BESTAAT. Er liggen elf wereldbouwers in scripts/lib/wereld-*.js,
   elk geschreven omdat een groep routes op "bestaat niet" strandde: een
   rekening, een school, een festival-editie, een stadsafdeling. Ze werden
   samengesteld op EEN plek -- een vaste lijst van zes in scripts/idemproef-
   route.js -- en de andere vijf (horeca, school, spel, signature, wortels) had
   op 24 september 2026 geen enkele proef in gebruik. Alleen hun eigen
   unittoetsen riepen ze aan. Dat is geen ontbrekende wereld maar een wereld die
   niemand kan vragen.

   WAT DE COMPOSITOR IS, en wat niet. Hij bouwt GEEN nieuwe wereld en herschrijft
   er geen: elke bouwer blijft precies zoals hij is en krijgt dezelfde invoer als
   voorheen. Wat hier bij komt is een REGISTER (welke werelden er zijn en wat
   elk nodig heeft) en een PLAN (in welke volgorde, met welke fundering). Zo
   wordt `bouw(['horeca'])` een zaak-sessie, de gastfamilie en een open
   rekening -- en niet de hele stad.

   DE FUNDERING is wat werelden delen, en die wordt alleen opgezet als iets hem
   vraagt:

     server      een wegwerpserver op een eigen datamap (./wegwerpserver.js)
     sleutelbos  de rollen en hun tokens (./proefsleutels.js)
     families    de lijfsleutels per familie -- gast, gezin, school
                 (./lijfsleutels.js)

   DE STANDEN ZIJN DIE VAN DE BOUWERS ZELF: `klaar` of niet, met de reden. Een
   bouwer die struikelt is iets anders dan een bouwer die nee zegt (zie de kop
   van ./lijfsleutels.js), dus een uitzondering wordt `klaar: false` MET de
   foutmelding, nooit een stille lege wereld. En een wereld die aan het begin
   klaar was kan halverwege sneuvelen -- daarom geeft `bouw()` ook de controle
   van ./wereldcontrole.js mee, die NA afloop peilt.

   DETERMINISTISCH. Het plan is een pure functie van de gevraagde namen: zelfde
   vraag, zelfde volgorde, zelfde fundering. test/wereldcompositor.test.js houdt
   dat vast zonder een server te starten.
   ========================================================================== */
'use strict';
const path = require('path');

/* HET REGISTER. `vraagt` noemt de invoer die de bouwer leest, in de namen van
   zijn eigen handtekening; `families` welke lijfsleutels hij verwacht; `na`
   een zachte volgorde (bouw eerst, als die ook gevraagd is -- geen eis).
   `controle` is de naam waaronder ./wereldcontrole.js hem peilt, als die er is.

   Een nieuwe wereldbouwer hoort HIER bij te komen. De toets zakt zodra er een
   `scripts/lib/wereld-*.js` met een zet...Klaar bestaat die hier ontbreekt. */
const WERELDEN = {
  genre:     { module: './wereld-genre', fn: 'zetGenreKlaar', vraagt: ['post', 'zaakinlog'] },
  rtfos:     { module: './wereld-rtfos', fn: 'zetRtfosKlaar', vraagt: ['post', 'tokens'], controle: 'rtfos' },
  festival:  { module: './wereld-festival', fn: 'zetFestivalKlaar', vraagt: ['post', 'tokens'], controle: 'festival' },
  lab2:      { module: './wereld-lab2', fn: 'zetLab2Klaar', vraagt: ['post', 'tokens'], controle: 'lab2' },
  weefsel:   { module: './wereld-weefsel', fn: 'zetWeefselKlaar', vraagt: ['post', 'tokens'], controle: 'weefsel' },
  rtmail:    { module: './wereld-rtmail', fn: 'zetRtmailKlaar', vraagt: ['post', 'tokens'], controle: 'postbus' },
  signature: { module: './wereld-signature', fn: 'zetSignatureKlaar', vraagt: ['post', 'tokens'] },
  horeca:    { module: './wereld-horeca', fn: 'zetHorecaKlaar', vraagt: ['post', 'sleutels', 'tokens'], families: ['gast'] },
  school:    { module: './wereld-school', fn: 'zetSchoolKlaar', vraagt: ['post', 'sleutels', 'datamap'], families: ['school', 'gezin'], controle: 'school' },
  spel:      { module: './wereld-spel', fn: 'zetSpelKlaar', vraagt: ['post', 'tokens', 'gezinLijf', 'kindToken'], families: ['gezin'], na: ['school'], controle: 'spel' },
  wortels:   { module: './wereld-wortels', fn: 'zetWortelsKlaar', vraagt: ['post', 'tokenVoor'] }
};

/* Welke fundering een invoer nodig heeft. `post` en `datamap` komen van de
   server; tokens en wat daaruit volgt van de sleutelbos; sleutels van de
   families (en die hebben op hun beurt de sleutelbos nodig). */
const FUNDERING_VAN = {
  post: 'server', datamap: 'server',
  tokens: 'sleutelbos', tokenVoor: 'sleutelbos', zaakinlog: 'sleutelbos',
  sleutels: 'families', gezinLijf: 'families', kindToken: 'families'
};
const FUNDERING_ORDE = ['server', 'sleutelbos', 'families'];

/* HET PLAN -- puur, zonder server. Gooit op een onbekende naam: een app die een
   wereld vraagt die niet bestaat, hoort dat te horen en niet een lege wereld te
   krijgen die er klaar uitziet. */
function plan(namen, register = WERELDEN) {
  const gevraagd = [...new Set(namen || [])];
  const onbekend = gevraagd.filter((n) => !register[n]);
  if (onbekend.length) {
    throw new Error('onbekende wereld: ' + onbekend.join(', ') + ' (bekend: ' + Object.keys(register).join(', ') + ')');
  }
  /* Volgorde: de registervolgorde, met `na` als zachte eis. Stabiel, dus een
     herhaalde vraag geeft een herhaalde volgorde. */
  const volgorde = Object.keys(register).filter((n) => gevraagd.includes(n));
  for (let i = 0; i < volgorde.length; i++) {
    for (const eerder of register[volgorde[i]].na || []) {
      const j = volgorde.indexOf(eerder);
      if (j > i) { volgorde.splice(i, 0, volgorde.splice(j, 1)[0]); i = -1; break; }
    }
  }
  const fundering = new Set();
  const families = new Set();
  for (const n of volgorde) {
    for (const v of register[n].vraagt) {
      const f = FUNDERING_VAN[v];
      if (!f) throw new Error('wereld ' + n + ' vraagt "' + v + '", en de compositor kent die invoer niet');
      fundering.add(f);
    }
    for (const fam of register[n].families || []) families.add(fam);
  }
  if (fundering.has('families')) fundering.add('sleutelbos');
  if (fundering.size) fundering.add('server');
  return {
    werelden: volgorde,
    fundering: FUNDERING_ORDE.filter((f) => fundering.has(f)),
    families: [...families].sort()
  };
}

/* Een eenvoudige POST, dezelfde vorm als in de proeven: status + data, en een
   netwerkfout wordt status 0 en nooit een uitzondering. */
function maakPost(basis) {
  return async (pad, lijf, tok, extraKoppen) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json',
          ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(extraKoppen || {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      return { status: r.status, data };
    } catch (e) { return { status: 0, data: String(e.message) }; }
  };
}

/* DE BOUW. `opties.server` mag een bestaande server zijn ({ basis, datamap });
   dan start de compositor er geen en ruimt hij er ook geen op. De families
   worden per naam teruggegeven (`sleutels.gast`, `sleutels.gezin`) -- dezelfde
   vorm die horeca en school al verwachtten, en die tot vandaag niemand vulde. */
async function bouw(namen, opties = {}) {
  const p = plan(namen);
  const uit = { plan: p, werelden: {}, fundering: {}, klaar: () => {} };
  const ctx = {};

  if (p.fundering.includes('server')) {
    if (opties.server) {
      ctx.basis = opties.server.basis; ctx.datamap = opties.server.datamap;
      uit.fundering.server = { klaar: true, reden: 'meegegeven door de aanroeper' };
    } else {
      const { start } = require('./wegwerpserver');
      const srv = await start({ naam: 'wereld', env: Object.assign({ RTG_DEMO: '1' }, opties.env || {}) });
      uit.klaar = srv.klaar;
      if (srv.dood) {
        uit.fundering.server = { klaar: false, reden: 'de wegwerpserver kwam niet op' };
        for (const n of p.werelden) uit.werelden[n] = { klaar: false, reden: 'geen server' };
        return uit;
      }
      ctx.basis = srv.basis; ctx.datamap = srv.datamap;
      uit.fundering.server = { klaar: true, reden: 'wegwerpserver op ' + srv.basis };
    }
    ctx.post = opties.post || maakPost(ctx.basis);
    uit.basis = ctx.basis; uit.post = ctx.post;
  }

  if (p.fundering.includes('sleutelbos')) {
    try {
      const { haalSleutels } = require('./proefsleutels');
      const bos = await haalSleutels({ post: ctx.post });
      ctx.tokens = bos.tokens; ctx.tokenVoor = bos.tokenVoor; ctx.zaakinlog = bos.zaakbureau;
      uit.tokens = bos.tokens;
      const rollen = Object.keys(bos.tokens || {}).filter((r) => bos.tokens[r]);
      uit.fundering.sleutelbos = { klaar: rollen.length > 0, reden: rollen.length ? 'rollen: ' + rollen.join(', ') : 'geen enkel token' };
    } catch (e) {
      uit.fundering.sleutelbos = { klaar: false, reden: 'de sleutelbos liep vast: ' + e.message };
    }
  }

  if (p.fundering.includes('families')) {
    ctx.sleutels = {};
    const { FAMILIES } = require('./lijfsleutels');
    const fctx = { post: ctx.post, tokens: ctx.tokens || {}, datamap: ctx.datamap };
    const mislukt = [];
    for (const naam of p.families) {
      const f = FAMILIES.find((x) => x.naam === naam);
      if (!f) { mislukt.push(naam + ' (onbekende familie)'); continue; }
      let s = null, fout = null;
      try { s = await f.bouw(fctx); } catch (e) { fout = e.message; }
      if (s) { const lijf = Object.assign({}, s); delete lijf.__koppen; ctx.sleutels[naam] = lijf; }
      else mislukt.push(naam + (fout ? ' (liep vast: ' + fout + ')' : ' (geen sleutel)'));
    }
    ctx.gezinLijf = ctx.sleutels.gezin || null;
    uit.sleutels = ctx.sleutels;
    uit.fundering.families = { klaar: mislukt.length === 0,
      reden: mislukt.length ? 'mislukt: ' + mislukt.join(', ') : 'gebouwd: ' + p.families.join(', ') };
  }

  for (const n of p.werelden) {
    const w = WERELDEN[n];
    const args = {};
    for (const v of w.vraagt) args[v] = ctx[v];
    /* De school zet een leerling klaar; heeft zij een kindtoken, dan speelt
       de spelwereld met dat kind in plaats van met de beheerder. */
    if (n === 'spel' && uit.werelden.school && uit.werelden.school.extra) {
      args.kindToken = uit.werelden.school.extra.kindToken || args.kindToken;
    }
    let r;
    try {
      r = await require(path.join(__dirname, w.module))[w.fn](args);
    } catch (e) {
      r = { klaar: false, reden: 'de bouwer liep vast: ' + e.message };
    }
    uit.werelden[n] = Object.assign({ klaar: !!(r && r.klaar), reden: (r && r.reden) || (r && r.klaar ? null : 'de bouwer gaf geen reden') },
      r && r.extra ? { extra: r.extra } : {}, r && r.stappen ? { stappen: r.stappen } : {});
  }

  /* Staat de wereld er na afloop nog? Alleen voor werelden die een controle
     kennen, en met de extras onder de naam die ./wereldcontrole.js gebruikt. */
  uit.controleer = async () => {
    const extras = {};
    for (const n of p.werelden) {
      const w = WERELDEN[n];
      if (w.controle && uit.werelden[n].extra) extras[w.controle] = uit.werelden[n].extra;
    }
    if (!Object.keys(extras).length) return { gecontroleerd: [], reden: 'geen gevraagde wereld met een controle' };
    const { controleerWerelden } = require('./wereldcontrole');
    return controleerWerelden({ post: ctx.post, extras, tokenVoor: ctx.tokenVoor });
  };
  return uit;
}

module.exports = { WERELDEN, FUNDERING_VAN, plan, bouw };
