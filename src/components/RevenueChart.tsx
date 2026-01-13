import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data = [
  { month: "Jan", revenue: 45000, expenses: 28000, profit: 17000 },
  { month: "Feb", revenue: 48000, expenses: 30000, profit: 18000 },
  { month: "Mar", revenue: 52000, expenses: 32000, profit: 20000 },
  { month: "Apr", revenue: 55000, expenses: 34000, profit: 21000 },
  { month: "May", revenue: 56000, expenses: 35000, profit: 21000 },
  { month: "Jun", revenue: 58000, expenses: 36000, profit: 22000 },
];

export const RevenueChart = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Overview</CardTitle>
        <CardDescription>Monthly revenue, expenses, and profit</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
            <Bar 
              dataKey="revenue" 
              fill="hsl(var(--chart-1))" 
              name="Revenue"
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="expenses" 
              fill="hsl(var(--chart-2))" 
              name="Expenses"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
