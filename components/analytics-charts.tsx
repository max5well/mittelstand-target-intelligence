"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const discovery = [
  { day: "21 Aug", value: 31 },
  { day: "22 Aug", value: 38 },
  { day: "23 Aug", value: 22 },
  { day: "24 Aug", value: 44 },
  { day: "25 Aug", value: 35 },
  { day: "26 Aug", value: 40 },
  { day: "27 Aug", value: 41 },
];
const funnel = [
  { name: "Erfasst", value: 48, fill: "#18342d" },
  { name: "Geprüft", value: 31, fill: "#226551" },
  { name: "Auswahlliste", value: 12, fill: "#2b9375" },
  { name: "Dialog", value: 6, fill: "#4bc5a5" },
  { name: "Due Diligence", value: 2, fill: "#8be0c8" },
];
const ownership = [
  { name: "Familiengeführt", value: 30 },
  { name: "Inhabergeführt", value: 24 },
  { name: "Gründergeführt", value: 17 },
  { name: "Holding", value: 13 },
  { name: "Konzern", value: 10 },
  { name: "PE-finanziert", value: 6 },
];
const colors = [
  "#18342d",
  "#25624f",
  "#2f8d72",
  "#4bb398",
  "#78cdb6",
  "#a3ded0",
];

export function AnalyticsCharts() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Chart title="Suchtrend" subtitle="Neue eindeutige Unternehmen pro Tag">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={discovery}>
            <CartesianGrid vertical={false} stroke="#eeeae2" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Bar dataKey="value" fill="#27886d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Chart>
      <Chart
        title="Pipeline-Trichter"
        subtitle="Umwandlungsbasis: 48 erfasste Unternehmen"
      >
        <ResponsiveContainer width="100%" height={250}>
          <FunnelChart>
            <Tooltip />
            <Funnel dataKey="value" data={funnel} isAnimationActive={false}>
              <LabelList
                position="right"
                fill="#34413d"
                stroke="none"
                dataKey="name"
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </Chart>
      <Chart
        title="Eigentümerstruktur"
        subtitle="48 klassifizierte Unternehmen"
      >
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={ownership}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
            >
              {ownership.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {ownership.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: colors[index] }}
              />
              {item.name} · {item.value}%
            </div>
          ))}
        </div>
      </Chart>
      <Chart
        title="Datenabdeckung"
        subtitle="Anteil von 48 freigegebenen Unternehmen"
      >
        <div className="space-y-5 pt-5">
          {[
            ["Website", 93],
            ["Finanzdaten", 82],
            ["EBITDA", 63],
            ["Eigentümer", 71],
            ["Koordinaten", 98],
            ["Apollo-Abgleich", 54],
            ["Web-Anreicherung", 46],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="mb-2 flex justify-between text-xs">
                <span>{label}</span>
                <span className="tabular-nums">{value}%</span>
              </div>
              <div className="h-2 rounded bg-[#e7e4dd]">
                <div
                  className="h-full rounded bg-[#2b9275]"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Chart>
    </div>
  );
}

function Chart({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-[#75807c]">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
