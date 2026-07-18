// GA4 방문/반응 리포트 추출기.
// 인증: gcloud ADC(analytics.readonly 스코프). 최초 1회:
//   gcloud auth application-default login \
//     --scopes=openid,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/webmasters.readonly
// 실행: node scripts/ga-report.mjs   (결과: stdout + data/ga-report.md)
// 속성 자동탐색은 measurementId로 매칭. 필요시 GA_PROPERTY_ID=123456789 로 강제.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MEASUREMENT_ID = "G-25P5NRC49L";
const OUT = path.resolve(new URL("..", import.meta.url).pathname, "data/ga-report.md");

function token() {
  try {
    return execSync("gcloud auth application-default print-access-token", {
      encoding: "utf8",
    }).trim();
  } catch {
    fail(
      "ADC 토큰을 못 얻음. 먼저 로그인:\n" +
        "  gcloud auth application-default login --scopes=openid,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/webmasters.readonly",
    );
  }
}

function fail(msg) {
  console.error("\n[ga-report] " + msg + "\n");
  process.exit(1);
}

async function api(url, tok, body) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${tok}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = json?.error?.message || res.statusText;
    if (res.status === 403 && /scope/i.test(reason)) {
      fail(
        "스코프 부족(403). analytics.readonly 로 재로그인 필요:\n" +
          "  gcloud auth application-default login --scopes=openid,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/webmasters.readonly",
      );
    }
    fail(`${res.status} ${reason}`);
  }
  return json;
}

async function findProperty(tok) {
  if (process.env.GA_PROPERTY_ID) return process.env.GA_PROPERTY_ID;
  const sum = await api(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    tok,
  );
  const props = (sum.accountSummaries || []).flatMap((a) =>
    (a.propertySummaries || []).map((p) => p.property.split("/")[1]),
  );
  if (props.length === 0) fail("접근 가능한 GA4 속성이 없음.");
  for (const id of props) {
    const ds = await api(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${id}/dataStreams`,
      tok,
    );
    const hit = (ds.dataStreams || []).some(
      (s) => s.webStreamData?.measurementId === MEASUREMENT_ID,
    );
    if (hit) return id;
  }
  // measurementId 매칭 실패 시: 후보가 하나면 그걸로, 아니면 안내
  if (props.length === 1) return props[0];
  fail(`measurementId ${MEASUREMENT_ID} 속성 못 찾음. 후보: ${props.join(", ")}\n  GA_PROPERTY_ID=<id> 로 지정해 재실행.`);
}

function runReport(tok, propertyId, body) {
  return api(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    tok,
    body,
  );
}

const totals = (r) => {
  const names = r.metricHeaders?.map((h) => h.name) || [];
  const vals = r.rows?.[0]?.metricValues?.map((v) => v.value) || [];
  return Object.fromEntries(names.map((n, i) => [n, vals[i]]));
};

const rows = (r) =>
  (r.rows || []).map((row) => ({
    dim: row.dimensionValues.map((d) => d.value),
    met: row.metricValues.map((m) => m.value),
  }));

const METRICS = [
  "sessions",
  "totalUsers",
  "newUsers",
  "screenPageViews",
  "engagementRate",
  "averageSessionDuration",
].map((name) => ({ name }));

async function main() {
  const tok = token();
  const propertyId = await findProperty(tok);
  const ranges = { "28일": "28daysAgo", "90일": "90daysAgo" };
  const out = [`# GA 리포트 — choi2021 DevLog (property ${propertyId})`, `> 생성: ${new Date().toISOString().slice(0, 16).replace("T", " ")} · measurementId ${MEASUREMENT_ID}`, ""];

  for (const [label, start] of Object.entries(ranges)) {
    const dr = [{ startDate: start, endDate: "today" }];
    const overview = await runReport(tok, propertyId, { dateRanges: dr, metrics: METRICS });
    const t = totals(overview);
    out.push(`## 최근 ${label}`);
    out.push(
      `- 세션 ${t.sessions ?? 0} · 사용자 ${t.totalUsers ?? 0}(신규 ${t.newUsers ?? 0}) · 페이지뷰 ${t.screenPageViews ?? 0}`,
    );
    const eng = t.engagementRate ? (Number(t.engagementRate) * 100).toFixed(0) + "%" : "?";
    const dur = t.averageSessionDuration ? Number(t.averageSessionDuration).toFixed(0) + "s" : "?";
    out.push(`- 참여율 ${eng} · 평균 체류 ${dur}`);

    const top = await runReport(tok, propertyId, {
      dateRanges: dr,
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    });
    out.push("", "**인기 글 Top 10 (페이지뷰)**");
    rows(top).forEach((r, i) =>
      out.push(`${i + 1}. ${r.met[0]} — ${r.dim[1] || r.dim[0]}`),
    );

    const src = await runReport(tok, propertyId, {
      dateRanges: dr,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    });
    out.push("", "**유입 채널 (세션)**");
    rows(src).forEach((r) => out.push(`- ${r.dim[0]}: ${r.met[0]}`));
    out.push("");
  }

  const md = out.join("\n");
  fs.writeFileSync(OUT, md);
  console.log(md);
  console.error(`\n[ga-report] 저장: ${OUT}`);
}

main();
