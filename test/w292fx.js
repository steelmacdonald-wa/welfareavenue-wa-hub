/* w292fx.js: the fixture for the wave292 drive (test/w292drive.js). test/fixture.json plus three email-history runs on the Import page, shaped
   the way wa289_scan.sql and wa292_batches.sql leave them (crm_import_runs.source, crm_mail_scans, crm_import_batches of the five mail kinds):
   run 10, its mail_people batch undone with two contacts quarantined (Delete created); run 9, read and half applied (optouts and orgs applied,
   people compared, enrich and interactions new); run 8, waiting for go after its sample. INVOKE answers crm-import and mail-history and records
   every call. Every person, address and number is invented (Test ..., example.invalid). fx292() returns a fresh object each time. */
const { loadFixture } = require('./boot');

const REP = (kind, counts, lists, extra) => Object.assign({ kind, counts: Object.assign({ rows_read: 0, matched: 0, created: 0, updated: {}, kept_hub_value: {}, skipped: {} }, counts),
  lists: Object.assign({ keela_ids_skipped: [], org_pairs: [], assignees_unmapped: [], campaigns_to_create: [], changed_since_kept: [], created_review: [] }, lists || {}), changes: 0 }, extra || {});
const SCAN = (run, mailbox, phase, o) => Object.assign({ id: run * 10 + (mailbox === 'steel' ? 1 : 2), run_id: run, mailbox, phase, page_token: null,
  counts: { listed: 1200, by_state: { kept: 300, skipped: 700, left_alone: 200 }, by_reason: { automated: 500, personal: 150, list: 200, duplicate: 50 }, threads_read: 120, run: { writers: 80, outbound_only: 12 } },
  oldest_at: '2020-04-02T10:00:00Z', estimate_usd: 2, spend_usd: 0.2, cap_usd: 0.25, paused: false, started_by: 'test@example.invalid', started_at: '2026-11-01T10:00:00Z',
  go_by: null, go_at: null, step_at: null, finished_at: null, last_error: null }, o || {});

