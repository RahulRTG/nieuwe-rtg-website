/* RTMAIL (deelmodule): de KLOK op een gedeeld postvak, en de ontvangst-
   bevestiging die hem betekenis geeft.

   Deze twee horen bij elkaar en staan daarom in EEN bestand. De regel is
   dezelfde als bij de tickets in het Werk OS (server/bedrijf/service.js): de
   klok loopt tot het eerste MENSELIJKE antwoord, en een automatisch bericht
   stopt hem niet. Een SLA die op de robot stopt, meet hoe snel de robot is.

   WAAROM DE BEVESTIGING HIER STAAT EN NIET BIJ DE INSTELLINGEN. Toen deze laag
   alleen de klok had, KON die regel niet misgaan: er bestond geen automatisch
   antwoord dat vanaf een teamadres in een draad kon belanden, dus de mutatie
   die "stop bij elk antwoord" maakte, brak niets. Een bewering die niet kan
   zakken is geen bewering. De ontvangstbevestiging maakt hem echt -- en is
   bovendien wat een vrager verdient: weten dat zijn bericht is aangekomen.

   DRIE LUS-REMMEN, want een automatisch antwoord is de bekendste manier om
   twee postvakken eindeloos tegen elkaar te laten praten: nooit op een
   automatisch bericht, nooit op post van het team aan zichzelf, en maar EEN
   bevestiging per gesprek. */
const adresLaag = require('./rtmail-adres');

// wat NIET als antwoord telt voor de klok: door de machine geschreven post
const AUTOMATISCH = ['bevestiging', 'afwezig'];
// de afspraak per prioriteit, in minuten tot het EERSTE menselijke antwoord
const NORM_MINUTEN = { urgent: 30, hoog: 120, normaal: 480, laag: 1440 };

module.exports = ({ db, save, rtmail, team }) => {
  const kap = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n);
  const store = () => {
    if (!db.data.rtmail || !Array.isArray(db.data.rtmail.berichten)) db.data.rtmail = { berichten: [] };
    return db.data.rtmail;
  };

  /* Wie er al geantwoord heeft: elk bericht in dezelfde draad dat van het
     teamadres komt. Afgeleid uit de post zelf, niet uit een tweede lijst. */
  function antwoorden(t, m) {
    const draad = m.draad || m.id;
    return store().berichten
      .filter(x => (x.draad || x.id) === draad && adresLaag.zelfdeBus(x.van, t.adres))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .map(x => ({ id: x.id, at: x.at, door: x.door || null, automatisch: AUTOMATISCH.includes(x.soort) }));
  }

  /* De klok. Loopt vanaf het binnenkomen tot het eerste MENSELIJKE antwoord;
     een afwezigheidsbericht of een systeembericht stopt hem niet. */
  function klok(t, m, d) {
    const norm = NORM_MINUTEN[d.prioriteit] || NORM_MINUTEN.normaal;
    const eerste = antwoorden(t, m).find(a => !a.automatisch) || null;
    const start = new Date(m.at).getTime();
    const eind = eerste ? new Date(eerste.at).getTime() : Date.now();
    const minuten = Math.max(0, Math.round((eind - start) / 60000));
    return { normMinuten: norm, verstrekenMinuten: minuten, beantwoord: !!eerste,
      beantwoordAt: eerste ? eerste.at : null, overschreden: minuten > norm };
  }

  /* De automatische ontvangstbevestiging van een gedeeld postvak. Hij bestaat
     om twee redenen, en de tweede is de belangrijkste:

     1. Een vrager hoort te weten dat zijn bericht ergens is aangekomen.
     2. Hij maakt de SLA-regel hierboven WAAR in plaats van theoretisch. Zonder
        een automatisch antwoord in de draad kon "de klok stopt bij een mens"
        nooit misgaan, en dus ook nooit worden getoetst. Zo'n bewering is geen
        bewering maar een wens. */
  function zetBevestiging(sess, teamId, tekst) {
    const t = team.teamMet(teamId);
    if (!t) return { error: 'Dit team bestaat niet.' };
    if (t.eigenaar !== sess.key) return { error: 'Alleen de eigenaar stelt de ontvangstbevestiging in.' };
    t.bevestiging = kap(tekst, 600) || null;
    save();
    return { ok: true, bevestiging: t.bevestiging,
      let: 'Deze bevestiging telt NIET als antwoord: de klok blijft lopen tot een mens reageert.' };
  }

  /* Hangt aan de haak na elke bezorging (opzet/diensten2.js). Bevestigt een
     keer per gesprek, nooit een automatisch bericht, en nooit post van het team
     aan zichzelf -- dat zijn de drie manieren waarop dit een lus zou worden. */
  function naBezorging(m) {
    if (!m || !m.naar) return;
    const t = (db.data.rtmailTeams && db.data.rtmailTeams.teams || [])
      .find(x => adresLaag.zelfdeBus(x.adres, m.naar));
    if (!t || !t.bevestiging) return;
    if (AUTOMATISCH.includes(m.soort) || m.bron === 'systeem') return;
    if (adresLaag.zelfdeBus(m.van, t.adres)) return;
    const draad = m.draad || m.id;
    const al = store().berichten.some(x => (x.draad || x.id) === draad &&
      x.soort === 'bevestiging' && adresLaag.zelfdeBus(x.van, t.adres));
    if (al) return;
    rtmail.stuur({ van: t.adres, naar: m.van,
      onderwerp: /^re:/i.test(m.onderwerp) ? m.onderwerp : 'Re: ' + m.onderwerp,
      tekst: t.bevestiging, soort: 'bevestiging', bron: 'lid', antwoordOp: m.id });
  }

  return { AUTOMATISCH, NORM_MINUTEN, antwoorden, klok, zetBevestiging, naBezorging };
};
