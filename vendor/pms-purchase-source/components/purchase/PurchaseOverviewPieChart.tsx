"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const PIE_COLORS = ["#64748b", "#3b82f6", "#22c55e"];
const PIE_OUTER_RADIUS = 88;
const LABEL_RADIUS_OFFSET = 28;
const MIN_LABEL_GAP = 22;
const CHART_HEIGHT = 280;

type PieSlice = {
  name: string;
  value: number;
  fill: string;
  label: string;
};

type PieLabelLayout = {
  name: string;
  text: string;
  x: number;
  y: number;
  isLeft: boolean;
  anchorX: number;
  anchorY: number;
};

function computePieLabelLayouts(
  slices: PieSlice[],
  cx: number,
  cy: number,
  outerRadius: number,
  startAngle = 0,
  endAngle = 360
): PieLabelLayout[] {
  const RADIAN = Math.PI / 180;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const span = endAngle - startAngle;
  let cursor = startAngle;

  const raw = slices.map((slice) => {
    const sweep = (slice.value / total) * span;
    const midAngle = cursor + sweep / 2;
    cursor += sweep;

    const anchorR = outerRadius + 6;
    const anchorX = cx + anchorR * Math.cos(-midAngle * RADIAN);
    const anchorY = cy + anchorR * Math.sin(-midAngle * RADIAN);

    const labelR = outerRadius + LABEL_RADIUS_OFFSET;
    const x = cx + labelR * Math.cos(-midAngle * RADIAN);
    const y = cy + labelR * Math.sin(-midAngle * RADIAN);

    return {
      name: slice.name,
      text: `${slice.name}: ${slice.label}`,
      x,
      y,
      isLeft: x < cx,
      anchorX,
      anchorY,
    };
  });

  const spreadGroup = (items: PieLabelLayout[]) => {
    if (items.length <= 1) return items;
    const sorted = [...items].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].y - sorted[i - 1].y < MIN_LABEL_GAP) {
        sorted[i].y = sorted[i - 1].y + MIN_LABEL_GAP;
      }
    }
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (sorted[i + 1].y - sorted[i].y < MIN_LABEL_GAP) {
        sorted[i].y = sorted[i + 1].y - MIN_LABEL_GAP;
      }
    }
    return sorted;
  };

  return [
    ...spreadGroup(raw.filter((item) => item.isLeft)),
    ...spreadGroup(raw.filter((item) => !item.isLeft)),
  ];
}

export function PurchaseOverviewPieChart({
  totalRequisitions,
  totalPurchaseOrders,
  totalInvoices,
}: {
  totalRequisitions: number;
  totalPurchaseOrders: number;
  totalInvoices: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => setChartWidth(node.getBoundingClientRect().width);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo<PieSlice[]>(
    () =>
      [
        {
          name: "Requisitions",
          value: Math.max(0, totalRequisitions),
          fill: PIE_COLORS[0],
          label: String(totalRequisitions),
        },
        {
          name: "Purchase Orders",
          value: Math.max(0, totalPurchaseOrders),
          fill: PIE_COLORS[1],
          label: String(totalPurchaseOrders),
        },
        {
          name: "Invoices",
          value: Math.max(0, totalInvoices),
          fill: PIE_COLORS[2],
          label: String(totalInvoices),
        },
      ].filter((d) => d.value > 0),
    [totalRequisitions, totalPurchaseOrders, totalInvoices]
  );

  const cx = chartWidth > 0 ? chartWidth / 2 : 0;
  const cy = CHART_HEIGHT / 2;

  const labelLayouts = useMemo(() => {
    if (chartData.length === 0 || cx <= 0) return new Map<string, PieLabelLayout>();
    const layouts = computePieLabelLayouts(chartData, cx, cy, PIE_OUTER_RADIUS);
    return new Map(layouts.map((layout) => [layout.name, layout]));
  }, [chartData, cx, cy]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No data to display
      </div>
    );
  }

  const renderLabel = (name: string) => {
    const layout = labelLayouts.get(name);
    if (!layout) return null;

    const elbowX = layout.isLeft ? layout.x + 12 : layout.x - 12;

    return (
      <g key={`label-${name}`}>
        <polyline
          points={`${layout.anchorX},${layout.anchorY} ${elbowX},${layout.y} ${layout.x},${layout.y}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.35}
        />
        <text
          x={layout.x + (layout.isLeft ? -6 : 6)}
          y={layout.y}
          textAnchor={layout.isLeft ? "end" : "start"}
          dominantBaseline="middle"
          className="fill-foreground text-[11px] font-medium"
        >
          {layout.text}
        </text>
      </g>
    );
  };

  return (
    <div ref={containerRef} className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 28, right: 96, bottom: 28, left: 96 }}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={PIE_OUTER_RADIUS}
            paddingAngle={2}
            labelLine={false}
            label={false}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          {chartWidth > 0 ? (
            <g>{chartData.map((entry) => renderLabel(entry.name))}</g>
          ) : null}
          <Tooltip
            formatter={(value: number, _name: string, props: { payload?: PieSlice }) => [
              props.payload?.label ?? value,
              props.payload?.name ?? _name,
            ]}
          />
          <Legend wrapperStyle={{ paddingTop: "8px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
