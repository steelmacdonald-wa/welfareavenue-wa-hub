  /* ---------- wave204 (04/10/26): GIF204, the animated GIF encoder behind the moving preview ----------
     Self-contained (no page, no db), so node runs this file alone for the tests. One palette for the whole clip (median cut
     over a 15-bit histogram: up to 255 colours, index 255 kept for transparency), so colours hold still from frame to frame.
     Every later frame carries only the pixels that changed by more than a little (the rest transparent, the frame cropped to
     what changed), which keeps a few seconds of video small enough for an inbox. LZW as in the GIF89a spec (the variable code
     size timing follows omggif's encoder). Loops forever; disposal "do not dispose". */
  var GIF204 = (function () {
    var TI = 255;   /* the transparent index */
    function chan(x, c) { return c === 0 ? x >> 10 : c === 1 ? (x >> 5) & 31 : x & 31; }
    /* frames: RGBA arrays of one size; up to max colours; step: every step-th pixel goes into the histogram */
    function palette(frames, max, step, keep) {
      keep = keep || [];
      var hist = new Uint32Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768), f, d, p, i, key;
      for (f = 0; f < frames.length; f++) { d = frames[f]; for (p = 0; p < d.length; p += 4 * step) { key = ((d[p] >> 3) << 10) | ((d[p + 1] >> 3) << 5) | (d[p + 2] >> 3); hist[key]++; sr[key] += d[p]; sg[key] += d[p + 1]; sb[key] += d[p + 2]; } }
      var bins = []; for (i = 0; i < 32768; i++) if (hist[i]) bins.push(i);
      function box(list) {
        var lo = [31, 31, 31], hi = [0, 0, 0], n = 0;
        for (var k = 0; k < list.length; k++) { var x = list[k]; n += hist[x]; for (var c = 0; c < 3; c++) { var v = chan(x, c); if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; } }
        var r = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], ch = r[1] >= r[0] && r[1] >= r[2] ? 1 : r[0] >= r[2] ? 0 : 2;
        return { list: list, n: n, ch: ch, range: r[ch] };
      }
      var boxes = bins.length ? [box(bins)] : [], room = Math.max(1, max - keep.length);
      while (boxes.length < room) {
        var bi = -1, best = 0;
        for (i = 0; i < boxes.length; i++) { var s = boxes[i].list.length > 1 ? boxes[i].n * (boxes[i].range + 1) : 0; if (s > best) { best = s; bi = i; } }
        if (bi < 0) break;
        var b = boxes[bi], c0 = b.ch, half = b.n / 2, acc = 0, cut = 1;
        b.list.sort(function (x, y) { return chan(x, c0) - chan(y, c0); });
        for (i = 0; i < b.list.length - 1; i++) { acc += hist[b.list[i]]; if (acc >= half) { cut = i + 1; break; } }
        boxes.splice(bi, 1, box(b.list.slice(0, cut)), box(b.list.slice(cut)));
      }
      var pal = new Uint8Array(256 * 3);
      boxes.forEach(function (bx, k) {
        var r = 0, g = 0, bl = 0;
        bx.list.forEach(function (x) { r += sr[x]; g += sg[x]; bl += sb[x]; });   /* the true average of the pixels in the box */
        pal[k * 3] = Math.round(r / bx.n); pal[k * 3 + 1] = Math.round(g / bx.n); pal[k * 3 + 2] = Math.round(bl / bx.n);
      });
      var n = boxes.length;
      keep.slice(0, max - n).forEach(function (c) { pal[n * 3] = c[0]; pal[n * 3 + 1] = c[1]; pal[n * 3 + 2] = c[2]; n++; });
      return { pal: pal, n: Math.max(1, n) };
    }
    /* the nearest palette colour for a pixel, remembered per 15-bit colour */
    function mapper(pal, n) {
      var cache = new Int16Array(32768); for (var z = 0; z < 32768; z++) cache[z] = -1;
      return function (r, g, b) {
        var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3), v = cache[key];
        if (v >= 0) return v;
        var cr = ((r >> 3) << 3) + 4, cg = ((g >> 3) << 3) + 4, cb = ((b >> 3) << 3) + 4, best = 0, bd = 1e12;
        for (var k = 0; k < n; k++) { var dr = pal[k * 3] - cr, dg = pal[k * 3 + 1] - cg, db = pal[k * 3 + 2] - cb, dd = dr * dr * 2 + dg * dg * 4 + db * db * 3; if (dd < bd) { bd = dd; best = k; } }
        cache[key] = best; return best;
      };
    }
    /* one frame's indexes as LZW sub-blocks, written into out at pos; returns the new pos */
    function lzw(idx, len, out, pos) {
      var min = 8, clear = 256, eoi = 257, next = 258, size = 9, cur = 0, shift = 0;
      out[pos++] = min;
      var sub = pos++;
      function flush(bits) { while (shift >= bits) { out[pos++] = cur & 255; cur >>= 8; shift -= 8; if (pos === sub + 256) { out[sub] = 255; sub = pos++; } } }
      function emit(c) { cur |= c << shift; shift += size; flush(8); }
      var table = new Map(), ib = idx[0];
      emit(clear);
      for (var i = 1; i < len; i++) {
        var k = idx[i], key = (ib << 8) | k, code = table.get(key);
        if (code === undefined) {
          emit(ib);
          if (next === 4096) { emit(clear); next = 258; size = 9; table.clear(); }
          else { if (next >= (1 << size)) size++; table.set(key, next++); }
          ib = k;
        } else ib = code;
      }
      emit(ib); emit(eoi); flush(1);
      if (sub + 1 === pos) out[sub] = 0; else { out[sub] = pos - sub - 1; out[pos++] = 0; }
      return pos;
    }
    /* frames: RGBA arrays (w x h); delay in hundredths of a second; o.thr: how far a colour may drift before a pixel is
       redrawn (squared RGB distance); o.keep: [r, g, b] colours that must be in the palette exactly (a small gold button
       would otherwise be averaged away by the median cut); o.onProg(fraction); o.yield(): a promise between frames */
    async function encode(frames, w, h, delay, o) {
      o = o || {};
      if (!frames.length || w < 1 || h < 1) throw new Error('Nothing to make a preview from.');
      var px = w * h, step = Math.max(1, Math.floor(frames.length * px / 200000));
      var P = palette(frames, 255, step, o.keep), pal = P.pal, map = mapper(pal, P.n), thr = o.thr == null ? 300 : o.thr;
      var shown = new Uint8Array(px), idx = new Uint8Array(px), crop = new Uint8Array(px);
      var out = new Uint8Array(1024 + frames.length * (Math.ceil(px * 1.6) + 64)), pos = 0;
      var u8 = function (v) { out[pos++] = v; }, u16 = function (v) { out[pos++] = v & 255; out[pos++] = (v >> 8) & 255; }, txt = function (s) { for (var c = 0; c < s.length; c++) u8(s.charCodeAt(c)); };
      txt('GIF89a'); u16(w); u16(h); u8(0xF7); u8(0); u8(0);
      out.set(pal, pos); pos += 768;
      u8(0x21); u8(0xFF); u8(11); txt('NETSCAPE2.0'); u8(3); u8(1); u16(0); u8(0);
      for (var f = 0; f < frames.length; f++) {
        var d = frames[f], x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (var p = 0, q = 0; p < px; p++, q += 4) {
          var ni = map(d[q], d[q + 1], d[q + 2]);
          if (f === 0) { shown[p] = ni; idx[p] = ni; continue; }
          var si = shown[p];
          if (ni === si) { idx[p] = TI; continue; }
          var dr = pal[ni * 3] - pal[si * 3], dg = pal[ni * 3 + 1] - pal[si * 3 + 1], db = pal[ni * 3 + 2] - pal[si * 3 + 2];
          if (dr * dr + dg * dg + db * db < thr) { idx[p] = TI; continue; }
          idx[p] = ni; shown[p] = ni;
          var x = p % w, y = (p / w) | 0;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        var fx = 0, fy = 0, fw = w, fh = h, data = idx, len = px;
        if (f > 0) {
          if (x1 < 0) { fw = 1; fh = 1; crop[0] = TI; data = crop; len = 1; }
          else {
            fx = x0; fy = y0; fw = x1 - x0 + 1; fh = y1 - y0 + 1; len = fw * fh;
            for (var yy = 0, z = 0; yy < fh; yy++) { var row = (fy + yy) * w + fx; for (var xx = 0; xx < fw; xx++) crop[z++] = idx[row + xx]; }
            data = crop;
          }
        }
        u8(0x21); u8(0xF9); u8(4); u8(4 | (f > 0 ? 1 : 0)); u16(delay); u8(TI); u8(0);
        u8(0x2C); u16(fx); u16(fy); u16(fw); u16(fh); u8(0);
        pos = lzw(data, len, out, pos);
        if (o.onProg) o.onProg((f + 1) / frames.length);
        if (o.yield) await o.yield();
      }
      u8(0x3B);
      return out.slice(0, pos);
    }
    return { encode: encode, palette: palette, lzw: lzw };
  })();
