/* Wat er vandaag gebeurd is, in korte feiten.

   Rahul kan alleen over de dag van zijn mens kletsen als hij weet wat die dag
   was. Dat halen we NIET uit een dagboek dat we ergens bijhouden -- er komt
   geen nieuwe verzameling persoonsgegevens bij -- maar uit wat er toch al
   staat: de bestellingen en boekingen van vandaag. Meer niet.

   Wat er met opzet NIET in zit:
   - bedragen. Wat iemand uitgeeft gaat een vriend niets aan, ook niet bij
     benadering. Er staat hooguit "iets kleins" of "uitgebreid".
   - berichten, chats, locaties, agenda, gezondheid. Nooit.
   - andere mensen. Wie er meeging staat er niet in.

   De feiten gaan hierna door de namenlaag (./namen.js) en pas daarna naar het
   model. De echte namen verlaten deze module dus niet.

   Pure functie op meegegeven lijsten: de lezers (ordersVanKlant en
   boekingenVanKlant) komen van buiten, zodat dit los te toetsen is. */

const MAX = 12;                    // meer dan twaalf dingen op een dag is ruis

// hoeveel het was, zonder ooit een bedrag te noemen
function omvang(n) {
  if (!(n > 0)) return 'iets';
  if (n <= 2) return 'iets kleins';
  if (n <= 5) return 'een normale ronde';
  return 'uitgebreid';
}
const uurVan = (iso) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.getHours() : null;
};
const dagdeelVan = (u) => u == null ? '' : (u < 6 ? 'vannacht' : u < 12 ? 'vanochtend' : u < 18 ? 'vanmiddag' : 'vanavond');

/* Welke soort zaak is dit? Bepaalt welk soort verzonnen naam hij krijgt, zodat
   een restaurant geen "Villa" wordt en een hotel geen "Bistro". */
function soortVanType(type) {
  const t = String(type || '').toLowerCase();
  if (/hotel|appartement|villa|resort|verblijf/.test(t)) return 'hotel';
  if (/restaurant|bar|club|beach|cafe|horeca|food/.test(t)) return 'horeca';
  if (/winkel|retail|mode|boutique|mall/.test(t)) return 'winkel';
  return 'dienst';
}

/* De feiten van vandaag voor een handle. Geeft een lijst van
   { soort, dagdeel, zaakSoort, zaak, wat } met ECHTE namen; de namenlaag komt
   erna. Leeg is een geldig antwoord: niet elke dag gebeurt er iets. */
function dagbeeld({ ordersVanKlant, boekingenVanKlant }, handle, nu) {
  const nu2 = nu ? new Date(nu) : new Date();
  const dag = nu2.toISOString().slice(0, 10);
  const vandaag = (t) => String(t && t.at || '').slice(0, 10) === dag;
  const uit = [];

  for (const o of (ordersVanKlant ? ordersVanKlant(handle) : []) || []) {
    if (!vandaag(o)) continue;
    const stuks = (o.items || []).reduce((n, i) => n + (i.qty || 1), 0);
    uit.push({
      soort: 'besteld',
      dagdeel: dagdeelVan(uurVan(o.at)),
      zaakSoort: soortVanType(o.type),
      zaak: o.supplierName || '',
      wat: omvang(stuks)
    });
  }
  for (const b of (boekingenVanKlant ? boekingenVanKlant(handle) : []) || []) {
    if (!vandaag(b)) continue;
    uit.push({
      soort: b.kind === 'ticket' ? 'ticket' : 'geboekt',
      dagdeel: dagdeelVan(uurVan(b.at)),
      zaakSoort: soortVanType(b.type),
      zaak: b.supplierName || '',
      wat: (b.service && b.service.name) || ''
    });
  }
  return uit.slice(0, MAX);
}

/* De feiten omzetten naar regels die het model mag lezen: echte namen eruit,
   verzonnen namen erin. Dit is de enige weg naar buiten. */
function verhul(feiten, namen) {
  return (feiten || []).map(f => {
    const zaak = namen.voor(f.zaakSoort, f.zaak);
    if (f.soort === 'besteld') return [f.dagdeel, 'besteld bij', zaak, '(' + f.wat + ')'].filter(Boolean).join(' ');
    if (f.soort === 'ticket') return [f.dagdeel, namen.bezigheid(f.wat || f.zaak), 'bij', zaak].filter(Boolean).join(' ');
    return [f.dagdeel, 'iets geboekt bij', zaak].filter(Boolean).join(' ');
  });
}

module.exports = { dagbeeld, verhul, omvang, soortVanType, MAX };
