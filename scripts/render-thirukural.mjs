import { mkdir, readFile, writeFile } from "node:fs/promises";

const kurals = JSON.parse(await readFile("data/kurals.json", "utf8"));
if (kurals.length !== 1330) throw new Error(`Expected 1330 Kurals, found ${kurals.length}`);

const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
const kural = kurals[day % kurals.length];

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[character]);
const wrap = (text, width = 82) => text.replace(/([,;])(?=\S)/g, "$1 ").split(/\s+/)
  .reduce((lines, word) => {
    const current = lines.at(-1);
    if (!current || `${current} ${word}`.length > width) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
    return lines;
  }, []);

function render(theme) {
  const dark = theme === "dark";
  const paper = dark ? "#0f0f0e" : "#f4f0e7";
  const ink = dark ? "#eee9df" : "#171715";
  const muted = dark ? "#8d8981" : "#6f6a62";
  const rule = dark ? "#32312e" : "#d2ccc0";
  const english = wrap(kural.english);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="340" viewBox="0 0 1000 340" role="img" aria-labelledby="title description">
  <title id="title">Thirukural of the day — ${kural.number}</title>
  <desc id="description">${escapeXml(kural.tamil.join(" "))} ${escapeXml(kural.english)}</desc>
  <rect width="1000" height="340" fill="${paper}"/>
  <text x="54" y="55" fill="${muted}" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="10" letter-spacing="3.5">THIRUKURAL OF THE DAY</text>
  <text x="946" y="55" text-anchor="end" fill="${muted}" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="10" letter-spacing="2">${date}</text>
  <line x1="54" y1="76" x2="946" y2="76" stroke="${rule}"/>
  <text x="54" y="133" fill="${ink}" font-family="Noto Sans Tamil,Nirmala UI,Latha,sans-serif" font-size="27" font-weight="600">${escapeXml(kural.tamil[0])}</text>
  <text x="54" y="179" fill="${ink}" font-family="Noto Sans Tamil,Nirmala UI,Latha,sans-serif" font-size="27" font-weight="600">${escapeXml(kural.tamil[1])}</text>
  <line x1="54" y1="211" x2="88" y2="211" stroke="#b44335" stroke-width="3"/>
  <text x="54" y="250" fill="${muted}" font-family="Georgia,serif" font-size="18" font-style="italic">${escapeXml(english[0])}</text>
  ${english[1] ? `<text x="54" y="280" fill="${muted}" font-family="Georgia,serif" font-size="18" font-style="italic">${escapeXml(english.slice(1).join(" "))}</text>` : ""}
  <text x="946" y="164" text-anchor="end" fill="${ink}" font-family="Georgia,serif" font-size="76">${kural.number}</text>
  <text x="946" y="188" text-anchor="end" fill="${muted}" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="9" letter-spacing="2">OF 1330</text>
  <text x="946" y="302" text-anchor="end" fill="${muted}" font-family="Georgia,serif" font-size="11" font-style="italic">G. U. Pope translation</text>
</svg>`;
}

await mkdir("generated", { recursive: true });
await Promise.all([
  writeFile("generated/thirukural-dark.svg", render("dark")),
  writeFile("generated/thirukural-light.svg", render("light")),
]);
const readme = await readFile("README.md", "utf8");
await writeFile("README.md", readme.replace(
  /(generated\/thirukural-(?:dark|light)\.svg)(?:\?v=[^"']*)?/g,
  `$1?v=${date}`,
));
console.log({ date, kural: kural.number });
