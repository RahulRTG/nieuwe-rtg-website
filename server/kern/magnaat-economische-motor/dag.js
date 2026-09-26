/* Magnaat Economische Motor -- een economische dag, in JavaScript of met Rust.

   Een dag is een commando met een sleutel: dezelfde sleutel twee keer is een
   dag, niet twee. Alle boekingen van de dag dragen die sleutel als oorzaak, en
   ze gaan pas het journaal in als de hele dag gerekend is (`bevestig`). */
'use strict';
const { MAX_HISTORIE, datumOpDag } = require('./constanten');
const rtgKlok = require('../../lib/klok');

module.exports = (m) => {
  let laatsteRustFoutlog = 0;
  let rustFoutlogsOnderdrukt = 0;

  function meldRustFout(reden) {
    const nu = rtgKlok.nu();
    if (nu - laatsteRustFoutlog < 15000) {
      rustFoutlogsOnderdrukt += 1;
      return;
    }
    const onderdrukt = rustFoutlogsOnderdrukt
      ? ` (${rustFoutlogsOnderdrukt} gelijke meldingen onderdrukt)`
      : '';
    console.error('[magnaat-rust] veilige terugval naar JS:', reden, onderdrukt);
    laatsteRustFoutlog = nu;
    rustFoutlogsOnderdrukt = 0;
  }

  function neemMoment(e) {
    const moment = {
      dag: e.dag, datum: datumOpDag(e.dag), schok: e.actieveSchok.id,
      macro: Object.assign({}, e.macro),
      bedrijven: Object.fromEntries(Object.values(e.bedrijven).map(b => [b.id, {
        omzet: b.omzetVandaag, winst: b.winstVandaag, kas: m.kas(e, b.id), schuld: m.creditWaarde(e, b.id + '.schuld'),
        personeel: b.personeel, prijs: b.prijs, kwaliteit: b.kwaliteit, reputatie: b.reputatie,
        vraag: b.vraagVandaag, verkoop: b.verkopenVandaag, capaciteit: b.capaciteitVandaag, voorraad: b.voorraad,
        kosten: Object.assign({}, b.kostenUitsplitsing || {})
      }]))
    };
    e.historie.push(moment);
    if (e.historie.length > MAX_HISTORIE) e.historie.shift();
    return moment;
  }

  function wisWerk(e) {
    e.werk = { aantal: 0, productiviteit: 0, service: 0, controle: 0, impact: 0, innovatie: 0, bronnen: [] };
  }

  const schoonCommando = (id) => String(id || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 120);
  const zonderCommando = { status: 400, error: 'Een unieke commandosleutel is nodig om dubbel verwerken te voorkomen.' };

  function sluitDag(e, actor, commandoId, wie) {
    neemMoment(e);
    if (m.haken.naDag) m.haken.naDag(e);
    wisWerk(e);
    e.commandos[commandoId] = e.dag;
    const sleutels = Object.keys(e.commandos);
    if (sleutels.length > 500) for (const k of sleutels.slice(0, sleutels.length - 500)) delete e.commandos[k];
    m.audit(e, actor, 'volgende-dag', 'Economische dag ' + e.dag + ' verwerkt' + wie);
    m.markeerMutatie(e);
    m.bevestig(e);
    m.save();
  }

  function volgendeDag(actor, commandoId) {
    const e = m.state();
    commandoId = schoonCommando(commandoId);
    if (!commandoId) return zonderCommando;
    if (e.commandos[commandoId]) return Object.assign({ ok: true, herhaald: true }, m.overzicht(actor), { verwerktCommando: commandoId });
    m.metOorzaak('commando:' + commandoId, () => {
      e.dag += 1;
      e.actieveSchok = m.schokVoorDag(e);
      m.berekenMarkt(e);
    });
    sluitDag(e, actor, commandoId, '');
    return Object.assign({ ok: true, herhaald: false, verwerktCommando: commandoId }, m.overzicht(actor));
  }

  async function volgendeDagViaMotor(actor, commandoId) {
    commandoId = schoonCommando(commandoId);
    if (!commandoId) return zonderCommando;
    for (let poging = 0; poging < 3; poging++) {
      const live = m.state();
      if (live.commandos[commandoId]) return Object.assign({ ok: true, herhaald: true }, m.overzicht(actor), { verwerktCommando: commandoId });
      const basisVersie = live.mutatieVersie;
      const schok = m.schokZonderMutatie(live, live.dag + 1);
      let antwoord;
      try {
        antwoord = await m.motor.markt(m.rustInvoerVoor(live, schok));
        m.valideerRustAntwoord(antwoord, Object.values(live.bedrijven));
      } catch (fout) {
        /* Rust werkt uitsluitend op het kleine rekenmodel. De live staat is heel en
           kan zonder herstel of verloren gelijktijdige mutatie door JS verder. */
        meldRustFout(fout && fout.message);
        return volgendeDag(actor, commandoId);
      }
      const nogLive = m.state();
      if (nogLive === live && nogLive.mutatieVersie === basisVersie) {
        /* Vanaf hier zit geen await: de commit is één synchrone kritieke sectie.
           schokVoorDag wist een eventuele geforceerde schok pas nu. */
        m.metOorzaak('commando:' + commandoId, () => {
          live.dag += 1;
          live.actieveSchok = m.schokVoorDag(live);
          m.pasRustAntwoordToe(live, antwoord);
        });
        sluitDag(live, actor, commandoId, ' door Rust');
        return Object.assign({ ok: true, herhaald: false, verwerktCommando: commandoId, rekenmotor: 'rust' }, m.overzicht(actor));
      }
      // Een missie of strategie kwam binnen tijdens de await. Reken opnieuw op
      // die nieuwste waarheid; overschrijf haar nooit met de oudere kopie.
    }
    meldRustFout('economie bleef veranderen');
    return volgendeDag(actor, commandoId);
  }

  function volgendeDagAsync(actor, commandoId) {
    return m.motor.aan ? volgendeDagViaMotor(actor, commandoId) : volgendeDag(actor, commandoId);
  }

  return { neemMoment, volgendeDag, volgendeDagAsync };
};
