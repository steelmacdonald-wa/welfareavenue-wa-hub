# wave225: w121.filter(k, v) so the Studio's Library opens the calendar on one tag
p='src/121_wave121.seg'; s=open(p).read()
a="    compose: function (prefill) { openComposer(null, prefill || null); }\n"
if 'filter: function (k, v)' not in s:
    assert s.count(a)==1
    s=s.replace(a,"    compose: function (prefill) { openComposer(null, prefill || null); },\n    filter: function (k, v) { if (k in C.filter) C.filter[k] = v || ''; return C.filter; }\n")
    open(p,'w').write(s)
