// Build "AdaL Autonomy" deck (pptx) — 16:9, AdaL dark branding.
// Native text/images so the deck stays editable in PowerPoint and Google Slides.
// Run: node build_deck.js   (from docs/adal/loop_graph_presentation/)
const pptxgen = require("../node_modules/pptxgenjs");

const PINK = "FF5898";
const BG = "151519";
const PANEL = "1D1D23";
const TXT = "F2F2F5";
const DIM = "9B9BA6";

const p = new pptxgen();
p.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
p.layout = "WIDE";
p.author = "Li Yin";
p.title = "When the sun goes down, does your work still go on?";

const LOGO = "assets/adal-logo.png";

function base(slide, title) {
  slide.background = { color: BG };
  if (title) {
    slide.addText(title, {
      x: 0.6, y: 0.5, w: 12.1, h: 1.0,
      fontSize: 32, bold: true, color: TXT, fontFace: "Inter",
    });
  }
  slide.addText("@panda_liyin", {
    x: 0.6, y: 6.9, w: 3, h: 0.5,
    fontSize: 18, color: "E6E6EC", bold: true, fontFace: "Inter",
  });
  slide.addImage({ path: LOGO, x: 11.5, y: 6.85, w: 1.55, h: 0.55 });
}

// 1 — Title
let s = p.addSlide();
s.background = { color: BG };
s.addImage({ path: "assets/adal-girl.png", x: 0, y: 0, w: 13.333, h: 7.5 });
s.addShape(p.ShapeType.rect, {
  x: 0, y: 0, w: 8.2, h: 7.5,
  fill: { color: BG, transparency: 22 },
  line: { color: BG, transparency: 100 },
});
s.addText("LOOP, GRAPH, AND JEV", {
  x: 0.65, y: 1.7, w: 8, h: 0.4,
  fontSize: 16, bold: true, color: "FF8AB8", fontFace: "Inter", charSpacing: 3,
});
s.addText("When the sun goes down,\ndoes your work still go on?", {
  x: 0.62, y: 2.2, w: 7.6, h: 2.3,
  fontSize: 44, bold: true, color: TXT, fontFace: "Inter", lineSpacing: 50,
});
s.addText("Exploring the future of agent autonomy", {
  x: 0.65, y: 4.7, w: 7.5, h: 0.5,
  fontSize: 22, color: "D6D6DE", fontFace: "Inter",
});
s.addText([
  { text: "Li Yin\n", options: { fontSize: 22, bold: true, color: TXT } },
  { text: "Cofounder & CEO @ AdaL · AI researcher & agent builder", options: { fontSize: 15, color: "C9C9D2" } },
], { x: 0.65, y: 5.6, w: 7.5, h: 0.9, fontFace: "Inter" });
s.addText("@panda_liyin", {
  x: 0.65, y: 6.9, w: 3, h: 0.5,
  fontSize: 18, color: "E6E6EC", bold: true, fontFace: "Inter",
});
s.addImage({ path: LOGO, x: 11.5, y: 6.85, w: 1.55, h: 0.55 });

// 2 — What AdaL is
s = p.addSlide();
s.background = { color: BG };
s.addText("@panda_liyin", {
  x: 0.6, y: 6.9, w: 3, h: 0.5,
  fontSize: 18, color: "E6E6EC", bold: true, fontFace: "Inter",
});
s.addImage({ path: LOGO, x: 11.5, y: 6.85, w: 1.55, h: 0.55 });
s.addText("WHAT ADAL IS", {
  x: 0.65, y: 1.7, w: 8, h: 0.4,
  fontSize: 17, bold: true, color: PINK, fontFace: "Inter", charSpacing: 3,
});
s.addText("Every coding agent can build, but only AdaL does GTM directly from your codebase.", {
  x: 0.62, y: 2.3, w: 11.5, h: 2.6,
  fontSize: 40, bold: true, color: TXT, fontFace: "Inter", lineSpacingMultiple: 1.1,
});

// 3 — Demo: idea to GTM (embedded video)
s = p.addSlide();
s.background = { color: BG };
base(s, "Demo: idea to GTM");
s.addMedia({
  type: "video",
  path: "assets/jev-demo.mp4",
  x: 1.31, y: 0.97, w: 10.71, h: 6.03,
  objectName: "Idea to GTM demo",
});

