/* Het verbond (B2, GEMEENSCHAP-FASE0.md par. 4.2): een afspraak tussen twee
   genootschappen over wat ze samen doen, en wie wat doet.

   DRIE REGELS DIE HET VERBOND KLEIN HOUDEN.

   1. HET VERBOND BEZIT GEEN LEDEN. Het kent twee kanten, elk een verwijzing naar
      een genootschap, en verder niemand. Wie lid of beheerder is vraagt het aan
      het genootschap (groepMet, isLid, isBeheer); het schrijft nooit in
      genootschap.groepen[].leden en houdt geen eigen ledenlijst bij. Een lid van
      de ene kant ziet van de andere kant de groepsnaam en niets anders --
      gegevens van een persoon gaan alleen over met zijn eigen
      connection-consent, en dat is geen verbond.
      test/verbond.test.js houdt dat vast op de BRON.

   2. DE KANT KOMT UIT DE SESSIE, NOOIT UIT HET VERZOEK. Een beheerder tekent voor
      het genootschap waar HIJ beheerder van is. Er is geen veld `kant` dat een
      aanroeper kan meesturen. En wie aan beide kanten beheerder is, tekent voor
      een kant: een verbond vraagt twee verschillende mensen, anders is het een
      handtekening met zichzelf.

   3. NIETS GAAT VANZELF (par. 2, regel 4). Voorstellen is geen tekenen; actief
      wordt het pas als beide kanten hebben getekend, en een wijziging van de
      tekst zet beide tekens terug -- wie tekende, tekende voor DIE tekst.
      Opzeggen kan elke kant eenzijdig, met een reden, en is een andere stand dan
      verlopen. Wat er besloten is blijft leesbaar: opzeggen is geen straf.

   Een herhaalde tik op tekenen of opzeggen geeft hetzelfde antwoord zonder
   tweede effect (geen tweede tijdlijnregel, geen tweede melding).

   Opslag: db.data.verbonden (eigen collectie). De tijdlijn is een hashketen
   (lib/keten), nieuwste eerst, en wordt nooit afgekapt. */
'use strict';

const keten = require('../../lib/keten');
const { AFSPRAAKVELDEN, toetsAfspraken } = require('../rtfos/partners');
const R = require('./regels');
const I = require('./invoer');

const REDEN_MAX = 300;

