/* RTG Mall, deelbestand "stand-agenda": HET EERSTVOLGENDE VRIJE MOMENT.

   Wanneer kun je hier terecht? Dat komt uit dezelfde tijdslotenlijst waarmee je
   ook werkelijk boekt (kern/vakwerk/agenda.js en kern/foodcourt.js), zodat het
   getal op de Mall-kaart en het getal in het boekscherm nooit uit elkaar kunnen
   lopen.

   WAAROM DIT APART STAAT EN NIET OVER DE HELE MALL LOOPT. Deze vraag kost per
   zaak per dag een gang langs de boekingen. Over duizenden aanbod-objecten is
   dat een zoekopdracht die staat te rekenen voor kaarten die niemand ziet.
   `verrijk()` krijgt daarom alleen de zichtbare pagina (hoogstens zestig) en
   vult daar het eerstvolgende moment in. De goedkope stand (open/dicht,
   voorraad) geldt wel voor alles, zodat de filters over de hele Mall werken.

   DE KLOK VAN DE ZAAK. vakwerk en de foodcourt rekenen intern in servertijd:
   `slots()` laat de tijden weg die vandaag al voorbij zijn, gemeten op de
   server. Voor een zaak in een andere zone klopt dat niet. Daarom vragen we
   hier de LOKALE datum van de zaak op, en filteren we de tijden van haar
   vandaag zelf tegen haar eigen klok. Wat overblijft is een gat dat we niet
   dichten en dus benoemen: staat een zaak OOSTELIJK van de server, dan kan
   `slots()` een tijdvak al hebben weggelaten dat daar nog niet voorbij is. Die
   reparatie hoort in vakwerk zelf, niet in een leeslaag eroverheen. */

const naarMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const dagnaam = (i, datum) => i === 0 ? 'vandaag' : (i === 1 ? 'morgen'
  : new Intl.DateTimeFormat('nl-NL', { weekday: 'long', timeZone: 'UTC' }).format(new Date(datum + 'T12:00:00Z')));

module.exports = (ctx, hulp) => {
  const { db } = ctx;
  const { vakwerk, foodcourt, neemtAan, nuBij } = hulp;

  // de kalenderdatum bij de zaak, i dagen vooruit
  function datumBij(s, i) {
    const t = nuBij(s);
    const d = new Date(t.datum + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  }

  /* Het eerstvolgende vrije tijdvak van een dienstverlener. Kijkt maximaal een
     week vooruit; verder dan dat is "bel even" een eerlijker antwoord dan een
     datum. */
  function eerstVrij(s, dienstId, periode) {
    const vw = vakwerk();
    if (!vw || !vw.isVak(s) || !neemtAan(s, 'reserveren')) return null;
    const nu = nuBij(s);
    const dagen = periode ? 14 : 7;
    for (let i = 0; i < dagen; i++) {
      const datum = datumBij(s, i);
      if (periode && periode.van && datum < periode.van) continue;
      if (periode && periode.tot && datum > periode.tot) break;
      const r = vw.slots(s.code, dienstId, datum);
      if (!r || !r.ok || !r.tijden.length) continue;
      // op de eigen dag van de zaak tellen alleen de tijden die daar nog komen
      const tijden = i === 0 ? r.tijden.filter(t => naarMin(t) > nu.minuten) : r.tijden;
      if (!tijden.length) continue;
      return { datum, tijd: tijden[0], tekst: 'Eerste plek ' + dagnaam(i, datum) + ' om ' + tijden[0], hard: true };
    }
    return null;
  }

  /* De eerstvolgende vrije tafel, uit dezelfde tijdslotenlijst waarmee je ook
     werkelijk reserveert. */
  function eersteTafel(s, personen, periode) {
    const fc = foodcourt();
    if (!fc || !fc.isEetgelegenheid(s) || !neemtAan(s, 'reserveren')) return null;
    const nu = nuBij(s);
    const dagen = periode ? 14 : 3;
    for (let i = 0; i < dagen; i++) {
      const datum = datumBij(s, i);
      if (periode && periode.van && datum < periode.van) continue;
      if (periode && periode.tot && datum > periode.tot) break;
      const r = fc.tijden(s.code, datum, personen || 2);
      if (!r || !r.ok || !r.open) continue;
      const vrij = (r.slots || []).find(x => !x.vol && (i > 0 || naarMin(x.tijd) > nu.minuten));
      if (!vrij) continue;
      return { datum, tijd: vrij.tijd, tekst: 'Tafel ' + dagnaam(i, datum) + ' om ' + vrij.tijd, hard: true };
    }
    return null;
  }

  /* De zichtbare pagina verrijken. Krijgt hoogstens een pagina aan aanbod en
     vult daar het eerstvolgende vrije moment in. */
  function verrijk(items, periode) {
    const zaken = new Map((db.data.suppliers || []).map(s => [s.code, s]));
    const agenda = (a) => a.type === 'dienst' || a.type === 'offerte' || a.type === 'eten';
    return items.map(a => {
      if (!a.aanbieder.code) return a;
      const s = zaken.get(a.aanbieder.code);
      if (!s) return a;
      let beter = null;
      if (a.type === 'dienst' || a.type === 'offerte') beter = eerstVrij(s, (a.id.split(':')[2] || null), periode);
      else if (a.type === 'eten') beter = eersteTafel(s, 2, periode);
      if (beter) return { ...a, beschikbaar: beter };
      /* Niets vrij binnen de gevraagde periode is een ANTWOORD. Zonder deze
         regel zag "geen plek tussen 13 en 19 augustus" er precies zo uit als
         "deze zaak houdt geen agenda bij". */
      if (periode && agenda(a)) {
        return { ...a, beschikbaar: { tekst: 'Niets vrij in deze periode', hard: false, buitenPeriode: true } };
      }
      return a;
    });
  }

  return { eerstVrij, eersteTafel, verrijk };
};
