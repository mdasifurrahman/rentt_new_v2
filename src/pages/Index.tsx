import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { MaintenanceStatus } from "@/components/MaintenanceStatus";
import { QuickActions } from "@/components/QuickActions";
import { RecentActivity } from "@/components/RecentActivity";

import { Building2, DollarSign, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Filter, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUnitRevenue, getEffectiveUnitStatus } from "@/lib/unitStatus";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPortfolioValue: 0,
    totalProperties: 0,
    monthlyRevenue: 0,
    expectedRevenue: 0,
    occupancyRate: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    activeIssues: 0,
  });

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to real-time updates for units and maintenance requests
    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'units'
        },
        () => {
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_requests'
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch properties
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("*");

      if (propertiesError) throw propertiesError;

      // Fetch all units with required_rent and lease info
      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, property_id, status, required_rent, current_lease_start, current_lease_end, incoming_lease_start, incoming_lease_end, current_tenant, incoming_tenant");

      if (unitsError) throw unitsError;

      // Fetch all tenants with monthly_rent and lease info
      const { data: tenants, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, property_id, monthly_rent, status, lease_start, lease_end");

      if (tenantsError) throw tenantsError;

      // Fetch pending and in-progress maintenance requests
      const { data: maintenanceRequests, error: maintenanceError } = await supabase
        .from("maintenance_requests")
        .select("id, property_id, unit_id")
        .in("status", ["pending", "in_progress"]);

      if (maintenanceError) throw maintenanceError;
      
      // Create a set of unit IDs with active maintenance
      const unitsWithMaintenance = new Set(
        maintenanceRequests?.map(m => m.unit_id).filter(Boolean) || []
      );

      // Calculate Total Portfolio Value (sum of current_value or purchase_price as fallback)
      const totalPortfolioValue = properties?.reduce((sum, prop) => {
        const value = prop.current_value ? Number(prop.current_value) : Number(prop.purchase_price);
        return sum + value;
      }, 0) || 0;

      // Total Properties count
      const totalProperties = properties?.length || 0;

      // Get property IDs that have units
      const propertiesWithUnits = new Set(
        units?.map(u => u.property_id) || []
      );

      // Calculate revenue at unit level using dynamic lease-based status
      let monthlyRevenue = 0;
      let expectedRevenue = 0;

      // Calculate from units based on lease dates
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
      
      // Occupancy Rate (calculate based on effective status from lease dates)
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

      const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

      // Active Issues (pending and in-progress maintenance requests)
      const activeIssues = maintenanceRequests?.length || 0;

      setStats({
        totalPortfolioValue,
        totalProperties,
        monthlyRevenue,
        expectedRevenue,
        occupancyRate,
        totalUnits,
        occupiedUnits,
        activeIssues,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch dashboard data",
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
        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your property portfolio performance</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <Button onClick={() => navigate("/properties")} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Property
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Portfolio Value"
            value={loading ? "Loading..." : formatCurrency(stats.totalPortfolioValue)}
            change="12.5%"
            trend="up"
            subtitle={`${stats.totalProperties} ${stats.totalProperties === 1 ? 'property' : 'properties'}`}
            icon={Building2}
            iconColor="bg-primary"
            linkTo="/properties"
          />
          <StatCard
            title="Monthly Revenue"
            value={loading ? "Loading..." : `$${stats.monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change="8.2%"
            trend="up"
            subtitle={`$${stats.expectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Expected Value`}
            icon={DollarSign}
            iconColor="bg-success"
            linkTo="/financials"
          />
          <StatCard
            title="Occupancy Rate"
            value={loading ? "Loading..." : `${stats.occupancyRate.toFixed(1)}%`}
            change="2.1%"
            trend="up"
            subtitle={`${stats.occupiedUnits}/${stats.totalUnits} units`}
            icon={Users}
            iconColor="bg-chart-3"
            linkTo="/tenants"
          />
          <StatCard
            title="Active Issues"
            value={loading ? "..." : stats.activeIssues.toString()}
            change="25%"
            trend="down"
            subtitle="Pending & in-progress requests"
            icon={AlertTriangle}
            iconColor="bg-destructive"
            linkTo="/maintenance"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <div>
            <MaintenanceStatus />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <QuickActions />
          </div>
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
