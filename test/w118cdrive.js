/* wave118c drive: the photo library end to end against the stub.
   Usage: node w118cdrive.js <candidate> <outdir> [role] [email] [name] [width]
   Storage URLs are allowed through (real thumbnails, and fetch for the composer hand-off). */
const fs = require("fs"); const path = require("path"); const { chromium } = require("playwright");
const FIXED_TIME = "2026-08-06T12:00:00-04:00";
const [, , CAND, OUT, ROLE = "staff", EMAIL = "steel.macdonald@welfareavenue.com", NAME = "Steel MacDonald", WIDTH = "1366"] = process.argv;
let fails = 0; const log = [];
function ok(cond, what) { log.push((cond ? "PASS " : "FAIL ") + what); if (!cond) fails++; }
(async () => {
  const html = fs.readFileSync(CAND, "utf8");
  const stub = fs.readFileSync(path.join(__dirname, "stub_supabase.js"), "utf8");
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8"));
  const ph = JSON.parse(fs.readFileSync(path.join(__dirname, "fixture_photos.json"), "utf8"));
  fx.wa_photos_list = ph.wa_photos_list; fx.wa_photos = ph.wa_photos;
  const fixture = JSON.stringify(fx);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: Number(WIDTH), height: 900 }, deviceScaleFactor: 1, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 300)); });
  page.on("dialog", d => d.accept());
  await page.addInitScript(
    "(function(){ var FIXED = new Date(" + JSON.stringify(FIXED_TIME) + ").getTime(); var RealDate = Date;" +
    "function FDate(a,b,c,d,e,f,g){ if (!(this instanceof FDate)) return new RealDate(FIXED).toString(); switch (arguments.length) { case 0: return new RealDate(FIXED); case 1: return new RealDate(a); default: return new RealDate(a,b,c,d,e,f,g); } }" +
    "FDate.now = function(){ return FIXED; }; FDate.parse = RealDate.parse; FDate.UTC = RealDate.UTC; FDate.prototype = RealDate.prototype; window.Date = FDate;" +
    "window.__WA_TEST_ROLE = " + JSON.stringify(ROLE) + "; window.__WA_TEST_EMAIL = " + JSON.stringify(EMAIL) + "; window.__WA_TEST_NAME = " + JSON.stringify(NAME) + ";" +
    "window.confirm = function(){ return true; }; window.alert = function(){}; window.prompt = function(){ return null; };" +
    "try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); localStorage.setItem('w118bSnooze', String(Date.now() + 86400000)); } catch (e) {} })();"
  );
  await page.addInitScript("window.__WAFIX = " + fixture + ";");
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith("http://wahub.test/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.indexOf("cytoscape") >= 0) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(__dirname, "cytoscape.min.js"), "utf8") });
    if (url.indexOf("supabase-js") >= 0 || url.indexOf("@supabase") >= 0) return route.fulfill({ contentType: "application/javascript", body: stub });
    if (url.indexOf("fonts.g") >= 0 || url.indexOf("supabase.co/storage") >= 0) return route.continue();
    return route.abort();
  });
  await page.goto("http://wahub.test/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const g = document.getElementById("gate"); return g && g.style.display === "none"; }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const shot = async n => page.screenshot({ path: path.join(OUT, n + ".png") });
  const go = async (h, ms) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms || 900); };
  const cnt = sel => page.evaluate(s => document.querySelectorAll(s).length, sel);
  const txt = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
  /* a fake photo_label answer through the router (tags as a string, like the live test once did) */
  await page.evaluate(() => {
    const orig = db.functions.invoke.bind(db.functions);
    window.__llmCalls = [];
    db.functions.invoke = function (name, opts) {
      if (name === "llm" && opts && opts.headers && opts.headers["x-wa-task"] === "photo_label") {
        window.__llmCalls.push(opts);
        return new Promise(r => setTimeout(() => r({ data: { content: [{ type: "tool_use", name: "photo_labels", input: {
          title: "Volunteers in gold and green.", alt_text: "Three volunteers in green vests stand behind a table of food trays under a tent — smiling.",
          caption: "Sunday, served.", description: "A test photo.", season: "winter", scene: "volunteers", tags: "volunteers, Tent, winter, tent",
          usage: "ready", usage_note: "Volunteers only.", people: "Three volunteers in green vests", branding: "legacy", focal_x: 0.42, focal_y: 1.3, best_for: "card, deck, Social square, nonsense" } }],
          _wa: { model: "anthropic/claude-sonnet-5" } }, error: null }), 300));
      }
      return orig(name, opts);
    };
  });

  const staff = await page.evaluate(() => typeof isStaff === "function" && isStaff());
  const boardMode = await page.evaluate(() => typeof MODE !== "undefined" && MODE === "board");

  /* 1. the menu */
  const tab = await page.evaluate(() => { const b = document.querySelector('#tabBar .tab[data-tab="photos"]'); if (!b) return null; const g = b.closest(".tab-group"); return { group: g && g.getAttribute("data-w42g"), shown: b.style.display !== "none", prev: b.previousElementSibling && b.previousElementSibling.getAttribute("data-tab") }; });
  ok(tab && tab.group === "more" && tab.shown, "menu: Photo library sits in More and shows (" + JSON.stringify(tab) + ")");

  /* 2. the page */
  await go("#photos", 1500);
  ok(await page.evaluate(() => document.getElementById("photos").classList.contains("active")), "page: #photos is the active panel");
  ok((await cnt("#photos .ph")) === 16, "page: 16 cards (" + await cnt("#photos .ph") + ")");
  ok((await page.evaluate(() => Array.from(document.querySelectorAll("#photos .grp h3")).map(h => h.textContent).join(","))) === "2024,2022,Date unknown", "page: year groups 2024, 2022, Date unknown");
  const chips = await page.evaluate(() => Array.from(document.querySelectorAll("#photos .chips span")).map(s => s.textContent.replace(/\s+/g, " ").trim()));
  ok(chips.indexOf("Ready 10") >= 0 && chips.indexOf("Crop first 3") >= 0 && chips.indexOf("Consent needed 3") >= 0 && chips.indexOf("All 16") >= 0 && chips.indexOf("Picks 12") >= 0, "page: chip counts " + chips.join(" | "));
  const first = await page.evaluate(() => Array.from(document.querySelectorAll("#photos .grid"))[0].querySelector(".ph").getAttribute("data-w118cop"));
  ok(first === "2024-10-autumn-volunteers-plating", "page: same-day photos rank ready picks first (" + first + ")");
  ok(staff ? (await cnt("#photos .add")) === 1 : (await cnt("#photos .add")) === 0, "page: Add photos only for staff");
  await shot("01_page");
  await page.click('#photos [data-w118cu="consent"]'); await page.waitForTimeout(300);
  ok((await cnt("#photos .ph")) === 3, "filter: Consent needed shows 3");
  await page.click('#photos [data-w118cu=""]'); await page.click('#photos [data-w118cs="winter"]'); await page.waitForTimeout(300);
  ok((await cnt("#photos .ph")) === 3, "filter: Winter shows 3");
  await page.click('#photos [data-w118cs="winter"]'); await page.fill("#w118cq", "vcsa tent"); await page.waitForTimeout(500);
  const nq = await cnt("#photos .ph");
  ok(nq > 0 && nq < 16, "search: 'vcsa tent' narrows to " + nq);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === "w118cq"), "search: focus stays in the box while typing");
  await page.fill("#w118cq", "zzzz nothing"); await page.waitForTimeout(400);
  ok((await cnt("#photos .ph")) === 0 && (await cnt('#photos [data-w118cclr="all"]')) === 1, "search: no match offers Clear the filters");
  await page.click('#photos [data-w118cclr="all"]'); await page.waitForTimeout(300);
  ok((await cnt("#photos .ph")) === 16, "filters cleared: 16 again");
  await page.selectOption("#w118csort", "title"); await page.waitForTimeout(300);
  ok((await cnt("#photos .grp")) === 0 && (await cnt("#photos .ph")) === 16, "sort by title: one grid, no year groups");
  await page.selectOption("#w118csort", "taken"); await page.waitForTimeout(300);

  /* 3. one photo */
  await page.click('#photos [data-w118cop="2022-06-media-interview-b"]'); await page.waitForTimeout(500);
  ok((await cnt("#w118cdr .pn")) === 1, "drawer: opens");
  ok(await page.evaluate(() => location.hash === "#photos/2022-06-media-interview-b"), "drawer: deep link in the address bar");
  ok((await txt("#w118cdr header h3")) === "Media day at the Sunday serving (take B)", "drawer: title");
  const dls = await page.evaluate(() => Array.from(document.querySelectorAll("#w118cdr .dl a")).map(a => a.getAttribute("href")));
  ok(dls.length === 3 && dls.every(h => /\?v=1&download=2022-06-media-interview-b(-web|-thumb)?\.jpg$/.test(h)), "drawer: three downloads with ?download= names");
  ok((await txt("#w118cdr .use b")) === "Ready for public use", "drawer: usage box");
  ok(staff ? (await cnt('#w118cdr [data-w118cuse]')) >= 1 : (await cnt('#w118cdr [data-w118cuse]')) === 0, "drawer: hand-offs only for staff (" + await cnt('#w118cdr [data-w118cuse]') + ")");
  await page.click('#w118cdr [data-w118ccopy="alt"]'); await page.waitForTimeout(200);
  const copied = await txt('#w118cdr [data-w118ccopy="alt"]');
  ok(copied === "Copied", "drawer: Copy confirms on the button (" + copied + ")");
  await shot("02_drawer");
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400);
  const k2 = await page.evaluate(() => document.getElementById("w118cdr").getAttribute("data-key"));
  ok(k2 && k2 !== "2022-06-media-interview-b", "drawer: right arrow moves to the next photo (" + k2 + ")");
  await page.click('#w118cdr [data-w118ctag]'); await page.waitForTimeout(400);
  ok((await cnt("#w118cdr")) === 0 && (await cnt("#photos .chips .x")) === 1, "drawer: a tag filters the library");
  await page.click('#photos [data-w118cclr="tag"]'); await page.waitForTimeout(300);

  if (staff) {
    /* 4. edit the labels */
    await page.click('#photos [data-w118cop="2024-07-summer-serving-line"]'); await page.waitForTimeout(400);
    await page.click('#w118cdr [data-w118cact="edit"]'); await page.waitForTimeout(400);
    ok((await cnt("#w118cdr #w118cf-title")) === 1, "edit: the form opens");
    await page.fill("#w118cf-title", "Serving line, July 2024");
    const box = await page.evaluate(() => { const r = document.querySelector('#w118cdr [data-w118cfocal] img').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.click(box.x + box.w * 0.7, box.y + box.h * 0.4); await page.waitForTimeout(300);
    const fm = await page.evaluate(() => { const m = document.querySelector("#w118cdr .fm"); return m ? [m.style.left, m.style.top] : null; });
    ok(fm && Math.abs(parseFloat(fm[0]) - 70) < 2 && Math.abs(parseFloat(fm[1]) - 40) < 2, "edit: clicking the photo sets the focal point (" + fm + ")");
    ok((await page.inputValue("#w118cf-title")) === "Serving line, July 2024", "edit: typed values survive a repaint");
    await page.click('#w118cdr [data-w118cbest="story"]'); await page.waitForTimeout(200);
    await page.click('#w118cdr [data-w118cact="suggest"]'); await page.waitForTimeout(900);
    const aih = await cnt("#w118cdr .aih");
    ok(aih > 0, "edit: AI suggestions show as notes (" + aih + ")");
    ok((await page.inputValue("#w118cf-title")) === "Serving line, July 2024", "edit: AI does not overwrite a filled field");
    await shot("03_edit");
    await page.click('#w118cdr [data-w118cai="alt_text"]'); await page.waitForTimeout(200);
    const alt = await page.inputValue("#w118cf-alt_text");
    ok(alt.indexOf("—") < 0 && alt.indexOf("tent, smiling") >= 0, "edit: Use this takes the suggestion, em dash cleaned (" + alt + ")");
    await page.click('#w118cdr [data-w118cact="save"]'); await page.waitForTimeout(600);
    const saved = await page.evaluate(() => window.__wa118c.rows().filter(r => r.key === "2024-07-summer-serving-line")[0]);
    ok(saved && saved.title === "Serving line, July 2024" && Math.abs(saved.focal_x - 0.7) < 0.02 && saved.best_for.indexOf("story") >= 0, "edit: saved title, focal point and best-for");
    ok((await txt("#w118cdr header h3")) === "Serving line, July 2024", "edit: back to the view with the new title");
    ok(await page.evaluate(() => document.querySelector('#photos [data-w118cop="2024-07-summer-serving-line"] .tx b').textContent === "Serving line, July 2024"), "edit: the grid card updates");
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    ok((await cnt("#w118cdr")) === 0 && await page.evaluate(() => location.hash === "#photos"), "drawer: Esc closes and the address goes back to #photos");

    /* 5. add photos */
    await page.click("#photos .add"); await page.waitForTimeout(400);
    ok((await cnt("#w118cdr #w118cdrop")) === 1 && await page.evaluate(() => location.hash === "#photos/new"), "upload: panel opens at #photos/new");
    await page.setInputFiles("#w118cfile", ["/tmp/IMG_8812.JPG", "/tmp/volunteer spotlight.png", "/tmp/notes.txt"]);
    await page.waitForFunction(() => { const r = window.__wa118c.rows(); return r.filter(x => x.status === "needs_labels").length >= 2; }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const up = await page.evaluate(() => window.__wa118c.rows().filter(x => x.status === "needs_labels").map(x => ({ key: x.key, title: x.title, taken: x.taken_on, season: x.season, w: x.width, h: x.height, o: x.orientation, color: x.color, tags: x.tags, bf: x.best_for, fy: x.focal_y, src: x.source, paths: [x.path_full, x.path_web, x.path_thumb] })));
    fs.writeFileSync(path.join(OUT, "uploaded.json"), JSON.stringify(up, null, 1));
    const j = up.filter(x => x.key.indexOf("2023-12-winter-photo-8812") === 0)[0];
    ok(!!j, "upload: EXIF date names the key 2023-12-winter-photo-8812 (" + up.map(x => x.key).join(", ") + ")");
    ok(j && j.w === 2400 && j.h === 1600 && j.o === "landscape" && /^#[0-9A-F]{6}$/.test(j.color), "upload: full size 2400 x 1600, colour " + (j && j.color));
    ok(j && j.taken === "2023-12-17" && j.season === "winter", "upload: taken on 2023-12-17, winter");
    ok(j && j.title === "Volunteers in gold and green" && j.tags.join("|") === "volunteers|tent|winter" && j.bf.join("|") === "card|deck|social_square" && j.fy === 1, "upload: AI labels normalized (title, tags, best-for, focal clamped)");
    ok(j && /Canon EOS R6/.test(j.src) && /original 3000 x 2000/.test(j.src), "upload: source notes the original size and camera");
    const png = up.filter(x => x.key.indexOf("undated-volunteer-spotlight") === 0)[0];
    ok(png && png.taken == null && png.o === "portrait" && png.w === 900 && png.h === 1200, "upload: a PNG without a date is undated and portrait, not upscaled");
    const items = await page.evaluate(() => Array.from(document.querySelectorAll("#w118cdr .it")).map(i => i.className + ": " + i.textContent.trim()));
    ok(items.length === 3 && items.filter(i => /err/.test(i) && /Not a photo/.test(i)).length === 1, "upload: the text file is listed as not a photo (" + items.length + " items)");
    ok((await page.evaluate(() => window.__llmCalls.length)) >= 3, "upload: each photo went to the photo_label route");
    const lastCall = await page.evaluate(() => { const c = window.__llmCalls[window.__llmCalls.length - 1]; return { task: c.headers["x-wa-task"], img: c.body.messages[0].content[0].source.media_type, b64: c.body.messages[0].content[0].source.data.length, tool: c.body.tool_choice.name }; });
    ok(lastCall.task === "photo_label" && lastCall.img === "image/jpeg" && lastCall.b64 > 1000 && lastCall.tool === "photo_labels", "upload: the AI gets a JPEG and the forced tool");
    await shot("04_upload");
    ok((await page.evaluate(() => Array.from(document.querySelectorAll("#photos .chips span")).map(s => s.textContent.replace(/\s+/g, " ").trim()).indexOf("Needs a look 2") >= 0)), "upload: Needs a look 2 chip");
    await page.click('#w118cdr [data-w118cact="review"]'); await page.waitForTimeout(600);
    ok((await txt("#w118cdr header h3")) === "Check the labels", "review: opens the first new photo in the form");
    ok((await page.evaluate(() => { const b = document.querySelector('#w118cdr [data-w118cact="save"]'); return b && b.textContent.trim(); })) === "Save and next", "review: Save and next");
    await page.click('#w118cdr [data-w118cact="save"]'); await page.waitForTimeout(700);
    ok((await txt("#w118cdr header h3")) === "Check the labels" && (await page.evaluate(() => { const b = document.querySelector('#w118cdr [data-w118cact="save"]'); return b && b.textContent.trim(); })) === "Save and confirm", "review: moves to the last one");
    await page.click('#w118cdr [data-w118cact="save"]'); await page.waitForTimeout(700);
    ok((await page.evaluate(() => window.__wa118c.rows().filter(x => x.status === "needs_labels").length)) === 0, "review: both confirmed");
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);

    /* 6. archive and restore */
    await page.click('#photos [data-w118cop="2022-06-media-interview-a"]'); await page.waitForTimeout(400);
    await page.click('#w118cdr [data-w118cact="archive"]'); await page.waitForTimeout(500);
    ok((await cnt('#photos [data-w118cop="2022-06-media-interview-a"]')) === 0, "archive: gone from the library");
    await page.click('#photos [data-w118cst="archived"]'); await page.waitForTimeout(300);
    ok((await cnt("#photos .ph")) === 1, "archive: the Archived chip shows it");
    await page.click('#photos [data-w118cop="2022-06-media-interview-a"]'); await page.waitForTimeout(400);
    const isAdm = await page.evaluate(() => ["steel.macdonald@welfareavenue.com", "steelmacdonald@gmail.com", "suhaib.abdillahi@welfareavenue.com"].indexOf(USER.email) >= 0 || (typeof WA40_MINE !== "undefined" && WA40_MINE && WA40_MINE.role === "admin"));
    ok((await cnt('#w118cdr [data-w118cact="delete"]')) === (isAdm ? 1 : 0), "archive: Delete for good only for admins (admin " + isAdm + ")");
    await page.click('#w118cdr [data-w118cact="restore"]'); await page.waitForTimeout(500);
    ok((await page.evaluate(() => window.__wa118c.rows().filter(x => x.key === "2022-06-media-interview-a")[0].status)) === "ready", "archive: Restore brings it back as ready");
    await page.keyboard.press("Escape"); await page.click('#photos [data-w118cst="archived"]').catch(() => {}); await page.waitForTimeout(300);

    /* 7. the Create studio */
    const canCreate = await page.evaluate(() => (typeof wa40Allowed === "function" ? wa40Allowed() : []).indexOf("create") >= 0);
    if (!canCreate) {
      await go("#photos/2024-07-summer-volunteer-portrait", 900);
      ok((await cnt('#w118cdr [data-w118cuse="create"]')) === 0, "create: no Create studio hand-off without the Create studio page");
      log.push("SKIP create studio: not open to this identity");
    } else {
    await go("#create", 1200);
    ok((await cnt("#create #w118ccd")) === 1, "create: Pick one from the photo library link");
    await page.selectOption("#cdType", "graphic"); await page.waitForTimeout(200);
    await page.click('#create [data-w118cpick="cd"]'); await page.waitForTimeout(700);
    ok((await cnt("#w118cpk .pi")) === 12, "picker: ready photos only (" + await cnt("#w118cpk .pi") + ")");
    await page.click("#w118cpk [data-w118cpr]"); await page.waitForTimeout(300);
    ok((await cnt("#w118cpk .pi")) === 18, "picker: all photos when the toggle is off (" + await cnt("#w118cpk .pi") + ")");
    await page.fill("#w118cpq", "winter"); await page.waitForTimeout(400);
    ok((await cnt("#w118cpk .pi")) >= 3, "picker: search");
    await shot("05_picker");
    await page.click('#w118cpk [data-w118cpp="2022-02-winter-volunteer-group-b"]'); await page.waitForTimeout(400);
    const cd = await page.evaluate(() => ({ img: typeof WA_CD_IMG !== "undefined" ? WA_CD_IMG : null, type: document.getElementById("cdType").value, hint: document.getElementById("cdImgHint").textContent, chip: document.querySelector("#w118ccd .sel").style.display }));
    ok(cd.img && cd.img.indexOf("photos/web/2022-02-winter-volunteer-group-b.jpg?v=1") >= 0 && cd.type === "graphic" && cd.chip === "flex", "create: the pick sets the graphic photo (" + JSON.stringify(cd) + ")");
    await shot("06_create");
    await page.click("#w118ccd [data-w118ccdx]"); await page.waitForTimeout(300);
    ok(await page.evaluate(() => WA_CD_IMG === null && document.querySelector("#w118ccd .sel").style.display === "none"), "create: Remove clears it");
    await go("#photos/2024-07-summer-volunteer-portrait", 900);
    ok((await cnt("#w118cdr .pn")) === 1, "deep link: #photos/<key> opens the photo");
    await page.click('#w118cdr [data-w118cuse="create"]'); await page.waitForTimeout(1500);
    const cd2 = await page.evaluate(() => ({ hash: location.hash, img: WA_CD_IMG, type: document.getElementById("cdType").value }));
    ok(cd2.hash === "#create" && cd2.img && cd2.img.indexOf("2024-07-summer-volunteer-portrait") >= 0 && cd2.type === "graphic", "hand-off: Use in the Create studio (" + JSON.stringify(cd2) + ")");
    }

    /* 8. the content calendar */
    const hasCal = await page.evaluate(() => typeof window.w121Compose === "function");
    if (hasCal) {
      await go("#photos/2024-10-autumn-volunteers-plating", 900);
      await page.click('#w118cdr [data-w118cuse="post"]');
      await page.waitForFunction(() => document.querySelectorAll("#w121dr #w121thumbs .th").length >= 1, null, { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(800);
      const post = await page.evaluate(() => ({ hash: location.hash, thumbs: document.querySelectorAll("#w121dr #w121thumbs .th").length, title: (document.getElementById("w121title") || {}).value, want: window.__wa118c.rows().filter(r => r.key === "2024-10-autumn-volunteers-plating")[0].title, link: !!document.querySelector('#w121dr [data-w118cpick="cal"]') }));
      ok(post.hash.indexOf("#contentcal") === 0 && post.thumbs === 1 && post.title === post.want, "hand-off: Use in a post opens the composer with the photo (" + JSON.stringify(post) + ")");
      ok(post.link, "calendar: the composer drop zone offers the photo library");
      await shot("07_post");
      await page.click('#w121dr [data-w118cpick="cal"]'); await page.waitForTimeout(600);
      ok((await cnt("#w118cpk .pi")) > 0, "calendar: the picker opens over the composer");
      await page.click('#w118cpk .pi'); await page.waitForTimeout(2500);
      ok((await cnt("#w121dr #w121thumbs .th")) === 2, "calendar: a second photo from the picker lands in the post (" + await cnt("#w121dr #w121thumbs .th") + ")");
      await page.evaluate(() => { const x = document.querySelector('#w121dr [data-w121close]'); if (x) x.click(); });
      await page.waitForTimeout(300);
    } else ok(false, "calendar: w121Compose missing");

    /* 9. team tools and search */
    await go("#team/marketing", 1500);
    ok((await cnt('#team .w116tools [data-w116go="#photos"]')) === 1, "team: Marketing tools list the photo library");
    await go("#team/opsmtl", 1200);
    ok((await cnt('#team .w116tools [data-w116go="#photos"]')) === 0, "team: not on Operations Montreal");
  }
  const gsVisible = await page.evaluate(() => { const g = document.getElementById("globalSearch"); return !!(g && g.offsetParent); });
  if (gsVisible) {
  await page.fill("#globalSearch", "winter volunteers"); await page.dispatchEvent("#globalSearch", "input"); await page.waitForTimeout(900);
  const sr = await page.evaluate(() => Array.from(document.querySelectorAll("#searchResults .sr[data-w118cs]")).map(s => s.getAttribute("data-w118cs")));
  ok(sr.length > 0, "search everything: photo results (" + sr.join(", ") + ")");
  if (sr.length) { await page.click("#searchResults .sr[data-w118cs]"); await page.waitForTimeout(900); ok(await page.evaluate(() => location.hash.indexOf("#photos/") === 0 && !!document.querySelector("#w118cdr .pn")), "search everything: a photo result opens it"); }
  await page.keyboard.press("Escape");
  } else log.push("SKIP search everything: hidden for this identity");

  /* 10. help */
  await go("#photos", 800);
  await page.click("#photos [data-w118chelp]"); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById("modalBack").style.display === "flex" && document.getElementById("modalBox").textContent.indexOf("The badges") >= 0), "help: the guide opens");
  await page.evaluate(() => { const c = document.getElementById("w118chc"); if (c) c.click(); });

  fs.writeFileSync(path.join(OUT, "drive_" + ROLE + ".txt"), log.join("\n") + "\n\nerrors:\n" + errs.join("\n"));
  console.log(log.join("\n")); console.log("errors", errs.length, errs.slice(0, 5)); console.log(fails ? "FAILS " + fails : "ALL PASS");
  await browser.close();
})();
