/* Echte productie-topologieproef voor workos.personeelsuitnodiging: twee
   onafhankelijke kerninstances delen dezelfde PostgreSQL en racen om dezelfde
   eenmalige personeelscode. Precies EEN lid krijgt een personeelsplek, het
   gebruik staat op een, en de database draagt alleen de hash.

   Tot 27 september 2026 kon dit niet: werving en supplier bouwden de module
   met alleen `kern`, die bewerkCollectie niet draagt, dus de claim liep stil
   buiten de collectietransactie (zie test/personeelsuitnodiging-montage.test.js).

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/personeelsuitnodiging.pg.test.js */
'use strict';

const test = require('node:test');
const { vereistAlle } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = vereistAlle([['pg', !!PG_URL], ['redis', !!REDIS_URL]], 'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances');

// een gedeelde personeelstabel, zoals de accountlaag die over instances heeft
function personeel() {
  const staff = [];
  let volgende = 1;
  const staffByMember = (code, id) => staff.find(x => x.active && x.supplier_code === code && x.member_id === id) || null;
  return {
    staff,
    accounts: {
      legacyStaffPinToegestaan: () => false,
      realNameOf: lid => lid.name,
      staffByMember,
      createAccountStaff: g => {
        const rij = { id: volgende++, active: 0, supplier_code: g.supplierCode, member_id: g.memberId,
          name: g.name, role: g.role, func: g.func };
        staff.push(rij);
        return rij;
      },
      getStaffByIdAny: id => staff.find(x => x.id === Number(id)) || null,
      activateStaff: id => { const r = staff.find(x => x.id === Number(id)); if (r) r.active = 1; return r || null; },
      deactivateStaff: id => { const r = staff.find(x => x.id === Number(id)); if (r) r.active = 0; },
      getMemberState: () => ({}), saveMemberState: () => {}
    }
  };
}

test('dezelfde personeelscode claimt atomair over twee PG/Redis-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const { createClient } = require('../server/redis');
    const kluis = require('../server/kluis');
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    const ra = createClient({ url: REDIS_URL }), rb = createClient({ url: REDIS_URL });
    try {
      await Promise.all([ra.connect(), rb.connect()]);
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      const ZAAK = { code: 'RACE', name: 'Race Bar' };
      await a.flush({ staffInvites: {}, suppliers: [ZAAK] }, true);
      const lees = async () => {
        const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', ['staffInvites']);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, waarde: JSON.parse(json) };
      };
      const p = personeel();
      const module_ = (pg, data) => require('../server/routes/supplier/werving/uitnodiging')({ kern: {
        accounts: p.accounts, crypto, db: { data, writable: true }, save() {},
        logActivity() {}, notifySupplier() {},
        bewerkCollectie: (s, w) => pg.bewerkCollectie(s, data, w) } });

      const dataA = await a.laadAlles();
      const UA = module_(a, dataA);
      const uit = await UA.maakInvite(ZAAK, { name: 'Manager' }, { naam: 'Nieuw', role: 'staff' });
      assert.ok(uit.ok && uit.kassacode, JSON.stringify(uit));
      await a.flush(dataA, true);
      const dataB = await b.laadAlles();
      const UB = module_(b, dataB);

      const lid1 = { id: 1, name: 'Een' }, lid2 = { id: 2, name: 'Twee' };
      const [r1, r2] = await Promise.all([UA.verbindCode(lid1, uit.kassacode, {}, ZAAK.code),
        UB.verbindCode(lid2, uit.kassacode, {}, ZAAK.code)]);
      assert.equal([r1, r2].filter(r => r && r.ok).length, 1, 'precies een lid claimde de code: ' + JSON.stringify([r1, r2]));
      assert.equal([r1, r2].filter(r => r && r.status === 403).length, 1);
      assert.equal(p.staff.filter(s => s.active).length, 1, 'een personeelsplek, niet twee');

      const w = await lees();
      const inv = w.waarde.RACE.find(x => x.id === uit.id);
      assert.equal(inv.toegang.gebruik, 1, 'het gebruik telde een keer');
      assert.equal(inv.claim.status, 'voltooid');
      assert.equal(w.json.includes(uit.kassacode), false, 'PostgreSQL bevat alleen de hash');
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