module.exports = ({ db, save, notify, genootschap, nu: klok }) => {
  if (!genootschap) throw new Error('kern/verbond: zonder genootschap is er niets om te verbinden.');
  const nu = () => (typeof klok === 'function' ? klok() : Date.now());
  const iso = () => new Date(nu()).toISOString();

  const eigen = require('../eigencollectie')({ db, domein: 'kern/verbond', bezit: { verbonden: 'lijst' } });
  const lijst = () => eigen.kijk('verbonden');      // lezen schept niets
  const bak = () => eigen.bak('verbonden');          // alleen voor wie schrijft

  const vind = (id) => lijst().find(v => v.id === String(id || '')) || null;
  const bekijk = (v, key) => R.weergave(v, key, { genootschap, nu: nu(), verifieer: keten.verifieer });
  const NIET_GEVONDEN = { status: 404, error: 'Dit verbond bestaat niet, of je hoort bij geen van beide kanten.' };

  function noteer(v, regel) {
    keten.noteerIn(v.tijdlijn, Object.assign({ at: iso() }, regel), 0);
  }

  /* Meldt de beheerders van de kanten waar de handelende NIET staat. Op de
     SLEUTEL van het lid en als object; nooit een tekst (opzet/meldingen.js).
     Een melding die niet aankwam verdwijnt niet stil: het antwoord zegt het. */
  function meldAnderen(v, key, eigenKanten, body) {
    let verstuurd = 0, gemist = 0;
    R.KANTEN.forEach((k, i) => {
      if (eigenKanten.includes(k)) return;
      const gr = genootschap.groepMet(v.kanten[i].ref);
      if (!gr) return;
      for (const l of (gr.leden || [])) {
        if (l.rol !== 'beheerder' || l.key === key) continue;
        try { notify(l.key, { title: 'Verbond', body }); verstuurd++; } catch (e) { gemist++; }
      }
    });
    return { verstuurd: verstuurd > 0 && gemist === 0, gemist };
  }

  // De naam zoals de ANDERE kant hem mag zien (geheim blijft geheim tot het tekent).
  const naamVan = (v, k) => {
    const gr = genootschap.groepMet(v.kanten[R.KANTEN.indexOf(k)].ref);
    return R.naamNaarBuiten(v, k, gr) || 'het andere genootschap';
  };

  /* Opzoeken voor wie er iets mee doet. Wie bij geen van beide kanten hoort,
     krijgt hetzelfde antwoord als bij een verzonnen id: een verbond bestaat niet
     voor wie er niet bij hoort. Een gewoon lid ziet een verbond pas als beide
     kanten ooit tekenden -- een concept is iets tussen beheerders. */
  function voorLid(sess, id) {
    const v = vind(id);
    if (!v) return { fout: NIET_GEVONDEN };
    const kk = R.kantenVan(v, sess.key, genootschap);
    if (!kk.lid.length) return { fout: NIET_GEVONDEN };
    if (!kk.beheer.length && !v.actiefSinds) return { fout: NIET_GEVONDEN };
    return { v, kk };
  }

  function voorBeheer(sess, id, wat) {
    const r = voorLid(sess, id);
    if (r.fout) return r;
    if (!r.kk.beheer.length) return { fout: { status: 403, error: 'Alleen een beheerder ' + wat + ', en alleen voor zijn eigen genootschap.' } };
    return r;
  }

  const voorstel = require('./voorstel')({ genootschap, lijst, bak, bekijk, noteer, meldAnderen, save, nu, iso });

  /* ---- tekenen ---- */
  function teken(sess, id) {
    const key = sess.key;
    const r = voorBeheer(sess, id, 'tekent');
    if (r.fout) return r.fout;
    const { v, kk } = r;
    const d = I.dicht(v, nu()); if (d) return d;

    const open = kk.beheer.filter(k => !v.tekens[k]);
    if (!open.length) return { ok: true, al: true, verbond: bekijk(v, key) };   // al getekend: zelfde antwoord, geen effect
    if (R.KANTEN.some(k => v.tekens[k] && v.tekens[k].door === key))
      return { status: 409, error: 'Je hebt al voor de andere kant getekend. Een verbond vraagt twee verschillende mensen; laat een andere beheerder tekenen.' };
    const mist = R.openAfspraak(v, AFSPRAAKVELDEN);
    if (mist) return { status: 409, error: 'Bij "' + mist + '" staat nog niet wie het doet. Een verbond wordt getekend als bij alle vijf de afspraken vaststaat wie wat doet; pas het eerst aan.' };

    const k = open[0];
    v.tekens[k] = { door: key, at: iso() };
    noteer(v, { wat: 'getekend', kant: k, door: key });
    const actief = R.standVan(v, nu()) === 'actief';
    if (actief && !v.actiefSinds) v.actiefSinds = v.tekens[k].at;
    if (actief) noteer(v, { wat: 'actief' });
    save();
    const melding = meldAnderen(v, key, [k], actief
      ? 'Het verbond met "' + naamVan(v, k) + '" is getekend door beide kanten en is nu actief.'
      : '"' + naamVan(v, k) + '" heeft het verbond getekend. Het wacht nu op jullie handtekening.');
    return { ok: true, verbond: bekijk(v, key), melding };
  }

  const wijzig = require('./wijzig')({ voorBeheer, bekijk, noteer, meldAnderen, naamVan, save, nu });

  /* ---- opzeggen: eenzijdig, met een reden, en wat er stond blijft leesbaar ---- */
  function zegOp(sess, id, reden) {
    const key = sess.key;
    const r = voorBeheer(sess, id, 'zegt een verbond op');
    if (r.fout) return r.fout;
    const { v, kk } = r;
    if (v.opzegging) {
      if (kk.beheer.includes(v.opzegging.kant)) return { ok: true, al: true, verbond: bekijk(v, key) };
      return I.dicht(v, nu());
    }
    const d = I.dicht(v, nu()); if (d) return d;
    const tekst = I.schoon(reden, REDEN_MAX);
    if (tekst.length < 3) return { status: 400, error: 'Waarom zeg je het verbond op? Een reden is verplicht, zodat de andere kant weet waar hij staat.' };
    const k = I.keur(tekst); if (!k.ok) return { status: 400, error: k.reden };

    const kant = kk.beheer[0];
    v.opzegging = { kant, door: key, at: iso(), reden: tekst };
    noteer(v, { wat: 'opgezegd', kant, door: key });
    save();
    const melding = meldAnderen(v, key, [kant], '"' + naamVan(v, kant) + '" heeft het verbond opgezegd: ' + tekst);
    return { ok: true, verbond: bekijk(v, key), melding };
  }

  /* ---- lezen ---- */
  function mijn(sess) {
    const key = sess.key;
    const uit = [];
    for (const v of lijst()) {
      const kk = R.kantenVan(v, key, genootschap);
      if (!kk.lid.length) continue;
      if (!kk.beheer.length && !v.actiefSinds) continue;
      uit.push(bekijk(v, key));
    }
    return { ok: true, verbonden: uit };
  }

  function lees(sess, id) {
    const r = voorLid(sess, id);
    if (r.fout) return r.fout;
    return { ok: true, verbond: bekijk(r.v, sess.key) };
  }

  return { voorstel, teken, wijzig, zegOp, mijn, lees, AFSPRAAKVELDEN, STANDEN: R.STANDEN };
};
