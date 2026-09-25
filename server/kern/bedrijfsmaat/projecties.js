/* DE PROJECTIES -- de definities van ./definities.js, uitgerekend.

   Pure functies op lijsten die een ander bezit: de pasovergangen
   (kern/pasgeschiedenis.js), de laatste bezoekdag (kern/aanwezigheid.js), de
   uitkomsten (ritten en bestellingen) en de lidmaatschapstermijnen. Hier wordt
   niets gelezen uit een database en niets opgeslagen; ./stand.js haalt de lijsten
   op en stuurt elke uitkomst langs de groepspoort (./poort.js).

   EEN VERHOUDING DRAAGT HAAR NOEMER. Activatie en retentie geven teller EN
   noemer, want 100% van twee leden is geen 100%, en de noemer is de groep waar
   de poort op beslist.

   EEN COHORT DAT NOG NIET KLAAR IS, TELT NIET MEE. Wie gisteren lid werd, kan nog
   niet geactiveerd zijn binnen dertig dagen; hem in de noemer zetten laat de
   activatie dalen door de tijd en niet door de leden. Alleen wie het hele venster
   heeft gehad, staat in de noemer. */
'use strict';

const DAG = 86400000;
const BETAALD = new Set(['rtg', 'lifestyle', 'business']);
const RANG = { guest: 0, rtg: 1, lifestyle: 2, business: 3 };
const ms = (x) => { const t = Date.parse(x); return Number.isNaN(t) ? null : t; };

/* Per codenaam de overgangen, op volgorde van tijd. */
function tijdlijn(overgangen) {
  const per = new Map();
  for (const o of overgangen || []) {
    if (!o || !o.codenaam || ms(o.op) == null) continue;
    if (!per.has(o.codenaam)) per.set(o.codenaam, []);
    per.get(o.codenaam).push(o);
  }
  for (const l of per.values()) l.sort((a, b) => ms(a.op) - ms(b.op));
  return per;
}

/* definities.nieuwLid: de eerste overgang naar een betaalde pas. */
function nieuwOp(lijst) {
  for (const o of lijst) if (BETAALD.has(o.naar) && !BETAALD.has(o.van)) return ms(o.op);
  return null;
}

/* ISO-week als 'JJJJ-Www' (maandag begint de week, week 1 bevat de eerste donderdag). */
function isoWeek(t) {
  const d = new Date(t);
  const dag = (d.getUTCDay() + 6) % 7;
  const donderdag = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dag + 3));
  const jaar = donderdag.getUTCFullYear();
  const week = Math.ceil(((donderdag - Date.UTC(jaar, 0, 1)) / DAG + 1) / 7);
  return jaar + '-W' + String(week).padStart(2, '0');
}

/* Alle nieuwe leden met hun startmoment en cohort. */
function nieuweLeden(overgangen) {
  const uit = [];
  for (const [codenaam, lijst] of tijdlijn(overgangen)) {
    const op = nieuwOp(lijst);
    if (op != null) uit.push({ codenaam, op, cohort: isoWeek(op) });
  }
  return uit;
}

/* Per codenaam de momenten van een geslaagde uitkomst. */
function uitkomstenPerLid(uitkomsten) {
  const per = new Map();
  for (const u of uitkomsten || []) {
    const t = ms(u && u.op);
    if (!u || !u.codenaam || t == null) continue;
    if (!per.has(u.codenaam)) per.set(u.codenaam, []);
    per.get(u.codenaam).push(t);
  }
  return per;
}

/* definities.activatie: een uitkomst binnen 30 dagen na nieuw lid. */
function activatie(leden, uitkomsten, peil) {
  const per = uitkomstenPerLid(uitkomsten);
  let teller = 0, noemer = 0;
  for (const l of leden) {
    if (l.op + 30 * DAG > peil) continue;                 // venster nog niet voorbij
    noemer += 1;
    if ((per.get(l.codenaam) || []).some(t => t >= l.op && t <= l.op + 30 * DAG)) teller += 1;
  }
  return { teller, noemer };
}

/* definities.retentieWaarde: een uitkomst tussen dag 30 en dag 60. */
function retentieWaarde(leden, uitkomsten, peil) {
  const per = uitkomstenPerLid(uitkomsten);
  let teller = 0, noemer = 0;
  for (const l of leden) {
    if (l.op + 60 * DAG > peil) continue;
    noemer += 1;
    if ((per.get(l.codenaam) || []).some(t => t > l.op + 30 * DAG && t <= l.op + 60 * DAG)) teller += 1;
  }
  return { teller, noemer };
}

/* definities.retentieAanwezig: laatste bezoekdag op of na dag 30. */
function retentieAanwezig(leden, laatstActief, peil) {
  const dag = new Map((laatstActief || []).map(r => [r.codenaam, ms(r.dag)]));
  let teller = 0, noemer = 0;
  for (const l of leden) {
    if (l.op + 30 * DAG > peil) continue;
    noemer += 1;
    const d = dag.get(l.codenaam);
    if (d != null && d >= l.op + 30 * DAG) teller += 1;
  }
  return { teller, noemer };
}

/* De pas van iedereen op een moment, uit de tijdlijn. */
function pasOp(lijst, t) {
  let pas = null;
  for (const o of lijst) { if (ms(o.op) > t) break; pas = o.naar; }
  return pas;
}

/* definities.churn en definities.afwaardering, over een maand 'JJJJ-MM'. */
function churnEnAfwaardering(overgangen, maand) {
  const begin = Date.parse(maand + '-01T00:00:00Z');
  const eind = new Date(begin); eind.setUTCMonth(eind.getUTCMonth() + 1);
  let noemer = 0, churn = 0, afwaardering = 0;
  for (const lijst of tijdlijn(overgangen).values()) {
    if (!BETAALD.has(pasOp(lijst, begin - 1))) continue;
    noemer += 1;
    const inMaand = lijst.filter(o => ms(o.op) >= begin && ms(o.op) < eind.getTime());
    if (inMaand.some(o => o.naar === 'guest')) churn += 1;
    else if (inMaand.some(o => BETAALD.has(o.van) && BETAALD.has(o.naar) && RANG[o.naar] < RANG[o.van])) afwaardering += 1;
  }
  return { noemer, churn, afwaardering };
}

/* definities.omzetGefactureerd en omzetOntvangen, zonder btw, in centen. */
function omzet(termijnen, maand) {
  let gefactureerd = 0, ontvangen = 0, nGef = 0, nOnt = 0;
  for (const t of termijnen || []) {
    const c = Number.isFinite(t && t.centen) ? t.centen : 0;
    if (String(t.vervalt || '').slice(0, 7) === maand) { gefactureerd += c; nGef += 1; }
    if (t.status === 'voldaan' && t.voldaan && String(t.voldaan.at || '').slice(0, 7) === maand) { ontvangen += c; nOnt += 1; }
  }
  return { gefactureerdCenten: gefactureerd, ontvangenCenten: ontvangen, termijnenGefactureerd: nGef, termijnenOntvangen: nOnt };
}

module.exports = { tijdlijn, nieuwOp, isoWeek, nieuweLeden, activatie, retentieWaarde, retentieAanwezig,
  churnEnAfwaardering, omzet, BETAALD, DAG };