// 4 — Babysitting paradox
s = p.addSlide();
s.background = { color: BG };
base(s, "The babysitting paradox");
s.addText("One side is agentmaxxing. What stops us is babysitting agents to the quality bar.", {
  x: 0.65, y: 1.55, w: 11.5, h: 0.6,
  fontSize: 18, color: DIM, fontFace: "Inter",
});
s.addImage({ path: "assets/babysitting-paradox.png", x: 2.1, y: 2.35, w: 9.1, h: 4.5 });

// 5 — What human quality work actually takes
s = p.addSlide();
s.background = { color: BG };
base(s, "What human quality work actually takes");
s.addImage({ path: "assets/layers-outer-loop.png", x: 2.0, y: 1.75, w: 9.3, h: 5.2 });

// 6 — Five gaps
s = p.addSlide();
s.background = { color: BG };
base(s, "Five gaps");
s.addImage({ path: "assets/five-gaps-autonomy.png", x: 1.4, y: 1.8, w: 10.5, h: 5.1 });

// 7 — Where AdaL stands
s = p.addSlide();
s.background = { color: BG };
base(s, "Where AdaL stands");
s.addImage({ path: "assets/adal-capabilities-ai.png", x: 2.0, y: 1.85, w: 9.3, h: 5.0 });

// 8 — Modeling: LLMs vs Jev
s = p.addSlide();
s.background = { color: BG };
base(s, "Modeling: LLMs vs Jev");
s.addShape(p.ShapeType.roundRect, {
  x: 0.7, y: 1.75, w: 5.85, h: 4.6,
  fill: { color: PANEL }, line: { color: "2A2A31", width: 1 },
});
s.addImage({ path: "assets/kimi-k3-llm-model-architecture.png", x: 0.95, y: 1.95, w: 5.35, h: 3.6 });
s.addText([
  { text: "Kimi Team, Kimi K3: Open Frontier Intelligence · ", options: { color: DIM } },
  { text: "arxiv.org/abs/2607.24653", options: { color: PINK } },
], { x: 0.95, y: 5.7, w: 5.35, h: 0.5, fontSize: 12, fontFace: "Inter" });
s.addShape(p.ShapeType.roundRect, {
  x: 6.78, y: 1.75, w: 5.85, h: 4.6,
  fill: { color: PANEL }, line: { color: "2A2A31", width: 1 },
});
s.addImage({ path: "assets/typesafe-model-structure.png", x: 7.03, y: 1.95, w: 5.35, h: 3.6 });
s.addText([
  { text: "TypeSafe, Introducing System One Models & Jev · ", options: { color: DIM } },
  { text: "typesafe.ai/blog", options: { color: PINK } },
], { x: 7.03, y: 5.7, w: 5.35, h: 0.5, fontSize: 12, fontFace: "Inter" });

// 9 — The planner and the judge
s = p.addSlide();
s.background = { color: BG };
base(s, "The planner and the judge");
s.addImage({ path: "assets/llm-vs-jev.png", x: 1.9, y: 1.8, w: 9.5, h: 5.35 });

// 10 — What Jev returns
s = p.addSlide();
s.background = { color: BG };
base(s, "What Jev returns");
s.addText("State plus typed questions in. Typed answers with probabilities out. Not a paragraph.", {
  x: 0.65, y: 1.55, w: 11.5, h: 0.5,
  fontSize: 18, color: DIM, fontFace: "Inter",
});
s.addShape(p.ShapeType.roundRect, {
  x: 0.7, y: 2.25, w: 5.85, h: 4.0,
  fill: { color: "0F0F13" }, line: { color: "2A2A31", width: 1 },
});
s.addText([
  { text: "IN\n", options: { fontSize: 15, bold: true, color: PINK, charSpacing: 2 } },
  { text: 'state: "Tried Stripe for 3 days.\nLosing sales. Help ASAP."\n\nquestions:\n  department  choice\n    billing | technical | sales\n  frustration  score\n    0 calm\n    1 frustrated but civil\n    2 very angry\n  is_urgent  noul', options: { fontSize: 16, color: "D6D6DE", fontFace: "Courier New" } },
], { x: 1.0, y: 2.45, w: 5.3, h: 3.6, valign: "top" });
s.addShape(p.ShapeType.roundRect, {
  x: 6.78, y: 2.25, w: 5.85, h: 4.0,
  fill: { color: "0F0F13" }, line: { color: "2A2A31", width: 1 },
});
s.addText([
  { text: "OUT\n", options: { fontSize: 15, bold: true, color: PINK, charSpacing: 2 } },
  { text: "department    technical  0.85\nfrustration   1  frustrated but civil\nis_urgent     1.0\n\n", options: { fontSize: 18, color: "D6D6DE", fontFace: "Courier New" } },
  { text: "Your code branches. 70–500 ms. No text to parse.", options: { fontSize: 15, color: "C9C9D2" } },
], { x: 7.1, y: 2.45, w: 5.3, h: 3.6, valign: "top" });
s.addText([
  { text: "TypeSafe, Introducing System One Models & Jev · ", options: { color: DIM } },
  { text: "typesafe.ai/blog", options: { color: PINK } },
], { x: 0.7, y: 6.4, w: 11, h: 0.4, fontSize: 12, fontFace: "Inter" });

