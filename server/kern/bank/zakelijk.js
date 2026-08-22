/* RTG Bank, deel "zakelijk": zakelijk bankieren. Bulkbetalingen (veel begunstigden
   in één opdracht) en een salarisrun (hetzelfde, met loonstroken-semantiek). Vooraf
   controleren we de hele batch: past het totaal binnen het saldo + de rood-staan-
   ruimte, en bestaan alle tegenrekeningen? Pas dan boeken we, zodat een run nooit
   half blijft steken. Het SALARISVOORSTEL koppelt de run aan de personeelskosten
   van een zaak: dezelfde geklokte maanduren x hetzelfde uurloon als op het
   fiscale bord (kern/fiscaal), gematcht op de lid-koppeling van het personeel
   (staff.member_id -> codenaam -> eerste betaalrekening). Krijgt de gedeelde
   ctx van kern/bank/index.js. */
const { LANDEN } = require('../fiscaal');

const { magBij } = require('./eigendom');
module.exports = (ctx) => {
  const { schoon, d, boekAsync, rekMeta, saldoVan, bodem, rekeningen, accounts } = ctx;

  const MAX_POSTEN = 5000;

  async function batch({ vanIban, posten, codenaam, oms, soort }) {
    const m = rekMeta(vanIban);
    if (!magBij(m, codenaam)) return { status: 404, error: 'De bronrekening bestaat niet.' };
    if (m.bevroren) return { status: 423, error: 'Deze rekening is bevroren.' };
    if (!Array.isArray(posten) || !posten.length) return { status: 400, error: 'Voeg minstens één begunstigde toe.' };
    if (posten.length > MAX_POSTEN) return { status: 400, error: 'Maximaal ' + MAX_POSTEN + ' begunstigden per opdracht.' };
    // eerst valideren: bedragen, tegenrekeningen en het totaal
    const schoonPosten = [];
    let totaal = 0;
    for (const p of posten) {
      const c = Math.round(Number(p && p.centen));
      if (!Number.isFinite(c) || c < 1) return { status: 400, error: 'Elk bedrag moet groter dan nul zijn.' };
      const naar = String((p && p.naarIban) || '');
      if (!rekMeta(naar)) return { status: 404, error: 'Onbekende tegenrekening: ' + naar };
      if (naar === vanIban) return { status: 400, error: 'Een post kan niet naar de bronrekening zelf.' };
      totaal += c;
      schoonPosten.push({ naar, centen: c, oms: schoon((p && p.oms) || oms, 120) || (soort === 'salaris' ? 'Salaris' : 'Betaling') });
    }
    if (saldoVan(vanIban) - totaal < bodem(vanIban)) return { status: 402, error: 'Onvoldoende saldo of rood-staan-ruimte voor de hele batch.' };
    // en dan pas boeken (de voorcontrole maakt dat dit niet half blijft steken)
    let geboekt = 0;
    for (const p of schoonPosten) {
      const b = await boekAsync({ van: vanIban, naar: p.naar, centen: p.centen, soort: soort || 'bulk', oms: p.oms });
      if (b.ok) geboekt++;
    }
    return { ok: true, geboekt, aantal: schoonPosten.length, totaalCenten: totaal, saldoCenten: saldoVan(vanIban) };
  }

  /* Het salarisvoorstel: de brug tussen de klokuren van een zaak en de
     salarisrun. Per medewerker de geklokte uren van deze maand x het uurloon
     van de zaak (identiek aan het fiscale personeelskosten-bord), en per
     medewerker de eerste eigen betaalrekening via de lid-koppeling. Wie geen
     lid-koppeling of rekening heeft, staat apart in `zonderRekening` -- het
     voorstel verzwijgt niemand. Dit stelt alleen voor; de run zelf loopt
     daarna door dezelfde batch-voorcontrole als elke bulkbetaling. */
  function eersteBetaalRekening(codenaam) {
    let beste = null;
    for (const m of Object.values(rekeningen()))
      if (m.codenaam === codenaam && m.soort === 'betaal' && !m.bevroren && (!beste || m.geopend < beste.geopend)) beste = m;
    return beste;
  }

  /* De IBAN's van het personeel van een zaak, als staffId -> IBAN. Dit is wat
     de bank WEL weet en de payroll niet: welk personeelslid aan welk RTG-lid
     hangt en welke betaalrekening dat lid heeft. De loonrun levert de bedragen,
     deze kant levert de bestemmingen. */
  function salarisRekeningen({ zaak }) {
    const code = String(zaak || '').toUpperCase();
    if (!(d().suppliers || []).some(x => x.code === code)) return { status: 404, error: 'Die zaak bestaat niet.' };
    const rekeningen = {}, zonder = [];
    for (const st of accounts.listStaff(code)) {
      const lid = st.member_id != null ? accounts.getUserById(st.member_id) : null;
      const rek = lid && lid.codename ? eersteBetaalRekening(lid.codename) : null;
      if (rek) rekeningen[st.id] = rek.iban;
      else zonder.push({ staffId: st.id, naam: st.name, reden: lid ? 'geen betaalrekening' : 'niet aan een RTG-lid gekoppeld' });
    }
    return { ok: true, zaak: code, rekeningen, zonderRekening: zonder };
  }

  /* WAT DIT WEL EN NIET IS. Dit is een KOSTENRAMING uit de geklokte uren, voor
     de planning: wat kost dit personeel deze maand, inclusief werkgeverslasten.

     Het was ook de bron van de uitbetaling, en dat was fout. De bedragen hier
     zijn BRUTO uren x uurloon: geen loonheffing ingehouden, geen vier ogen,
     geen loonstrook, geen journaal en geen aangifte. Het geld ging er wel echt
     uit. Ondertussen maakt kern/payroll een netto betaalbestand met al die
     controles, dat door niemand werd uitbetaald -- twee administraties van
     hetzelfde loon, en de verkeerde had de knop.

     Uitbetalen loopt daarom nu uitsluitend via een DEFINITIEVE loonrun; zie
     routes/kantoren/bank-rekeningen.js. Vandaar `uitbetaalbaar: false` in het
     antwoord: dit getal is om mee te plannen, niet om mee te betalen. */
  function salarisVoorstel({ zaak }) {
    const code = String(zaak || '').toUpperCase();
    const s = (d().suppliers || []).find(x => x.code === code);
    if (!s) return { status: 404, error: 'Die zaak bestaat niet.' };
    const maand = new Date().toISOString().slice(0, 7);
    const uurloon = (s.settings && Number(s.settings.uurloon)) || 16;
    const L = LANDEN[(s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL'];
    // maanduren per medewerker, uit dezelfde klok als het fiscale bord
    const perStaf = {};
    for (const e of d().klok[code] || []) {
      if (String(e.in).slice(0, 7) !== maand) continue;
      const uur = ((e.out ? new Date(e.out) : new Date()) - new Date(e.in)) / 3600000;
      if (uur > 0) perStaf[e.staffId] = (perStaf[e.staffId] || 0) + uur;
    }
    const posten = [], regels = [], zonderRekening = [];
    let totaal = 0, bruto = 0;
    for (const st of accounts.listStaff(code)) {
      const uren = Math.round((perStaf[st.id] || 0) * 10) / 10;
      if (uren <= 0) continue;
      const centen = Math.round(uren * uurloon * 100);
      bruto += centen;
      const lid = st.member_id != null ? accounts.getUserById(st.member_id) : null;
      const rek = lid && lid.codename ? eersteBetaalRekening(lid.codename) : null;
      const regel = { staffId: st.id, naam: st.name, uren, brutoCenten: centen, iban: rek ? rek.iban : null };
      regels.push(regel);
      if (rek) { posten.push({ naarIban: rek.iban, centen, oms: 'Salaris ' + maand }); totaal += centen; }
      else zonderRekening.push({ staffId: st.id, naam: st.name, brutoCenten: centen, reden: lid ? 'geen betaalrekening' : 'niet aan een RTG-lid gekoppeld' });
    }
    return { ok: true, zaak: code, zaakNaam: s.name, maand, uurloon, regels, zonderRekening,
      /* GEEN `posten` MEER. Dat veld was de betaalopdracht-in-wording en het
         enige wat de route nodig had om bruto uit te betalen; zolang het
         bestaat, is de verleiding er om het weer aan een run te hangen. */
      uitbetaalbaar: false,
      uitleg: 'Een raming uit de geklokte uren, bruto. Uitbetalen gaat via een definitieve loonrun (Payroll OS).',
      totaalCenten: totaal, brutoCenten: bruto,
      // de werkgeverslasten van het fiscale bord, zodat de boardroom het hele
      // kostenplaatje ziet (de run betaalt alleen het bruto uit)
      lastenPct: Math.round(L.lasten * 100), lastenCenten: Math.round(bruto * L.lasten),
      vakantiegeldCenten: Math.round(bruto * L.vakantiegeld) };
  }

  return {
    bankSalarisRekeningen: salarisRekeningen,
    bankBulkBetaal: (a) => batch({ ...a, soort: 'bulk' }),
    bankSalarisRun: (a) => batch({ ...a, soort: 'salaris' }),
    bankSalarisVoorstel: salarisVoorstel
  };
};
