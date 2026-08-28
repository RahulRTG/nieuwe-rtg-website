/* Achterkant "postgres" van het transactie-grootboek: puur de queries. Het
   grootboek zelf (./ledger) kent de opslag niet meer -- het levert rijen aan en
   vraagt bladzijden op. Zo kan dezelfde veeg- en vensterlogica ook op een andere
   opslag draaien zonder dat er een tweede versie van die logica ontstaat.

   De rijen komen kant-en-klaar binnen (soort, ref, klant, zaak, paid, status,
   totaal, at, data); versleutelen gebeurt in ./ledger, zodat er precies een plek
   is waar dat gebeurt. Alleen de kolomnaam voor vanSleutel is vrij, en die staat
   op een vaste lijst -- nooit tekst uit een verzoek in SQL. */
const KOLOM = { klant: 'klant', zaak: 'zaak' };
const VELDEN = ['soort', 'ref', 'klant', 'zaak', 'paid', 'status', 'totaal', 'at', 'data'];

module.exports = function maakPgAchter(pool) {
  return {
    naam: 'postgres',
    async schema() {
      await pool.query(`CREATE TABLE IF NOT EXISTS tx_ledger(
        soort text NOT NULL, ref text NOT NULL, klant text, zaak text,
        paid boolean, status text, totaal numeric, at timestamptz, data text NOT NULL,
        PRIMARY KEY(soort, ref))`);
      await pool.query('CREATE INDEX IF NOT EXISTS tx_ledger_klant ON tx_ledger(soort, klant, at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS tx_ledger_zaak ON tx_ledger(soort, zaak, at DESC)');
    },
    // Eén upsert per brok van 1000 rijen: idempotent op (soort, ref), zodat een
    // herhaalde veegronde nooit dubbel boekt.
    async upsert(rijen) {
      for (let i = 0; i < rijen.length; i += 1000) {
        const brok = rijen.slice(i, i + 1000);
        const vals = [], params = [];
        brok.forEach((r, j) => {
          const b = j * VELDEN.length;
          vals.push('(' + VELDEN.map((_, k) => '$' + (b + k + 1)).join(',') + ')');
          for (const v of VELDEN) params.push(r[v]);
        });
        await pool.query(
          'INSERT INTO tx_ledger(' + VELDEN.join(',') + ') VALUES ' + vals.join(',') +
          ' ON CONFLICT(soort,ref) DO UPDATE SET klant=EXCLUDED.klant, zaak=EXCLUDED.zaak, paid=EXCLUDED.paid,' +
          ' status=EXCLUDED.status, totaal=EXCLUDED.totaal, at=EXCLUDED.at, data=EXCLUDED.data',
          params);
      }
    },
    // Geindexeerd op (soort, klant/zaak, at DESC): nooit een scan.
    async vanSleutel(soort, kolom, waarde, limit, offset) {
      const kol = KOLOM[kolom];
      if (!kol) return [];
      const r = await pool.query('SELECT data FROM tx_ledger WHERE soort=$1 AND ' + kol + '=$2 ORDER BY at DESC LIMIT $3 OFFSET $4',
        [soort, String(waarde || ''), limit, offset]);
      return r.rows.map(x => x.data);
    },
    async tel(soort, klant) {
      const r = klant != null
        ? await pool.query('SELECT count(*)::bigint AS c FROM tx_ledger WHERE soort=$1 AND klant=$2', [soort, String(klant)])
        : await pool.query('SELECT count(*)::bigint AS c FROM tx_ledger WHERE soort=$1', [soort]);
      return Number(r.rows[0].c);
    },
    /* Met een OFFSET, want het venster bijvullen leest verder dan een bladzijde:
       zie ./topup.js. Zonder offset kon een herstart hooguit de eerste bladzijde
       terughalen, en dan bleef de rest in het grootboek staan. */
    async recent(soort, limit, offset) {
      const r = await pool.query('SELECT data FROM tx_ledger WHERE soort=$1 ORDER BY at DESC LIMIT $2 OFFSET $3',
        [soort, limit, Math.max(0, Number(offset) || 0)]);
      return r.rows.map(x => x.data);
    }
  };
};
