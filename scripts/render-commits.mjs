import { mkdir, readFile, writeFile } from "node:fs/promises";

const login = process.env.PROFILE_LOGIN || "dumbly-smart";
const token = process.env.GH_TOKEN;
if (!token) throw new Error("GH_TOKEN is required");

const query = `query($login:String!) {
  user(login:$login) {
    name login bio url
    contributionsCollection {
      commitContributionsByRepository(maxRepositories: 100) {
        contributions { totalCount }
      }
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount weekday } }
      }
    }
  }
}`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    authorization: `bearer ${token}`,
    "content-type": "application/json",
    "user-agent": `${login}-profile-renderer`,
  },
  body: JSON.stringify({ query, variables: { login } }),
});
if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
const payload = await response.json();
if (payload.errors) throw new Error(payload.errors.map((e) => e.message).join("; "));

const user = payload.data.user;
const collection = user.contributionsCollection;
const calendar = collection.contributionCalendar;
const days = calendar.weeks.flatMap((week) => week.contributionDays);
const commits = collection.commitContributionsByRepository.reduce(
  (sum, repository) => sum + repository.contributions.totalCount,
  0,
);
const active = days.filter((day) => day.contributionCount > 0);
const recent30 = days.slice(-30).reduce((sum, day) => sum + day.contributionCount, 0);
const recent7 = days.slice(-7).reduce((sum, day) => sum + day.contributionCount, 0);
const peak = Math.max(0, ...days.map((day) => day.contributionCount));
const sectorCount = new Set(days.map((day) => day.date.slice(0, 7))).size;

function streakFrom(list) {
  let streak = 0;
  let allowedTodayGap = true;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].contributionCount === 0) {
      if (i === list.length - 1 && allowedTodayGap) {
        allowedTodayGap = false;
        continue;
      }
      break;
    }
    streak++;
  }
  return streak;
}

const stats = {
  login,
  generatedAt: new Date().toISOString(),
  period: { from: days[0]?.date, to: days.at(-1)?.date },
  publicCommits: commits,
  totalContributions: calendar.totalContributions,
  activeDays: active.length,
  currentStreak: streakFrom(days),
  last7Days: recent7,
  last30Days: recent30,
  peakDay: peak,
  sectorCount,
  days: days.map(({ date, contributionCount, weekday }) => ({ date, contributionCount, weekday })),
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[c]));

