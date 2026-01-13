import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Calendar, CreditCard, FileText, Send, Phone, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const Communications = () => {
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants-communications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          properties:property_id (name, address, city)
        `)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };
  // Select first tenant by default when data loads
  const activeTenant = selectedTenant || tenants[0];

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Communications</h1>

        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          {/* Tenants List */}
          <Card className="col-span-4 flex flex-col">
            <CardHeader>
              <div className="space-y-4">
                <Input placeholder="Search tenants..." />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">All</Button>
                  <Button variant="outline" size="sm">AI</Button>
                  <Button variant="outline" size="sm">WhatsApp</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading tenants...</div>
              ) : tenants.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No tenants found</div>
              ) : (
                tenants.map((tenant, index) => (
                  <div key={tenant.id}>
                    <div 
                      className={`p-4 hover:bg-accent cursor-pointer ${activeTenant?.id === tenant.id ? 'bg-accent' : ''}`}
                      onClick={() => setSelectedTenant(tenant)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium flex-shrink-0">
                          {getInitials(tenant.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <p className="font-semibold text-sm">{tenant.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {tenant.properties?.name || tenant.properties?.address}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{tenant.phone || "No phone"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{tenant.email}</span>
                          </div>
                          <Badge 
                            variant="outline" 
                            className="mt-2 bg-success/10 text-success border-success/20"
                          >
                            AI Active
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {index < tenants.length - 1 && <Separator />}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Chat Window */}
          <Card className="col-span-5 flex flex-col">
            <CardHeader className="border-b">
              {activeTenant ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                        {getInitials(activeTenant.name)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{activeTenant.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{activeTenant.email}</p>
                        <p className="text-xs text-muted-foreground">{activeTenant.phone || "No phone"}</p>
                      </div>
                    </div>
                    <Button variant="outline">Take Over</Button>
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm text-primary font-medium flex items-center gap-2">
                      🤖 AI is handling this conversation
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">89% automation rate</Badge>
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">Select a tenant to view conversation</div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-6 space-y-4">
              <div className="text-center text-muted-foreground py-8">
                <p>No messages yet</p>
                <p className="text-sm mt-2">Resend integration coming soon</p>
              </div>
            </CardContent>
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input placeholder="AI is handling this conversation..." disabled />
                <Button disabled>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                AI is actively monitoring and responding to this conversation. Take over to send manual messages.
              </p>
            </div>
          </Card>

          {/* Right Sidebar */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Tenant Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {activeTenant ? (
                <>
                  <div>
                    <p className="text-sm font-medium mb-2">{activeTenant.properties?.address || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">{activeTenant.properties?.city}</p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monthly Rent</p>
                      <p className="font-semibold">${activeTenant.monthly_rent?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Lease Ends</p>
                      <p className="font-semibold">{new Date(activeTenant.lease_end).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-1">Status</p>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">{activeTenant.status}</Badge>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-1">Balance</p>
                    <p className={`text-lg font-bold ${(activeTenant.balance || 0) > 0 ? 'text-destructive' : 'text-success'}`}>
                      ${(activeTenant.balance || 0).toLocaleString()}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-3">Quick Actions</p>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Wrench className="h-4 w-4" />
                        Create Work Order
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <CreditCard className="h-4 w-4" />
                        Send Payment Reminder
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <FileText className="h-4 w-4" />
                        Generate Report
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Calendar className="h-4 w-4" />
                        Schedule Inspection
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">Select a tenant to view details</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Communications;
