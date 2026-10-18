/* RTG One, deel "vandaag": WAT ER UIT DE ANDERE DOMEINEN OP TAFEL LIGT.

   Afgesplitst uit ./rtgone.js (18 oktober 2026). Dit is een PROJECTIE: hij
   leest taken van de werkplek en van RTF, de eigen agenda, de RTMail aan de
   eigen codenaam en open aanvragen, en schrijft niets. Daarom apart van het
   werkgeheugen ernaast, dat wel schrijft -- en omdat dit het enige stuk van RTG
   One is dat in collecties van ANDERE domeinen kijkt, staat die lijst hier op
   een plek. Een beperkte mail (kern/rtmail-leiding.js) komt er niet in.

   `data` komt van ./rtgone.js: de deur naar de opslag blijft daar, ook voor
   wat dit deel leest. */
'use strict';
const { isBeperkt } = require('./rtmail-leiding');

module.exports = ({ data }) => {
  /* Het gedeelde postvak, ook voor ./rtgone-projecten.js (een project van een
     mail). Beide lezers filteren met isBeperkt: hieronder in het overzicht,
     daar bij het zoeken van de mail. */
  const bron = { rtmailBerichten: () => (((data().rtmail || {}).berichten) || []) };
  function liveVandaag(huis, context) {
    const d = data(), lijst = x => Array.isArray(x) ? x : [], persoonlijk = !!(context && context.key);
    const huisTaken = lijst((d.werkplekTaken || {})[huis]).filter(t => !t.af).slice(0, 8).map(t => ({ soort: 'taak', titel: t.tekst, at: t.at || null }));
    const rtfTaken = huis === 'rtf' ? Object.values(d.rtfKantoorTaken || {}).flatMap(x => lijst(x)).filter(t => !t.af).slice(0, 8).map(t => ({ soort: 'rtf', titel: t.tekst, at: t.at || null })) : [];
    const agenda = persoonlijk ? lijst((d.agendas || {})[context.key]).filter(x => !x.afgerond && !x.af).slice(0, 8).map(x => ({ soort: 'agenda', titel: x.titel || x.tekst || x.onderwerp || 'Agenda-item', at: x.start || x.at || x.datum || null })) : [];
    const adres = context && context.codename ? String(context.codename).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@rtmail' : null;
    const mail = adres ? lijst((d.rtmail || {}).berichten).filter(m => m.naar === adres && !m.gearchiveerd && !isBeperkt(m)).slice(0, 12).map(m => ({ id: m.id, soort: 'rtmail', titel: m.onderwerp, at: m.at, van: m.van, gelezen: !!m.gelezen, preview: String(m.tekst || '').slice(0, 180) })) : [];
    const goedkeuringen = huis === 'rtg'
      ? lijst(d.partnerApplications).filter(x => x.status !== 'afgerond' && x.status !== 'afgewezen').slice(0, 6).map(x => ({ soort: 'goedkeuring', titel: 'Partneraanvraag · ' + (x.naam || x.name || x.bedrijf || 'Nieuwe partner'), at: x.at || null }))
      : lijst(d.labProjecten).filter(x => (x.veiligheid || {}).status === 'open').slice(0, 6).map(x => ({ soort: 'veiligheid', titel: 'Veiligheidstoets · ' + (x.titel || 'RTF-project'), at: x.at || null }));
    const alles = [...mail, ...agenda, ...goedkeuringen, ...huisTaken, ...rtfTaken].slice(0, 24);
    return { persoonlijk, identiteit: context && context.label || 'Gedeelde kantoorcode', adres, items: alles,
      telling: { rtmail: mail.length, agenda: agenda.length, goedkeuringen: goedkeuringen.length, taken: huisTaken.length + rtfTaken.length } };
  }
  return { liveVandaag, rtmailBerichten: bron.rtmailBerichten };
};