function render(theme) {
  // Intentionally keep both variants terminal-dark: the profile should have one
  // strong identity instead of changing character with the viewer's theme.
  const paper = "#0d1117";
  const panel = "#010409";
  const ink = "#f0f6fc";
  const quiet = "#8b949e";
  const rule = "#30363d";
  const green = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
  const cell = 10;
  const gap = 3;
  const gridX = 58;
  const gridY = 292;
  const visible = days.slice(-371);
  const firstWeekday = visible[0]?.weekday || 0;
  const cells = visible.map((day, index) => {
    const n = index + firstWeekday;
    const x = gridX + Math.floor(n / 7) * (cell + gap);
    const y = gridY + (n % 7) * (cell + gap);
    const ratio = peak ? day.contributionCount / peak : 0;
    const level = day.contributionCount === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(ratio * 4)));
    return `<rect class="day level-${level}" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${green[level]}"><title>${day.date} · ${day.contributionCount} contribution${day.contributionCount === 1 ? "" : "s"}</title></rect>`;
  }).join("");

  const bars = days.slice(-30).map((day, i) => {
    const height = peak ? Math.max(3, Math.round((day.contributionCount / peak) * 54)) : 3;
    return `<rect class="bar" x="${58 + i * 21}" y="${244 - height}" width="13" height="${height}" rx="3" fill="${day.contributionCount ? "#39d353" : "#161b22"}" opacity="${day.contributionCount ? ".92" : "1"}" style="animation-delay:${(i * 35)}ms"><title>${day.date} · ${day.contributionCount}</title></rect>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="455" viewBox="0 0 1000 455" role="img" aria-labelledby="title desc">
  <title id="title">Debug ${esc(login)}&apos;s contribution timeline</title>
  <desc id="desc">A playable old-school debugger generated from one year of GitHub activity.</desc>
  <metadata>${esc(JSON.stringify(stats))}</metadata>
  <defs><filter id="glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <style>
    .day,.bar{transition:filter .15s ease,opacity .15s ease,transform .15s ease;transform-box:fill-box;transform-origin:center}
    .day:hover,.bar:hover{filter:url(#glow);opacity:1;transform:scale(1.5)}
    .bar{animation:rise .7s ease-out both}
    .cursor{animation:blink 1.05s steps(1,end) infinite}
    .scan{animation:scan 5s linear infinite}
    @keyframes rise{from{transform:scaleY(.08);opacity:.15}}
    @keyframes blink{50%{opacity:0}}
    @keyframes scan{from{transform:translateX(-720px)}to{transform:translateX(1000px)}}
    @media (prefers-reduced-motion:reduce){.bar,.cursor,.scan{animation:none}}
  </style>
  <rect width="1000" height="455" rx="14" fill="${paper}"/>
  <rect x="20" y="20" width="960" height="415" rx="10" fill="${panel}" stroke="${rule}"/>
  <path d="M20 67H980" stroke="${rule}"/>
  <circle cx="45" cy="44" r="6" fill="#ff5f56"/><circle cx="65" cy="44" r="6" fill="#ffbd2e"/><circle cx="85" cy="44" r="6" fill="#27c93f"/>
  <text x="110" y="49" font-family="ui-monospace,monospace" font-size="12" fill="${quiet}">CHRONO_DEBUG.EXE / CONTRIBUTION MEMORY</text>
  <text x="955" y="49" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="${quiet}">${esc(stats.period.from)} → ${esc(stats.period.to)}</text>
  <text x="46" y="100" font-family="ui-monospace,monospace" font-size="13" fill="#39d353">A:\&gt; chrono_debug --scan timeline.bin</text><rect class="cursor" x="390" y="87" width="8" height="16" fill="#39d353"/>
  <g font-family="ui-monospace,monospace">
    <rect x="45" y="120" width="205" height="65" rx="7" fill="#0d1117" stroke="${rule}"/><text x="61" y="144" font-size="10" fill="${quiet}">PUBLIC COMMITS</text><text x="61" y="174" font-size="27" font-weight="700" fill="${ink}">${commits}</text>
    <rect x="263" y="120" width="205" height="65" rx="7" fill="#0d1117" stroke="${rule}"/><text x="279" y="144" font-size="10" fill="${quiet}">CONTRIBUTIONS</text><text x="279" y="174" font-size="27" font-weight="700" fill="#39d353">${calendar.totalContributions}</text>
    <rect x="481" y="120" width="205" height="65" rx="7" fill="#0d1117" stroke="${rule}"/><text x="497" y="144" font-size="10" fill="${quiet}">CURRENT STREAK</text><text x="497" y="174" font-size="27" font-weight="700" fill="${ink}">${stats.currentStreak}<tspan font-size="12" fill="${quiet}"> days</tspan></text>
    <rect x="699" y="120" width="256" height="65" rx="7" fill="#0d1117" stroke="${rule}"/><text x="715" y="144" font-size="10" fill="${quiet}">ACTIVE DAYS / PEAK</text><text x="715" y="174" font-size="27" font-weight="700" fill="${ink}">${active.length}<tspan font-size="12" fill="${quiet}"> days  ·  </tspan><tspan fill="#39d353">${peak}</tspan></text>
  </g>
  <text x="46" y="210" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">LIVE MEMORY / LAST 30 DAYS</text>
  ${bars}
  <text x="716" y="210" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">DIAGNOSTIC</text>
  <text x="716" y="237" font-family="ui-monospace,monospace" font-size="12" fill="#ffbd2e">! ${sectorCount} SECTORS REQUIRE INPUT</text>
  <path d="M46 261H954" stroke="${rule}"/>
  <text x="46" y="282" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">CONTRIBUTION ADDRESS TABLE</text>
  ${cells}
  <g font-family="ui-monospace,monospace" font-size="10" fill="${quiet}"><text x="763" y="310">less</text>${green.map((color, i) => `<rect x="${800 + i * 20}" y="300" width="12" height="12" rx="2" fill="${color}"/>`).join("")}<text x="910" y="310">more</text></g>
  <path class="scan" d="M0 286V386" stroke="#39d353" stroke-width="2" opacity=".16"/>
  <text x="46" y="413" font-family="ui-monospace,monospace" font-size="11" fill="${quiet}">CLICK TO INITIALIZE MANUAL REPAIR  ·  touch / mouse / keyboard</text>
  <text x="954" y="413" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="#ffbd2e">[ ENTER ] DEBUG TIMELINE →</text>
</svg>`;
}

await mkdir("generated", { recursive: true });
await mkdir("docs", { recursive: true });
const activityJson = `${JSON.stringify(stats, null, 2)}\n`;
await Promise.all([
  writeFile("generated/debugger-dark.svg", render("dark")),
  writeFile("generated/debugger-light.svg", render("light")),
  writeFile("generated/activity.json", activityJson),
  writeFile("docs/activity.json", activityJson),
]);

let readme = await readFile("README.md", "utf8");
const start = "<!-- ACTIVITY_DETAILS:START -->";
const end = "<!-- ACTIVITY_DETAILS:END -->";
const details = `${start}
<details>
<summary>How the timeline was compiled</summary>
<br>

The **${sectorCount} calendar sectors** are generated from **${commits} public commits** across **${active.length} active days**. Each month selects a deterministic signal-routing, memory, or log-recovery puzzle. The activity cells contain the real daily counts; no private commit data is exposed.

[Play the debugger](https://dumbly-smart.github.io/dumbly-smart/) · [Raw data](./generated/activity.json) · [Generator](./scripts/render-commits.mjs)

</details>
${end}`;
const activityPattern = new RegExp(`${start}[\\s\\S]*?${end}`);
if (!activityPattern.test(readme)) throw new Error("README activity markers are missing");
readme = readme.replace(activityPattern, details);

const kurals = JSON.parse(await readFile("data/kurals.json", "utf8"));
if (kurals.length !== 1330) throw new Error(`Expected 1330 Kurals, found ${kurals.length}`);
const todayInIndia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const dayNumber = Math.floor(Date.parse(`${todayInIndia}T00:00:00Z`) / 86_400_000);
const kural = kurals[dayNumber % kurals.length];
const normalizedEnglish = kural.english.replace(/([,;])(?=\S)/g, "$1 ");
const englishLines = normalizedEnglish.split(";").map((line) => line.trim());
const wrapWords = (text, width = 78) => text.split(/\s+/).reduce((lines, word) => {
  const last = lines.at(-1);
  if (!last || `${last} ${word}`.length > width) lines.push(word);
  else lines[lines.length - 1] = `${last} ${word}`;
  return lines;
}, []);
const kuralXml = (theme) => {
  const dark = theme === "dark";
  const background = dark ? "#111111" : "#f2efe7";
  const ink = dark ? "#eeeae0" : "#171717";
  const quiet = dark ? "#99958d" : "#68645d";
  const rule = dark ? "#343434" : "#c9c5bc";
  const accent = "#c43b2f";
  const english = wrapWords(normalizedEnglish);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300" viewBox="0 0 1000 300" role="img" aria-labelledby="k-title k-desc">
  <title id="k-title">Thirukural of the day: Kural ${kural.number}</title>
  <desc id="k-desc">${esc(kural.tamil.join(" "))} ${esc(kural.english)}</desc>
  <rect width="1000" height="300" fill="${background}"/>
  <path d="M28 76H972M790 76V262M28 262H972" stroke="${rule}"/>
  <rect x="28" y="45" width="28" height="3" fill="${accent}"/>
  <text x="70" y="51" font-family="ui-monospace,monospace" font-size="11" letter-spacing="3" fill="${quiet}">THIRUKURAL OF THE DAY</text>
  <text x="942" y="184" text-anchor="end" font-family="Georgia,serif" font-size="92" font-weight="700" fill="${ink}">${kural.number}</text>
  <text x="942" y="213" text-anchor="end" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">OF 1330</text>
  <text x="52" y="119" font-family="Noto Sans Tamil,Nirmala UI,Latha,sans-serif" font-size="24" font-weight="600" fill="${ink}">${esc(kural.tamil[0])}</text>
  <text x="52" y="158" font-family="Noto Sans Tamil,Nirmala UI,Latha,sans-serif" font-size="24" font-weight="600" fill="${ink}">${esc(kural.tamil[1])}</text>
  <path d="M52 187H94" stroke="${accent}" stroke-width="3"/>
  <text x="52" y="221" font-family="Georgia,serif" font-size="17" font-style="italic" fill="${quiet}">${esc(english[0])}</text>
  ${english[1] ? `<text x="52" y="247" font-family="Georgia,serif" font-size="17" font-style="italic" fill="${quiet}">${esc(english.slice(1).join("; "))}</text>` : ""}
</svg>`;
};
await Promise.all([
  writeFile("generated/thirukural-dark.svg", kuralXml("dark")),
  writeFile("generated/thirukural-light.svg", kuralXml("light")),
]);
const kuralStart = "<!-- THIRUKKURAL:START -->";
const kuralEnd = "<!-- THIRUKKURAL:END -->";
const dailyKural = `${kuralStart}
<details>
<summary>Copy the couplet</summary>
<br>

> ${kural.tamil[0]}<br>
> ${kural.tamil[1]}
>
> ${englishLines[0]}${englishLines.length > 1 ? "<br>\n> " + englishLines.slice(1).join("; ") : ""}${/[.!?]$/.test(kural.english) ? "" : "."}

<sub>Kural ${kural.number} · English translation by G. U. Pope</sub>

</details>
${kuralEnd}`;
const kuralPattern = new RegExp(`${kuralStart}[\\s\\S]*?${kuralEnd}`);
if (!kuralPattern.test(readme)) throw new Error("README Thirukkural markers are missing");
readme = readme.replace(kuralPattern, dailyKural);
readme = readme
  .replace(/(generated\/thirukural-(?:dark|light)\.svg)(?:\?v=[^"']*)?/g, `$1?v=${todayInIndia}`)
  .replace(/(generated\/debugger-(?:dark|light)\.svg)(?:\?v=[^"']*)?/g, `$1?v=${stats.generatedAt.slice(0, 10)}`);
await writeFile("README.md", readme);
console.log({ ...stats, days: stats.days.length });
