"use client";
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const inr = (rupees: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);
const axis = { stroke: "var(--muted)", fontSize: 11 };
const tooltipStyle = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", fontSize: 12 };

export function ValueChart({ data, baseline }: { data: { label: string; rupees: number }[]; baseline?: number }) {
  const min = Math.min(...data.map((d) => d.rupees), baseline ?? Infinity);
  const max = Math.max(...data.map((d) => d.rupees), baseline ?? -Infinity);
  const pad = Math.max(1, (max - min) * 0.15);
  const up = data.length > 1 && data.at(-1)!.rupees >= data[0].rupees;
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="vfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis domain={[min - pad, max + pad]} tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => inr(v)} width={90} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => inr(Number(v))} />
        <Area type="monotone" dataKey="rupees" name="Portfolio value" stroke={color} strokeWidth={2} fill="url(#vfill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PriceChart({ data }: { data: { label: string; rupees: number }[] }) {
  const up = data.length > 1 && data.at(-1)!.rupees >= data[0].rupees;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis domain={["auto", "auto"]} tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => inr(v)} width={90} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => inr(Number(v))} />
        <Line type="linear" dataKey="rupees" name="Price" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const palette = ["#c9a35c", "#2bd17e", "#7f6df2", "#ff7a59", "#22c3d6", "#e05fa0", "#9bb547", "#f3a93b", "#b07cff", "#a8b3c7", "#6c7a96"];

export function AllocationChart({ data }: { data: { name: string; rupees: number }[] }) {
  const total = data.reduce((s, d) => s + d.rupees, 0) || 1;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="rupees" nameKey="name" innerRadius="58%" outerRadius="95%" paddingAngle={1} stroke="none">
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.name === "Cash" ? "var(--muted)" : palette[i % palette.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => inr(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.name === "Cash" ? "var(--muted)" : palette[i % palette.length] }} />
              {d.name}
            </span>
            <span className="num text-muted">{((d.rupees / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
