#!/usr/bin/env python3
"""wave127 harness rows: the nine access profiles and the settings row (nobody on a profile yet). Idempotent."""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, '..', '..', 'test', 'fixture.json')
f = json.load(open(P))
prof = json.load(open(os.path.join(D, 'wa127_profiles.json')))['profiles']
f['hub_access_profiles'] = [dict(p, updated_by='wave127', updated_at='2026-08-01T00:00:00Z') for p in prof]
f['hub_access_settings'] = [{'id': 1, 'auto_profile': False, 'applied_at': None, 'applied_by': None, 'reviewed_at': None, 'reviewed_by': None, 'updated_by': None, 'updated_at': '2026-08-01T00:00:00Z'}]
json.dump(f, open(P, 'w'))
print('fixture: hub_access_profiles', len(f['hub_access_profiles']), 'hub_access_settings 1; wa_hr_access', len(f.get('wa_hr_access') or []))
