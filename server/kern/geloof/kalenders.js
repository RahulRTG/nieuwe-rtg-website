/* Kalenderrekenwerk: de islamitische en de joodse kalender, en Pasen.

   Drie tradities rekenen hun feesten op een eigen manier uit. Dat willen we
   zelf kunnen, om dezelfde reden als bij de gebedstijden: aan een derde vragen
   wanneer iemands feestdag is, verraadt zijn geloof.

   Eerlijk over wat dit wel en niet is:
   - de JOODSE kalender is hier exact. Die is volledig berekend (molad plus de
     vier uitstelregels), al eeuwen vastgelegd, en dat rekenen we gewoon na;
   - PASEN is exact (de kerkelijke rekenregel van Meeus, westers);
   - de ISLAMITISCHE kalender is hier de TABELVARIANT, en die kan een dag
     schelen met de echte maand. Die begint namelijk bij het zien van de
     maansikkel, en dat verschilt per land en per gemeenschap. We geven de
     berekende dag, en we zeggen er altijd bij dat de plaatselijke aankondiging
     voorgaat. Doen alsof dit exact is, zou juist bij een feestdag pijnlijk
     misgaan. */

const DAG = 86400000;

function utc(y, m, d) { return Date.UTC(y, m - 1, d); }
const naarDatum = (ms) => new Date(ms);
const dagVerschil = (a, b) => Math.round((a - b) / DAG);

/* ---------- islamitische kalender (tabelvariant) ----------
   Omzetting via de juliaanse dag, met de gebruikelijke 30-jarige cyclus
   (elf schrikkeljaren). Tijdrekening vanaf 16 juli 622 (astronomisch). */
function hijriNaarJd(jaar, maand, dag) {
  return dag + Math.ceil(29.5 * (maand - 1)) + (jaar - 1) * 354 +
    Math.floor((3 + 11 * jaar) / 30) + 1948439.5 - 1;
}
function jdNaarHijri(jd) {
  jd = Math.floor(jd) + 0.5;
  const jaar = Math.floor((30 * (jd - 1948439.5) + 10646) / 10631);
  const eersteVanJaar = hijriNaarJd(jaar, 1, 1);
  const maand = Math.min(12, Math.ceil((jd - (29 + eersteVanJaar)) / 29.5) + 1);
  const dag = jd - hijriNaarJd(jaar, maand, 1) + 1;
  return { jaar, maand, dag };
}
function jdNaarMs(jd) { return Math.round((jd - 2440587.5) * DAG); }
function msNaarJd(ms) { return ms / DAG + 2440587.5; }

// De gregoriaanse datum van een islamitische dag, als tijdstempel (UTC-middernacht).
function hijriDatum(jaar, maand, dag) {
  const ms = jdNaarMs(hijriNaarJd(jaar, maand, dag));
  const d = new Date(ms);
  return utc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
function hijriVan(ms) { return jdNaarHijri(msNaarJd(ms)); }

/* ---------- joodse kalender ----------
   Rosh Hashana van een joods jaar, in dagen sinds een vast nulpunt. De molad
   (gemiddelde nieuwe maan) plus de vier dechiyot (uitstelregels). */
function joodsRoshHashana(jaar) {
  const maandenVoor = Math.floor((235 * jaar - 234) / 19);
  const delen = 12084 + 13753 * maandenVoor;
  let dag = maandenVoor * 29 + Math.floor(delen / 25920);
  let rest = delen % 25920;
  // 1. niet op zondag, woensdag of vrijdag
  if ((3 * (dag + 1)) % 7 < 3) dag++;
  // 2. molad na het middaguur -> een dag later (en dan opnieuw regel 1)
  else if (rest >= 19440) { dag++; if ((3 * (dag + 1)) % 7 < 3) dag++; }
  // 3. dinsdag, molad laat, gewoon jaar
  else if ((dag % 7) === 2 && rest >= 9924 && !joodsSchrikkel(jaar)) { dag += 2; }
  // 4. maandag, molad laat, jaar na een schrikkeljaar
  else if ((dag % 7) === 1 && rest >= 16789 && joodsSchrikkel(jaar - 1)) { dag++; }
  return dag;
}
function joodsSchrikkel(jaar) { return ((7 * jaar + 1) % 19) < 7; }
function joodsJaarLengte(jaar) { return joodsRoshHashana(jaar + 1) - joodsRoshHashana(jaar); }

/* Een joodse datum naar een tijdstempel. Het nulpunt is geijkt op een bekende
   datum (1 Tisjrei 5785 = 3 oktober 2024), zodat er geen twijfel is.

   Maanden op NAAM en niet op nummer, en dat is geen stijlkeuze: in een
   schrikkeljaar schuift er een dertiende maand (Adar I) tussen, waardoor
   Nisan het ene jaar de zevende maand is en het andere jaar de achtste.
   Pesach op "maand 8" zetten gaat dus precies een maand mis in elk gewoon
   jaar. Met namen kan dat niet gebeuren. */
const JOODS_NUL = utc(2024, 10, 3) - joodsRoshHashana(5785) * DAG;
const JOODSE_MAANDEN = ['tisjrei', 'chesjwan', 'kislev', 'tevet', 'sjevat', 'adar1', 'adar',
  'nisan', 'ijar', 'sivan', 'tammoez', 'av', 'elloel'];
const JOODSE_LENGTES = (jaar) => {
  const lengte = joodsJaarLengte(jaar);
  const namen = JOODSE_MAANDEN.slice();
  const l = [30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29];
  if (!joodsSchrikkel(jaar)) { l.splice(5, 1); namen.splice(5, 1); }   // geen Adar I
  if (lengte % 10 === 5) l[1] = 30;                     // volledig jaar: Chesjwan 30
  if (lengte % 10 === 3) l[2] = 29;                     // gebrekkig jaar: Kislev 29
  return { l, namen };
};
function joodsDatum(jaar, maand, dag) {
  const { l, namen } = JOODSE_LENGTES(jaar);
  // In een gewoon jaar bestaat Adar I niet; wie daarnaar vraagt krijgt Adar.
  let idx = namen.indexOf(String(maand).toLowerCase());
  if (idx < 0 && String(maand).toLowerCase() === 'adar1') idx = namen.indexOf('adar');
  if (idx < 0) return null;
  let d = joodsRoshHashana(jaar);
  for (let i = 0; i < idx; i++) d += l[i];
  return JOODS_NUL + (d + dag - 1) * DAG;
}

/* ---------- Pasen (westers, Meeus/Jones/Butcher) ---------- */
function pasen(jaar) {
  const a = jaar % 19, b = Math.floor(jaar / 100), c = jaar % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maand = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(jaar, maand, dag);
}

/* ---------- Nowruz ----------
   Het echte Nowruz valt op de lente-equinox gemeten in Teheran. De equinox
   zelf benaderen we (fout van enkele uren), en die bepaalt of het de 20e of
   de 21e maart is. Voor de eeuw waarin we leven is dat betrouwbaar. */
function lenteEquinox(jaar) {
  const y = (jaar - 2000) / 1000;
  const jde = 2451623.80984 + 365242.37404 * y + 0.05169 * y * y - 0.00411 * y ** 3 - 0.00057 * y ** 4;
  const d = new Date(jdNaarMs(jde));
  return utc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

module.exports = {
  hijriDatum, hijriVan, joodsDatum, joodsSchrikkel, joodsRoshHashana, JOODSE_MAANDEN,
  pasen, lenteEquinox, utc, naarDatum, dagVerschil, DAG
};
