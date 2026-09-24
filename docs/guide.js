const { Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat, AlignmentType, convertInchesToTwip } = require('docx');

const green = "1F5F4F";
const ink = "243029";
const mut = "6B7670";

function h(text) {
  return new Paragraph({
    spacing: { before: 170, after: 60 },
    children: [new TextRun({ text, bold: true, size: 23, color: green, font: "Calibri" })]
  });
}
function p(children, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 70, line: 252 },
    numbering: opts.bullet ? { reference: "b", level: 0 } : undefined,
    children: children.map(c => typeof c === "string"
      ? new TextRun({ text: c, size: 20, color: ink, font: "Calibri" })
      : new TextRun({ size: 20, font: "Calibri", color: ink, ...c }))
  });
}
const say = (t) => ({ text: t, italics: true, color: green });

const doc = new Document({
  numbering: { config: [{ reference: "b", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 300, hanging: 160 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 620, bottom: 560, left: 860, right: 860 } } },
    children: [
      new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: "Speaking so the Hub hears you", bold: true, size: 32, color: green, font: "Calibri" })] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "A one-pager for leadership. When a meeting recording is uploaded, the Hub's AI reads it and updates the board: it opens tasks, closes finished work, raises decisions, and routes everything to the right project. It only acts on what it hears clearly. Say things this way and nothing falls through.", size: 20, color: mut, font: "Calibri", italics: true })] }),

      h("Opening a task"),
      p(["Name one owner from the roster, say the task as an action, and give the date if there is one."]),
      p([say('"Amanda will draft the sponsorship deck for Scotiabank, due August 22."')], { bullet: true }),
      p(["First names are fine, but say them clearly: the transcript app garbles names, and a name the AI cannot match gets flagged for review instead of assigned. “Someone should” assigns nobody: if it matters, name the person."]),

      h("Closing a task"),
      p(["The AI is deliberately conservative: it closes work only when it hears it is finished. “Almost done” and “still working on it” keep a task open, and that is correct."]),
      p([say('"The volunteer handbook is done and sent." '), " ", say('"We’re dropping the mural project."')], { bullet: true }),
      p(["Words that close: done, shipped, delivered, resolved, signed, hired, cancelled, dropped."]),

      h("Moving or changing a task"),
      p(["The AI never rewrites an existing task, so a change is a close plus a fresh open:"]),
      p([say('"Drop the old poster task; new task, Ian owns the September version, due September 5."')], { bullet: true }),

      h("Decisions"),
      p(["Say when a call needs Steel or Suhaib personally, and why: budget, hiring, legal or risk, strategy, partnership, or policy. When a decision gets made in the room, say it as a verdict so the open decision closes:"]),
      p([say('"This needs an executive decision: the $150 biweekly kitchen rental, budget call."')], { bullet: true }),
      p([say('"We’ve decided: we’re going with the Verdun kitchen."')], { bullet: true }),

      h("Requests to another team"),
      p(["Say the team, the thing, and the deadline; the Hub suggests it as a request for that team’s queue."]),
      p([say('"We need a request to marketing: a one-page flyer for the One Bag Challenge by August 20."')], { bullet: true }),

      h("Projects and serving events"),
      p(["Name the project when you hand out work and it lands on that project’s page, even across teams. For Sunday serving events, say the date and the task attaches to that event’s checklist."]),
      p([say('"For the Community Kitchen Pilot, Shima confirms the rental."'), "  ", say('"For the August 24 serving: Rami owns groceries."')], { bullet: true }),

      h("Sensitive topics"),
      p(["Anything about individual performance, compensation, departures, or legal matters: say ", { text: "“this is board only”", bold: true }, " out loud. The AI also catches these on its own and locks the whole update to board visibility, but saying it removes all doubt."]),

      h("The 60-second recap (the highest-value habit)"),
      p(["End every meeting with a spoken recap. It is the clearest signal the AI gets, and it doubles as a human check:"]),
      p([say('"To recap the actions: Amanda, sponsorship deck by the 22nd. Ian, September poster. The handbook task is closed. One executive decision raised on the kitchen rental."')], { bullet: true }),
      new Paragraph({ spacing: { before: 130 }, children: [new TextRun({ text: "Upload the transcript to the Hub as usual; the Slack channel gets a note showing exactly what changed, and everything the AI did is reviewable and reversible on the department page. Questions or a task that landed wrong: message Steel.", size: 19, color: mut, font: "Calibri", italics: true })] })
    ]
  }]
});
Packer.toBuffer(doc).then(b => require('fs').writeFileSync("07-08-26 - Speaking so the Hub hears you (leadership one-pager).docx", b));
