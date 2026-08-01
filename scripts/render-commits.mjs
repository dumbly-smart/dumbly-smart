import { mkdir, writeFile } from "node:fs/promises";

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
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[c]));

function render(theme) {
  const dark = theme === "dark";
  const ink = dark ? "#e8e6df" : "#111111";
  const paper = dark ? "#0c0d0f" : "#f3f0e8";
  const quiet = dark ? "#73777f" : "#77736a";
  const wash = dark ? "#24272d" : "#d6d1c5";
  const cell = 8;
  const gap = 3;
  const gridX = 43;
  const gridY = 385;
  const visible = days.slice(-371);
  const firstWeekday = visible[0]?.weekday || 0;
  const cells = visible.map((day, index) => {
    const n = index + firstWeekday;
    const x = gridX + Math.floor(n / 7) * (cell + gap);
    const y = gridY + (n % 7) * (cell + gap);
    const level = peak ? day.contributionCount / peak : 0;
    const opacity = day.contributionCount ? (0.28 + level * 0.72).toFixed(2) : "0.08";
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${ink}" opacity="${opacity}"><title>${day.date}: ${day.contributionCount}</title></rect>`;
  }).join("");

  const bars = days.slice(-30).map((day, i) => {
    const height = peak ? Math.max(1, Math.round((day.contributionCount / peak) * 92)) : 1;
    return `<rect x="${377 + i * 8}" y="${304 - height}" width="5" height="${height}" fill="${ink}"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="510" viewBox="0 0 700 510" role="img" aria-labelledby="title desc">
  <title id="title">${esc(login)} — commit page</title>
  <desc id="desc">A monochrome manga-like page generated from one year of GitHub contributions.</desc>
  <metadata>${esc(JSON.stringify(stats))}</metadata>
  <!-- Inspect: curl -sL https://raw.githubusercontent.com/${esc(login)}/${esc(login)}/main/generated/commit-page-${theme}.svg -->
  <defs>
    <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${ink}" opacity=".22"/></pattern>
    <pattern id="lines" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(19)"><line x1="0" y1="0" x2="0" y2="8" stroke="${ink}" stroke-width="2" opacity=".14"/></pattern>
  </defs>
  <rect width="700" height="510" fill="${paper}"/>
  <path d="M20 20H680V490H20Z M34 34V476H666V34Z" fill="${ink}" fill-rule="evenodd"/>
  <rect x="43" y="48" width="614" height="98" fill="url(#lines)" stroke="${ink}" stroke-width="3"/>
  <text x="58" y="87" font-family="ui-monospace,monospace" font-size="14" letter-spacing="3" fill="${quiet}">A YEAR, COMPILED DAILY</text>
  <text x="56" y="127" font-family="ui-monospace,monospace" font-size="32" font-weight="800" fill="${ink}">${esc(login)}</text>
  <rect x="43" y="161" width="305" height="184" fill="url(#dots)" stroke="${ink}" stroke-width="3"/>
  <path d="M43 289L168 181L230 264L348 186V345H43Z" fill="${wash}"/>
  <text x="59" y="199" font-family="ui-monospace,monospace" font-size="11" letter-spacing="2" fill="${quiet}">PUBLIC COMMITS / 365D</text>
  <text x="57" y="267" font-family="ui-monospace,monospace" font-size="70" font-weight="900" fill="${ink}">${commits}</text>
  <rect x="363" y="161" width="294" height="184" fill="none" stroke="${ink}" stroke-width="3"/>
  <text x="378" y="190" font-family="ui-monospace,monospace" font-size="11" letter-spacing="2" fill="${quiet}">LAST 30 DAYS / SIGNAL</text>
  ${bars}
  <text x="639" y="326" text-anchor="end" font-family="ui-monospace,monospace" font-size="12" fill="${quiet}">${recent30} EVENTS</text>
  <rect x="43" y="361" width="614" height="101" fill="none" stroke="${ink}" stroke-width="3"/>
  ${cells}
  <text x="641" y="453" text-anchor="end" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1" fill="${quiet}">STREAK ${stats.currentStreak}D · ACTIVE ${active.length}D · PEAK ${peak}</text>
  <path d="M25 112H38M25 120H38M662 378H675M662 386H675" stroke="${ink}" stroke-width="2"/>
</svg>`;
}

await mkdir("generated", { recursive: true });
await Promise.all([
  writeFile("generated/commit-page-dark.svg", render("dark")),
  writeFile("generated/commit-page-light.svg", render("light")),
  writeFile("generated/activity.json", `${JSON.stringify(stats, null, 2)}\n`),
]);
console.log(stats);
