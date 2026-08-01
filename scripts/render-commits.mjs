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
  const panel = dark ? "#111820" : "#e8e9e5";
  const accent = dark ? "#7df9ff" : "#007d8a";
  const cell = 7;
  const gap = 3;
  const gridX = 51;
  const gridY = 357;
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
    const height = peak ? Math.max(2, Math.round((day.contributionCount / peak) * 76)) : 2;
    return `<rect x="${51 + i * 19}" y="${325 - height}" width="12" height="${height}" rx="2" fill="${accent}" opacity="${day.contributionCount ? ".9" : ".16"}"><title>${day.date}: ${day.contributionCount}</title></rect>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="450" viewBox="0 0 1000 450" role="img" aria-labelledby="title desc">
  <title id="title">${esc(login)} — live commit dashboard</title>
  <desc id="desc">A dashboard generated daily from one year of GitHub activity.</desc>
  <metadata>${esc(JSON.stringify(stats))}</metadata>
  <!-- Inspect: curl -sL https://raw.githubusercontent.com/${esc(login)}/${esc(login)}/main/generated/commit-page-${theme}.svg -->
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="${accent}" opacity=".045"/></pattern>
  </defs>
  <rect width="1000" height="450" rx="12" fill="${paper}"/>
  <rect width="1000" height="450" rx="12" fill="url(#grid)"/>
  <rect x="22" y="22" width="956" height="406" rx="9" fill="none" stroke="${quiet}" opacity=".35"/>
  <circle cx="48" cy="54" r="5" fill="${accent}"/><circle cx="66" cy="54" r="5" fill="${quiet}" opacity=".35"/><circle cx="84" cy="54" r="5" fill="${quiet}" opacity=".35"/>
  <text x="110" y="60" font-family="ui-monospace,monospace" font-size="14" font-weight="700" letter-spacing="2" fill="${ink}">ACTIVITY://LIVE</text>
  <text x="951" y="60" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="${quiet}">${esc(stats.period.from)} → ${esc(stats.period.to)}</text>
  <rect x="38" y="92" width="214" height="94" rx="7" fill="${panel}" stroke="${accent}" opacity=".95"/>
  <rect x="267" y="92" width="214" height="94" rx="7" fill="${panel}"/>
  <rect x="496" y="92" width="214" height="94" rx="7" fill="${panel}"/>
  <rect x="725" y="92" width="237" height="94" rx="7" fill="${panel}"/>
  <text x="55" y="119" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">PUBLIC COMMITS / 365D</text><text x="54" y="165" font-family="ui-monospace,monospace" font-size="40" font-weight="800" fill="${accent}">${commits}</text>
  <text x="284" y="119" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">CONTRIBUTIONS</text><text x="283" y="165" font-family="ui-monospace,monospace" font-size="40" font-weight="800" fill="${ink}">${calendar.totalContributions}</text>
  <text x="513" y="119" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">CURRENT STREAK</text><text x="512" y="165" font-family="ui-monospace,monospace" font-size="40" font-weight="800" fill="${ink}">${stats.currentStreak}<tspan font-size="15"> DAYS</tspan></text>
  <text x="742" y="119" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">ACTIVE DAYS</text><text x="741" y="165" font-family="ui-monospace,monospace" font-size="40" font-weight="800" fill="${ink}">${active.length}</text>
  <text x="49" y="220" font-family="ui-monospace,monospace" font-size="11" letter-spacing="2" fill="${quiet}">30-DAY SIGNAL</text>
  ${bars}
  <path d="M38 337H637" stroke="${quiet}" opacity=".25"/>
  <text x="49" y="349" font-family="ui-monospace,monospace" font-size="9" letter-spacing="2" fill="${quiet}">365-DAY HEATMAP</text>
  ${cells}
  <rect x="672" y="210" width="290" height="197" rx="7" fill="${panel}"/>
  <text x="696" y="243" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">WINDOW SUMMARY</text>
  <text x="696" y="282" font-family="ui-monospace,monospace" font-size="14" fill="${ink}">last 7 days</text><text x="936" y="282" text-anchor="end" font-family="ui-monospace,monospace" font-size="18" font-weight="700" fill="${accent}">${recent7}</text>
  <text x="696" y="322" font-family="ui-monospace,monospace" font-size="14" fill="${ink}">last 30 days</text><text x="936" y="322" text-anchor="end" font-family="ui-monospace,monospace" font-size="18" font-weight="700" fill="${accent}">${recent30}</text>
  <text x="696" y="362" font-family="ui-monospace,monospace" font-size="14" fill="${ink}">peak day</text><text x="936" y="362" text-anchor="end" font-family="ui-monospace,monospace" font-size="18" font-weight="700" fill="${accent}">${peak}</text>
  <circle cx="697" cy="389" r="3" fill="${accent}"/><text x="710" y="393" font-family="ui-monospace,monospace" font-size="10" fill="${quiet}">generated ${esc(stats.generatedAt.slice(0, 10))}</text>
</svg>`;
}

await mkdir("generated", { recursive: true });
await Promise.all([
  writeFile("generated/commit-page-dark.svg", render("dark")),
  writeFile("generated/commit-page-light.svg", render("light")),
  writeFile("generated/activity.json", `${JSON.stringify(stats, null, 2)}\n`),
]);
console.log(stats);
