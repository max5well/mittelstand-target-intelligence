"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const financials = [
  { year: "2021", revenue: 34.8, ebitda: 4.2, employees: 142 },
  { year: "2022", revenue: 39.1, ebitda: 5.1, employees: 158 },
  { year: "2023", revenue: 46.7, ebitda: 7.2, employees: 174 },
  { year: "2024", revenue: 54.2, ebitda: 10.0, employees: 191 },
];

export function FinancialChart() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-64 rounded-lg border border-[#e1ded6] bg-white p-4">
        <p className="mb-4 text-xs font-semibold">Revenue & EBITDA · €m</p>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={financials}>
            <CartesianGrid vertical={false} stroke="#eeeae2" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Bar dataKey="revenue" fill="#1d6f5d" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ebitda" fill="#6fd1b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-64 rounded-lg border border-[#e1ded6] bg-white p-4">
        <p className="mb-4 text-xs font-semibold">Reported employees</p>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={financials}>
            <CartesianGrid vertical={false} stroke="#eeeae2" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Line
              type="monotone"
              dataKey="employees"
              stroke="#1d6f5d"
              strokeWidth={2}
              dot={{ fill: "#1d6f5d", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
