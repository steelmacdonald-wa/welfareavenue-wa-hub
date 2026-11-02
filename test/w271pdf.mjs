// wave271: a stand-in for pdf-lib and its fontkit, so recruit-actions loads offline (the rig maps 'npm:pdf-lib@1.17.1' and
// 'npm:@pdf-lib/fontkit@1.1.1' here). save() returns the JSON of everything drawn, as bytes: the same letter gives the same bytes,
// and any change to what is drawn changes them, which is what a "the PDF is unchanged" test needs. Not a PDF; never leaves a test.
export const rgb = (r, g, b) => ({ r, g, b });
export const degrees = (n) => ({ degrees: n });
export const StandardFonts = { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold' };
const font = (name) => ({ name, widthOfTextAtSize: (t, size) => String(t).length * size * 0.5 });
export class PDFDocument {
  static async create() { return new PDFDocument(); }
  constructor() { this.meta = {}; this.pages = []; }
  setTitle(v) { this.meta.title = v; }
  setAuthor(v) { this.meta.author = v; }
  setCreator(v) { this.meta.creator = v; }
  registerFontkit() {}
  async embedFont(src) { return font(typeof src === 'string' ? src : 'embedded'); }
  async embedPng() { return { width: 400, height: 100 }; }
  addPage(size) {
    const page = { size, ops: [] };
    for (const op of ['drawText', 'drawRectangle', 'drawLine', 'drawImage']) page[op] = (...args) => { page.ops.push([op, ...args]); };
    this.pages.push(page); return page;
  }
  getPages() { return this.pages; }
  async save() { return new TextEncoder().encode(JSON.stringify({ meta: this.meta, pages: this.pages })); }
}
export default {};   // the fontkit module's default export
