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
  <title id="title">${esc(login)}@github: debug contribution timeline</title>
  <desc id="desc">A playable Bash terminal debugger generated from one year of GitHub activity.</desc>
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
  <text x="45" y="49" font-family="ui-monospace,monospace" font-size="16" font-weight="700" fill="#39d353">$_</text>
  <text x="82" y="49" font-family="ui-monospace,monospace" font-size="12" fill="${quiet}">${esc(login)}@github:~ / GNU bash</text>
  <text x="955" y="49" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="${quiet}">${esc(stats.period.from)} → ${esc(stats.period.to)}</text>
  <text x="46" y="100" font-family="ui-monospace,monospace" font-size="13" fill="#39d353">${esc(login)}@github:~$ ./debug-timeline --scan</text><rect class="cursor" x="412" y="87" width="8" height="16" fill="#39d353"/>
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
const cacheKey = stats.generatedAt.replace(/\D/g, "").slice(0, 14);
readme = readme
  .replace(/(generated\/debugger-(?:dark|light)\.svg)(?:\?v=[^"']*)?/g, `$1?v=${cacheKey}`);
await writeFile("README.md", readme);
console.log({ ...stats, days: stats.days.length });
