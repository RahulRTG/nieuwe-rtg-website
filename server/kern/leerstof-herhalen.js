/* RTG School: de herhaalsessie -- de vragenkant van de Memory Engine.

   De planning (wanneer komt iets terug) staat in kern/onderwijs-geheugen.js:
   die weet van tijd en niet van sommen. Hier staat het omgekeerde -- welke drie
   vragen dat dan zijn -- want de leerstof weet van sommen en niet van tijd.

   Drie vragen, niet de hele les opnieuw: een herhaling is een ophaling uit je
   geheugen en geen tweede keer leren.

   Waarom dit GEEN eigen antwoordroute heeft: een herhaalvraag hoort er in het
   scherm precies hetzelfde uit te zien als een nieuwe vraag, en de zekerste
   manier om dat waar te maken is om er dezelfde weg van te maken. Een
   herhaalsessie zet zichzelf in dezelfde sessieplek als een oefensessie en
   wordt beantwoord door dezelfde functie; alleen aan het EIND loopt het anders
   af. Zo kan er nooit per ongeluk een merkteken bij komen dat zegt "dit had je
   moeten weten". */
const { HERHAAL_VRAGEN, HERHAAL_DREMPEL } = require('./onderwijs-geheugen');

function maakHerhalen({ onderwijs, sessies, save, opgave, DOELEN, nu }) {
  /* Wat komt er terug. Doelen die niet (meer) in de leerlijn staan vallen weg:
     zonder generator valt er niets te herhalen. Het aantal telt daarom wat er
     echt te doen is en niet wat er in het paspoort staat. */
  function lijst(key) {
    const r = onderwijs.herhalingen(key);
    const naam = o => { const d = DOELEN[o.doel]; return d ? { doel: o.doel, naam: d.naam, vak: d.vak } : null; };
    const open = r.open.map(naam).filter(Boolean);
    const later = r.later.map(o => { const d = naam(o); return d ? Object.assign(d, { volgende: o.volgende }) : null; }).filter(Boolean);
    return { ok: true, open, aantal: open.length, later, vragen: HERHAAL_VRAGEN, uitleg: r.uitleg };
  }

  /* Een herhaling mag ook als het moment nog niet daar is: zelf iets willen
     ophalen is nooit verkeerd. Wat niet mag is een doel herhalen dat je nog
     niet behaald hebt -- dat is geen herhaling maar gewoon oefenen. */
  function start(key, d) {
    const id = String(d && d.doel || '');
    const doel = DOELEN[id];
    if (!doel) return { status: 404, error: 'Dat leerdoel staat niet in de leerlijn.' };
    if (!((onderwijs.mijn(key).doelen) || {})[id]) return { status: 400, error: 'Dit leerdoel staat nog niet in je paspoort; oefen het eerst.' };
    const vragen = [];
    for (let i = 0; i < HERHAAL_VRAGEN; i++) vragen.push(opgave(doel.gen));
    sessies()['lid:' + key] = { doel: id, vragen, ix: 0, goed: 0, drempel: HERHAAL_DREMPEL, at: nu(), herhaling: true };
    save();
    const v = vragen[0];
    return { ok: true, doel: id, naam: doel.naam, totaal: HERHAAL_VRAGEN, nr: 1, vraag: v.v, opties: v.opties || null };
  }

  /* Het einde van een herhaalsessie. Twee dingen die hier NIET gebeuren:
     het leerdoel raak je niet kwijt (een mindere dag wist geen beheersing), en
     er wordt geen bewijs vastgelegd van wat er niet lukte -- dit huis houdt
     geen dossier bij van de missers van een kind. Wat wel telt: een geslaagde
     ophaling na weken is beter bewijs dan de eerste keer, dus die wordt
     bijgeschreven. */
  function klaar(key, s) {
    const gelukt = s.goed >= (s.drempel || HERHAAL_DREMPEL);
    if (gelukt) onderwijs.doelBehaald(key, { doel: s.doel,
      bewijs: { soort: 'herhaling', detail: s.goed + ' van ' + s.vragen.length + ' goed, na een tijd' } });
    const stand = onderwijs.noteerOphaling(key, s.doel, gelukt);
    return { herhaald: true, gelukt,
      slot: gelukt
        ? 'Dat zit er goed in. Dit komt over een tijd nog eens langs.'
        : 'Deze komt binnenkort nog een keer langs. Even opnieuw ophalen is precies waar herhalen voor is.',
      volgende: (stand && stand.volgende) || null };
  }

  return { herhaalLijst: lijst, herhaalStart: start, herhaalKlaar: klaar };
}

module.exports = { maakHerhalen };
