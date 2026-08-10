/* Een live zaakdata-blok oplossen naar gewone blokken: per bron een eigen
   stukje kennis over hoe het zaakprofiel eruitziet.

   Een bron zonder inhoud lost op naar NIETS -- geen lege kop "Menu" op een
   site, want dat is erger dan geen menu. Alles wat hier naar buiten komt,
   stond al buiten: de publieke zaakgegevens, gepubliceerde events, openstaande
   vacatures en het reviewgemiddelde. */
module.exports = ({ db, geld, veiligBeeld, rating, DAGEN, team, salonBeeld }) => {
  function los(blok, s) {
    const uit = [];
    const kop = t => uit.push({ id: blok.id + '-k', type: 'kop', tekst: t });
    const item = (id, t) => uit.push({ id: blok.id + '-' + id, type: 'tekst', tekst: t });
    const regel = x => [x.name, x.desc].filter(Boolean).join(' -- ') + (x.price != null || x.prijs != null ? '  ·  ' + geld(x.price != null ? x.price : x.prijs) : '');
    const bron = blok.bron;

    if (bron === 'menu' && (s.menu || []).length) {
      kop('Menu');
      s.menu.slice(0, 30).forEach((x, i) => item('m' + i, regel(x)));
    } else if (bron === 'diensten' && (s.services || []).length) {
      kop('Diensten');
      s.services.slice(0, 30).forEach((x, i) => item('d' + i, regel(x)));
    } else if (bron === 'kamers') {
      const rooms = (s.rooms || []).filter(r => r.available);
      if (rooms.length) {
        kop('Kamers');
        rooms.slice(0, 30).forEach((x, i) => item('r' + i, regel(x)));
      }
    } else if (bron === 'agenda' && (s.activiteiten || []).length) {
      kop('Activiteiten');
      s.activiteiten.slice(0, 30).forEach((x, i) =>
        item('a' + i, regel(x) + (x.duur ? '  ·  ' + x.duur : '') + ((x.tijden || []).length ? '  ·  ' + x.tijden.join(' / ') : '')));
    } else if (bron === 'events') {
      // alleen wat de zaak zelf heeft gepubliceerd; een concept-event is geen aankondiging
      const ev = (s.events || []).filter(e => e.published);
      if (ev.length) {
        kop('Wat er te doen is');
        ev.slice(0, 20).forEach((e, i) =>
          item('e' + i, [e.name, e.date + (e.time ? ' ' + e.time : ''), e.desc].filter(Boolean).join(' -- ') + (e.price != null ? '  ·  ' + geld(e.price) : '')));
      }
    } else if (bron === 'vacatures') {
      /* De openstaande vacatures van deze zaak. Die staan toch al in de
         publieke vacaturelijst van kern/werk.js -- dit blok verplaatst niets
         naar buiten wat niet al buiten stond. */
      const vac = ((db.data.vacatures || {})[s.code] || []).filter(v => v.open);
      if (vac.length) {
        kop('Werken bij ' + s.name);
        vac.slice(0, 20).forEach((v, i) =>
          item('v' + i, [v.func, v.uren, v.plaats].filter(Boolean).join(' · ') + (v.omschrijving ? ' -- ' + v.omschrijving : '')));
      }
    } else if (bron === 'openingstijden') {
      /* De beschikbaarheid van een dienstverlenende zaak (vakUren). Zaken
         zonder die laag hebben hier niets, en dan staat er ook niets: liever
         geen blok dan een blok dat "gesloten" suggereert. */
      const u = s.vakUren;
      const dagen = u && Array.isArray(u.dagen) && u.dagen.length === 7 ? u.dagen : null;
      if (dagen && u.van && u.tot) {
        kop('Openingstijden');
        const open = DAGEN.filter((_, i) => dagen[i]);
        item('u', open.length ? open.join(', ') + ': ' + u.van + ' - ' + u.tot : 'Op afspraak.');
      }
    } else if (bron === 'team') {
      /* Alleen de mensen die de leiding hiervoor heeft aangewezen, en alleen
         hun naam en functie. Wie niet is aangewezen of uit dienst is, staat er
         niet -- dat wordt bij ieder bezoek opnieuw gevraagd (kern/webmaker-team.js). */
      const mensen = team ? team.publiek(s.code) : [];
      if (mensen.length) {
        kop('Ons team');
        mensen.slice(0, 60).forEach((m, i) => item('t' + i, [m.naam, m.func].filter(Boolean).join(' -- ')));
      }
    } else if (bron === 'salon') {
      /* Uitgelicht beeld uit De Salon. De merkregel van dit huis is niet alleen
         DAT dit beeld gebruikt wordt maar ook HOE: altijd met naamsvermelding.
         Daarom een beeld-blok per foto met "Uit De Salon · naam" als bijschrift
         en niet een galerij, want een galerij kan geen naam dragen. */
      const beelden = salonBeeld ? salonBeeld(6) : [];
      beelden.forEach((f, i) => uit.push({ id: blok.id + '-s' + i, type: 'beeld',
        src: f.src, bijschrift: 'Uit De Salon · ' + f.naam }));
    } else if (bron === 'fotos') {
      const beelden = (s.photos || []).filter(veiligBeeld).slice(0, 12);
      if (beelden.length) uit.push({ id: blok.id + '-g', type: 'galerij', beelden });
    } else if (bron === 'reviews') {
      const r = rating(s);
      if (r) uit.push({ id: blok.id + '-q', type: 'citaat',
        tekst: r.score + ' gemiddeld, uit ' + r.aantal + ' beoordeling' + (r.aantal === 1 ? '' : 'en') + ' van leden.',
        bron: 'Geverifieerde RTG-reviews' });
    } else if (bron === 'contact') {
      kop('Bezoek ons');
      uit.push({ id: blok.id + '-c', type: 'kolommen',
        lk: s.city || 'Locatie', lt: (s.loc && s.loc.label) || s.city || '',
        rk: 'Via RTG', rt: 'Reserveren, bestellen en contact lopen via de RTG leden-app -- met je RTG-identiteit, zonder losse accounts.' });
    }
    return uit;
  }

  return los;
};
