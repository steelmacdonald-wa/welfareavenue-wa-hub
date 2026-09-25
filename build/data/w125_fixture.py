#!/usr/bin/env python3
"""wave125 harness rows: the six SOPs (trainings kind sop) and their links from the events calendar. Idempotent."""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, '..', '..', 'test', 'fixture.json')
f = json.load(open(P))
sops = json.load(open(os.path.join(D, 'wa125_sops.json')))
tr = [t for t in (f.get('trainings') or []) if t.get('kind') != 'sop']
links = {'sop:flag-football': [1, 8], 'sop:rally-paper': [2], 'sop:gift-basket-drive': [4], 'sop:student-association-nights': [5, 6], 'sop:corporate-volunteering': [7]}
for s in sops:
    row = dict(s); row.pop('_fund', None); tr.append(row)
f['trainings'] = tr
byid = {s['key']: s['id'] for s in sops}
for ev in f.get('fund_events') or []:
    ev['sop_training_id'] = None
    for k, ids in links.items():
        if ev['id'] in ids: ev['sop_training_id'] = byid[k]
json.dump(f, open(P, 'w'), ensure_ascii=False)
print('fixture: trainings', len(tr), 'sops', len(sops), 'linked events', sum(1 for e in f.get('fund_events') or [] if e.get('sop_training_id')))