function fx292() {
  const fx = loadFixture();
  fx.crm_duplicates_v = fx.crm_duplicates_v || [];
  fx.crm_import_runs = [
    { id: 10, label: 'Test email history (undone)', created_by: 'test@example.invalid', created_at: '2026-11-03T12:00:00Z', last_applied_at: '2026-11-04T12:00:00Z', purged_at: null, source: 'email_history' },
    { id: 9, label: 'Test email history', created_by: 'test@example.invalid', created_at: '2026-11-02T12:00:00Z', last_applied_at: '2026-11-05T12:00:00Z', purged_at: null, source: 'email_history' },
    { id: 8, label: 'Test email history (waiting)', created_by: 'test@example.invalid', created_at: '2026-11-01T12:00:00Z', last_applied_at: null, purged_at: null, source: 'email_history' }
  ];
  fx.crm_mail_scans = [
    SCAN(10, 'steel', 'done', { go_at: '2026-11-02T10:00:00Z', cap_usd: 3, spend_usd: 1.4, finished_at: '2026-11-03T10:00:00Z' }),
    SCAN(10, 'hub', 'done', { go_at: '2026-11-02T10:00:00Z', cap_usd: 3, spend_usd: 0.9, finished_at: '2026-11-03T10:00:00Z' }),
    SCAN(9, 'steel', 'done', { go_at: '2026-11-02T10:00:00Z', cap_usd: 6, spend_usd: 2.1, finished_at: '2026-11-03T10:00:00Z' }),
    SCAN(9, 'hub', 'done', { go_at: '2026-11-02T10:00:00Z', cap_usd: 6, spend_usd: 1.2, finished_at: '2026-11-03T10:00:00Z' }),
    SCAN(8, 'steel', 'waiting', { estimate_usd: 2.5 }), SCAN(8, 'hub', 'waiting', { estimate_usd: 1.5 })
  ];
  fx.crm_import_batches = [
    { id: 101, run_id: 10, kind: 'mail_optouts', status: 'applied', report: REP('mail_optouts', { rows_read: 4, matched: 3 }, { mail: { suppressions_added: 4, contacts_changed: 3 } }) },
    { id: 102, run_id: 10, kind: 'mail_orgs', status: 'applied', report: REP('mail_orgs', { rows_read: 6, matched: 2, created: 3 }, { names_created: ['Test Pantry Collective'] }) },
    { id: 103, run_id: 10, kind: 'mail_people', status: 'undone', report: REP('mail_people', { rows_read: 9, matched: 2, created: 2 }, { quarantined: [5201, 5202], created_review: [{ table: 'crm_contacts', row_id: '5201' }, { table: 'crm_contacts', row_id: '5202' }] },
        { undo: { restored: 0, removed: 3, kept: 0, review: 2, quarantined: 2 } }) },
    { id: 91, run_id: 9, kind: 'mail_optouts', status: 'applied', report: REP('mail_optouts', { rows_read: 5, matched: 4, updated: { email_status: 2, consent_source: 2 } }, { mail: { suppressions_added: 3, contacts_changed: 2, by_kind: { asked_to_stop: 2, bounced: 1 } } }) },
    { id: 92, run_id: 9, kind: 'mail_orgs', status: 'applied', report: REP('mail_orgs', { rows_read: 8, matched: 3, created: 4, skipped: { 'robots.txt refused': 1 } }, { names_created: ['Test Food Bank Network'] }) },
    { id: 93, run_id: 9, kind: 'mail_people', status: 'compared', report: REP('mail_people', { rows_read: 80, matched: 30, created: 44, skipped: { 'left out': 3 } },
        { phone_only: [{ contact_id: 4004 }], mail: { by_type: { partner: 12, supporter: 20, other: 12 }, born_opted_out: 1, outbound_only: 12 } }) }
  ];
  fx.app_config = (fx.app_config || []).concat([{ key: 'keela_keys', value: '{}' }, { key: 'keela_assignee_map', value: '{}' }, { key: 'keela_org_pairs_ok', value: '[]' },
    { key: 'keela_campaign_types', value: '{}' }, { key: 'mail_history_cap_usd', value: '60' }]);
  return fx;
}

const PEOPLE = [
  { key: 'test.partner@pantry.example.invalid', name: 'Test Partner Person', type: 'partner', conf: 0.91, in: 4, out: 3, first_at: '2021-03-12T10:00:00Z', last_at: '2025-10-02T10:00:00Z',
    organization: 'Test Pantry Collective', match: 'none', match_id: null, optout: null, not_optout: false, excluded: false, writer: true, mailboxes: ['hub'] },
  { key: 'test.stop@example.invalid', name: 'Test Stop Person', type: 'other', conf: 0.42, in: 1, out: 0, first_at: '2022-05-01T10:00:00Z', last_at: '2022-05-01T10:00:00Z',
    organization: null, match: 'email', match_id: 5103, optout: 'asked_to_stop', not_optout: false, excluded: false, writer: true, mailboxes: ['hub'] }
];
const INVOKE = `window.__calls = []; window.__WA_INVOKE = function (name, opts) {
  var b = (opts && opts.body) || {}; window.__calls.push({ name: name, body: JSON.parse(JSON.stringify(b)) });
  if (name === 'crm-import') {
    if (b.action === 'files') return { data: { files: [] }, error: null };
    if (b.action === 'delete_created') return { data: { deleted: 2, kept: 0 }, error: null };
    return { data: { report: {} }, error: null };
  }
  if (name === 'mail-history') {
    if (b.action === 'people') return { data: { ok: true, hidden: 1, total: 2, rows: ${JSON.stringify(PEOPLE)} }, error: null };
    if (b.action === 'go') return { data: { ok: true, estimate: 4, cap: 6 }, error: null };
    if (b.action === 'summarise') return { data: { ok: true, todo: 3 }, error: null };
    if (b.action === 'start') return { data: { ok: true, run_id: 11 }, error: null };
    return { data: { ok: true }, error: null };
  }
  return { data: null, error: null };
};`;
module.exports = { fx292, INVOKE, PEOPLE };