// 11 — Loop engineering
s = p.addSlide();
s.background = { color: BG };
base(s, "Loop engineering: work until the goal is achieved");
s.addImage({ path: "assets/jev-three-levels.png", x: 0.7, y: 1.8, w: 5.6, h: 5.0 });
s.addText([
  { text: "1  Premature stop\n", options: { fontSize: 20, bold: true, color: TXT } },
  { text: 'The model says it will run the tests, and never calls the tool. About 10% of tool calls stop like this. Jev catches that, we bounce, and the same turn continues. This one is shipped, so you will not see it in AdaL now.\n\n', options: { fontSize: 15, color: DIM } },
  { text: "2  Auto permission\n", options: { fontSize: 20, bold: true, color: TXT } },
  { text: "Before a destructive command, Jev can allow it, ask you, or deny it. That is a more secure YOLO. Not shipped yet.\n\n", options: { fontSize: 15, color: DIM } },
  { text: "3  Goal achieved\n", options: { fontSize: 20, bold: true, color: TXT } },
  { text: "When the model tries to stop, is the finish line actually crossed? If not, another turn starts. That is /goal, and it is next.", options: { fontSize: 15, color: DIM } },
], { x: 6.7, y: 1.9, w: 6.0, h: 4.9, valign: "top", fontFace: "Inter" });

// 12 — Graph engineering
s = p.addSlide();
s.background = { color: BG };
base(s, "Graph engineering: big jobs need more than one worker");
s.addImage({ path: "assets/17-agentic-loop-graph.png", x: 2.0, y: 1.85, w: 9.3, h: 5.1 });

// 13 — AdaL Engineer demo (embedded video)
s = p.addSlide();
s.background = { color: BG };
base(s, "AdaL Engineer");
s.addMedia({
  type: "video",
  path: "assets/adal-engineer-demo.mp4",
  x: 1.31, y: 0.97, w: 10.71, h: 6.03,
  objectName: "AdaL Engineer demo",
});

// 14 — The world is a loop
s = p.addSlide();
s.background = { color: BG };
base(s, "The world is a complicated, many-layered loop");
s.addImage({ path: "assets/world-many-loops.png", x: 2.0, y: 1.85, w: 9.3, h: 5.1 });

// 15 — Closing + promo
s = p.addSlide();
s.background = { color: BG };
s.addText("@panda_liyin", {
  x: 0.6, y: 6.9, w: 3, h: 0.5,
  fontSize: 18, color: "E6E6EC", bold: true, fontFace: "Inter",
});
s.addImage({ path: LOGO, x: 11.5, y: 6.85, w: 1.55, h: 0.55 });
s.addImage({ path: "assets/qr-jevtalk1mo-branded.png", x: 4.72, y: 1.15, w: 3.9, h: 3.9 });
s.addText([
  { text: "adalagent.ai\n", options: { fontSize: 30, bold: true, color: TXT } },
  { text: "AdaL makes work and life a little lighter.", options: { fontSize: 26, bold: true, color: "FF8AB8" } },
], { x: 0.6, y: 5.35, w: 12.13, h: 1.4, align: "center", fontFace: "Inter" });

p.writeFile({ fileName: "adal-autonomy-deck-2026-09-25.pptx" }).then((f) => console.log("WROTE", f));
