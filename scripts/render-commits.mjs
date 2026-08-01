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
  const accent = "#c43b2f";
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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="420" viewBox="0 0 1000 420" role="img" aria-labelledby="title desc">
  <title id="title">${esc(login)} commit data</title>
  <desc id="desc">One year of GitHub activity, updated daily.</desc>
  <metadata>${esc(JSON.stringify(stats))}</metadata>
  <rect width="1000" height="420" fill="${paper}"/>
  <path d="M28 28H972M28 392H972M28 28V392M972 28V392" stroke="${ink}" stroke-width="2"/>
  <text x="48" y="62" font-family="ui-monospace,monospace" font-size="11" letter-spacing="3" fill="${quiet}">GITHUB / LAST 365 DAYS</text>
  <text x="952" y="62" text-anchor="end" font-family="ui-monospace,monospace" font-size="11" fill="${quiet}">${esc(stats.period.from)} — ${esc(stats.period.to)}</text>
  <path d="M28 80H972M28 186H972M660 80V392" stroke="${ink}" opacity=".3"/>
  <text x="48" y="112" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">PUBLIC COMMITS</text>
  <text x="48" y="166" font-family="Georgia,serif" font-size="62" font-weight="700" fill="${ink}">${commits}</text>
  <text x="220" y="112" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">CONTRIBUTIONS</text><text x="220" y="163" font-family="Georgia,serif" font-size="46" fill="${ink}">${calendar.totalContributions}</text>
  <text x="390" y="112" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">STREAK</text><text x="390" y="163" font-family="Georgia,serif" font-size="46" fill="${ink}">${stats.currentStreak}<tspan font-family="ui-monospace,monospace" font-size="12"> days</tspan></text>
  <text x="525" y="112" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">ACTIVE DAYS</text><text x="525" y="163" font-family="Georgia,serif" font-size="46" fill="${ink}">${active.length}</text>
  <text x="48" y="215" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" fill="${quiet}">LAST 30 DAYS</text>
  ${bars}
  <path d="M48 337H638" stroke="${ink}" opacity=".25"/>
  <text x="49" y="351" font-family="ui-monospace,monospace" font-size="9" letter-spacing="2" fill="${quiet}">THE YEAR</text>
  ${cells}
  <text x="700" y="218" font-family="Georgia,serif" font-size="22" fill="${ink}">Recent</text>
  <text x="700" y="263" font-family="ui-monospace,monospace" font-size="12" fill="${quiet}">7 days</text><text x="936" y="263" text-anchor="end" font-family="Georgia,serif" font-size="26" fill="${ink}">${recent7}</text>
  <text x="700" y="310" font-family="ui-monospace,monospace" font-size="12" fill="${quiet}">30 days</text><text x="936" y="310" text-anchor="end" font-family="Georgia,serif" font-size="26" fill="${ink}">${recent30}</text>
  <text x="700" y="357" font-family="ui-monospace,monospace" font-size="12" fill="${quiet}">peak day</text><text x="936" y="357" text-anchor="end" font-family="Georgia,serif" font-size="26" fill="${accent}">${peak}</text>
</svg>`;
}

await mkdir("generated", { recursive: true });
await Promise.all([
  writeFile("generated/commit-page-dark.svg", render("dark")),
  writeFile("generated/commit-page-light.svg", render("light")),
  writeFile("generated/activity.json", `${JSON.stringify(stats, null, 2)}\n`),
]);

let readme = await readFile("README.md", "utf8");
const start = "<!-- ACTIVITY_DETAILS:START -->";
const end = "<!-- ACTIVITY_DETAILS:END -->";
const details = `${start}
<details>
<summary>Read the numbers</summary>
<br>

Over the past year, I made **${commits} public commits** across **${active.length} active days**. I have made **${recent7} contributions this week** and **${recent30} in the last 30 days**. My current streak is **${stats.currentStreak} ${stats.currentStreak === 1 ? "day" : "days"}**.

[Raw data](./generated/activity.json) · [Generator](./scripts/render-commits.mjs)

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
const englishLines = kural.english.split(";").map((line) => line.trim());
const wrapWords = (text, width = 92) => text.split(/\s+/).reduce((lines, word) => {
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
  const accent = "#c43b2f";
  const english = wrapWords(kural.english.replace(/;/g, "; "));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300" viewBox="0 0 1000 300" role="img" aria-labelledby="k-title k-desc">
  <title id="k-title">Thirukural of the day: Kural ${kural.number}</title>
  <desc id="k-desc">${esc(kural.tamil.join(" "))} ${esc(kural.english)}</desc>
  <rect width="1000" height="300" fill="${background}"/>
  <path d="M28 28H972V272H28Z" fill="none" stroke="${ink}" stroke-width="2"/>
  <path d="M790 28V272M28 76H972" stroke="${ink}" opacity=".35"/>
  <rect x="28" y="28" width="7" height="48" fill="${accent}"/>
  <text x="52" y="59" font-family="ui-monospace,monospace" font-size="11" letter-spacing="3" fill="${quiet}">THIRUKURAL OF THE DAY</text>
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
await writeFile("README.md", readme.replace(kuralPattern, dailyKural));
console.log(stats);
