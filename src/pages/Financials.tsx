import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Percent, Building2, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CashFlowChart } from "@/components/CashFlowChart";
import { Last24HoursActivity } from "@/components/Last24HoursActivity";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getUnitRevenue, getEffectiveUnitStatus } from "@/lib/unitStatus";

interface TenantInvoice {
  id: string;
  name: string;
  property: string;
  unit: string | null;
  rent: number;
  dueDate: string;
  balance: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
}

const Financials = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tenantInvoices, setTenantInvoices] = useState<TenantInvoice[]>([]);
  const [stats, setStats] = useState({
    totalPortfolioValue: 0,
    totalProperties: 0,
    monthlyRevenue: 0,
    expectedRevenue: 0,
    occupancyRate: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
  });

  useEffect(() => {
    fetchFinancialsData();

    const channel = supabase
      .channel('financials-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'units' },
        () => fetchFinancialsData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        () => fetchFinancialsData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => fetchFinancialsData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFinancialsData = async () => {
    try {
      setLoading(true);

      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("*");

      if (propertiesError) throw propertiesError;

      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, property_id, status, required_rent, current_lease_start, current_lease_end, incoming_lease_start, incoming_lease_end, current_tenant, incoming_tenant");

      if (unitsError) throw unitsError;

      // Fetch pending and in-progress maintenance requests
      const { data: maintenanceRequests, error: maintenanceError } = await supabase
        .from("maintenance_requests")
        .select("id, unit_id")
        .in("status", ["pending", "in_progress"]);

      if (maintenanceError) throw maintenanceError;
      
      // Create a set of unit IDs with active maintenance
      const unitsWithMaintenance = new Set(
        maintenanceRequests?.map(m => m.unit_id).filter(Boolean) || []
      );

      const { data: tenants, error: tenantsError } = await supabase
        .from("tenants")
        .select(`
          id, 
          name,
          property_id, 
          unit_id,
          monthly_rent, 
          status,
          balance,
          lease_start,
          lease_end,
          properties (name, address),
          units (unit_number)
        `);

      if (tenantsError) throw tenantsError;

      // Fetch payments for all tenants
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("tenant_id, amount, payment_date")
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      // Group payments by tenant_id, get most recent payment for each
      const latestPaymentByTenant: Record<string, { amount: number; date: string }> = {};
      payments?.forEach(payment => {
        if (!latestPaymentByTenant[payment.tenant_id]) {
          latestPaymentByTenant[payment.tenant_id] = {
            amount: Number(payment.amount),
            date: payment.payment_date,
          };
        }
      });

      // Build tenant invoices for payment collection status
      const currentDate = new Date();
      const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      const invoices: TenantInvoice[] = (tenants || [])
        .filter(t => t.status === 'active')
        .map(tenant => {
          const lastPayment = latestPaymentByTenant[tenant.id];
          const rent = Number(tenant.monthly_rent || 0);
          const balance = Number(tenant.balance || 0);
          
          // Determine payment status for current month
          let status: TenantInvoice['status'] = 'pending';
          if (lastPayment) {
            const paymentDate = new Date(lastPayment.date);
            const isCurrentMonth = paymentDate.getMonth() === currentDate.getMonth() && 
                                   paymentDate.getFullYear() === currentDate.getFullYear();
            if (isCurrentMonth) {
              if (lastPayment.amount >= rent) {
                status = 'paid';
              } else if (lastPayment.amount > 0) {
                status = 'partial';
              }
            }
          }
          
          // If past due date and not paid, mark as overdue
          if (status === 'pending' && currentDate.getDate() > 5) {
            status = 'overdue';
          }
          
          return {
            id: tenant.id,
            name: tenant.name,
            property: tenant.properties?.address || tenant.properties?.name || 'Unknown',
            unit: tenant.units?.unit_number || null,
            rent,
            dueDate: format(dueDate, 'MMM d, yyyy'),
            balance,
            lastPaymentDate: lastPayment?.date || null,
            lastPaymentAmount: lastPayment?.amount || null,
            status,
          };
        });
      
      setTenantInvoices(invoices);

      const totalPortfolioValue = properties?.reduce((sum, prop) => {
        const value = prop.current_value ? Number(prop.current_value) : Number(prop.purchase_price);
        return sum + value;
      }, 0) || 0;

      const totalProperties = properties?.length || 0;

      const propertiesWithUnits = new Set(units?.map(u => u.property_id) || []);

      // Calculate revenue using lease-based status (same as Dashboard)
      let monthlyRevenue = 0;
      let expectedRevenue = 0;

      units?.forEach(unit => {
        const hasActiveMaintenance = unitsWithMaintenance.has(unit.id);
        
        const unitRevenue = getUnitRevenue({
          required_rent: unit.required_rent,
          current_lease_start: unit.current_lease_start,
          current_lease_end: unit.current_lease_end,
          incoming_lease_start: unit.incoming_lease_start,
          incoming_lease_end: unit.incoming_lease_end,
          hasActiveMaintenance,
        });
        
        monthlyRevenue += unitRevenue.monthlyRevenue;
        expectedRevenue += unitRevenue.expectedRevenue;
      });

      // Add tenant rent for properties without units (single-family)
      tenants?.forEach(tenant => {
        if (!propertiesWithUnits.has(tenant.property_id)) {
          const rent = Number(tenant.monthly_rent || 0);
          
          // Check if tenant lease is active
          if (tenant.lease_start && tenant.lease_end) {
            const today = new Date();
            const leaseStart = new Date(tenant.lease_start);
            const leaseEnd = new Date(tenant.lease_end);
            
            if (today >= leaseStart && today <= leaseEnd) {
              monthlyRevenue += rent;
              expectedRevenue += rent;
            }
          }
        }
      });

      // Calculate occupancy based on effective lease status (same as Dashboard)
      const totalUnits = units?.length || 0;
      const occupiedUnits = units?.filter(unit => {
        const hasActiveMaintenance = unitsWithMaintenance.has(unit.id);
        const effectiveStatus = getEffectiveUnitStatus({
          current_tenant: unit.current_tenant,
          current_lease_start: unit.current_lease_start,
          current_lease_end: unit.current_lease_end,
          incoming_tenant: unit.incoming_tenant,
          incoming_lease_start: unit.incoming_lease_start,
          incoming_lease_end: unit.incoming_lease_end,
          status: unit.status,
          hasActiveMaintenance,
        });
        return effectiveStatus !== "vacant";
      }).length || 0;
      const vacantUnits = totalUnits - occupiedUnits;
      const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

      setStats({
        totalPortfolioValue,
        totalProperties,
        monthlyRevenue,
        expectedRevenue,
        occupancyRate,
        totalUnits,
        occupiedUnits,
        vacantUnits,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch financial data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Financial Management</h1>
            <p className="text-muted-foreground">Comprehensive financial overview with automated rent collection and deep insights</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/reports")}>Tax Documents</Button>
            <Button variant="outline" onClick={() => navigate("/reports")}>P&L Report</Button>
            <Button variant="outline" onClick={() => navigate("/reports")}>Owner Statements</Button>
            <Button onClick={() => navigate("/reports")}>Export All</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{loading ? "Loading..." : formatCurrency(stats.totalPortfolioValue)}</h3>
              <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
              <p className="text-xs text-success mt-1">↑ 12.5%</p>
              <p className="text-xs text-muted-foreground">{stats.totalProperties} {stats.totalProperties === 1 ? 'property' : 'properties'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{loading ? "Loading..." : `$${stats.monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</h3>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
              <p className="text-xs text-success mt-1">↑ 8.2%</p>
              <p className="text-xs text-muted-foreground">${stats.expectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Expected Value</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-chart-3/10">
                  <Users className="h-5 w-5 text-chart-3" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{loading ? "Loading..." : `${stats.occupancyRate.toFixed(1)}%`}</h3>
              <p className="text-sm text-muted-foreground">Occupancy Rate</p>
              <p className="text-xs text-success mt-1">↑ 2.1%</p>
              <p className="text-xs text-muted-foreground">{stats.occupiedUnits}/{stats.totalUnits} units</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">$32,400</h3>
              <p className="text-sm text-muted-foreground">Net Operating Income</p>
              <p className="text-xs text-success mt-1">71.7% margin</p>
              <p className="text-xs text-muted-foreground">After all operating expenses</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Collection Status */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment Collection Status
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {tenantInvoices.length} {tenantInvoices.length === 1 ? 'tenant' : 'tenants'} • ${tenantInvoices.reduce((sum, t) => sum + t.balance, 0).toLocaleString()} outstanding
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No active tenants found
                    </TableCell>
                  </TableRow>
                ) : (
                  tenantInvoices.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{tenant.property}</p>
                          {tenant.unit && (
                            <p className="text-xs text-muted-foreground">Unit {tenant.unit}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>${tenant.rent.toLocaleString()}</TableCell>
                      <TableCell>{tenant.dueDate}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            tenant.status === 'paid' 
                              ? "bg-success/10 text-success border-success/20"
                              : tenant.status === 'partial'
                              ? "bg-warning/10 text-warning border-warning/20"
                              : tenant.status === 'overdue'
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-muted/50 text-muted-foreground border-muted"
                          }
                        >
                          {tenant.status === 'paid' ? 'Paid' : 
                           tenant.status === 'partial' ? 'Partial' :
                           tenant.status === 'overdue' ? 'Overdue' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tenant.lastPaymentDate ? (
                          <div>
                            <p className="text-sm">${tenant.lastPaymentAmount?.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tenant.lastPaymentDate), 'MMM d, yyyy')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <p className={`font-medium ${
                          tenant.balance > 0 
                            ? "text-destructive" 
                            : tenant.balance < 0 
                            ? "text-success" 
                            : "text-muted-foreground"
                        }`}>
                          {tenant.balance < 0 ? '-' : ''}${Math.abs(tenant.balance).toLocaleString()}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">•••</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Cash Flow Analysis */}
        <div className="mb-8">
          <CashFlowChart />
        </div>

        {/* Automated Workflows */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Automated Workflows</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">4 active workflows • 532 total actions performed</p>
              </div>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">3-Day Payment Reminder</h4>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Daily check • Last: Nov 15, 7:35 PM • Next: Nov 16, 7:35 PM</p>
                <p className="text-xs text-muted-foreground mt-1">147 actions</p>
              </div>
              <Switch checked />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">Auto Late Fee Application</h4>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">After 5 days overdue • Last: Nov 14, 9:35 PM • Next: Nov 17, 9:35 PM</p>
                <p className="text-xs text-muted-foreground mt-1">23 actions</p>
              </div>
              <Switch checked />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">ACH Payment Processing</h4>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Every business day • Last: Nov 15, 1:35 PM • Next: Nov 16, 1:35 PM</p>
                <p className="text-xs text-muted-foreground mt-1">342 actions</p>
              </div>
              <Switch checked />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">Monthly Owner Reports</h4>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">1st of each month • Last: Nov 7, 9:35 PM • Next: Dec 7, 9:35 PM</p>
                <p className="text-xs text-muted-foreground mt-1">12 actions</p>
              </div>
              <Switch checked />
            </div>

            <Last24HoursActivity />
          </CardContent>
        </Card>

        {/* AI Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule E Generation</CardTitle>
              <p className="text-sm text-muted-foreground">Tax document automation</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Automatically generate Schedule E tax forms with all income and expense categories properly categorized.</p>
              <Button variant="outline" className="w-full">Generate Tax Documents</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cash Flow Forecasting</CardTitle>
              <p className="text-sm text-muted-foreground">Predictive financial planning</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">AI-powered cash flow predictions based on lease terms, historical data, and market trends.</p>
              <Button variant="outline" className="w-full">View Forecasting</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Expense Categorization</CardTitle>
              <p className="text-sm text-muted-foreground">Smart expense tracking</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Automatically categorize expenses for accurate reporting and tax preparation with AI assistance.</p>
              <Button variant="outline" className="w-full">Review Categories</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Financials;
