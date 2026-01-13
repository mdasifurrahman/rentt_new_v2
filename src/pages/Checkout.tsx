import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, CreditCard, Lock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan") || "basic";
  const [isProcessing, setIsProcessing] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
    name: "",
    country: "Canada",
    postalCode: ""
  });

  const planDetails: Record<string, { name: string; price: number }> = {
    basic: { name: "Basic", price: 250 },
    standard: { name: "Standard", price: 550 },
    premium: { name: "Premium", price: 1050 }
  };

  const selectedPlan = planDetails[plan] || planDetails.basic;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Format card number with spaces
    if (name === "cardNumber") {
      const formatted = value.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
      setFormData(prev => ({ ...prev, [name]: formatted.slice(0, 19) }));
      return;
    }
    
    // Format expiry date
    if (name === "expiry") {
      const cleaned = value.replace(/\D/g, "");
      if (cleaned.length >= 2) {
        setFormData(prev => ({ ...prev, [name]: `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}` }));
      } else {
        setFormData(prev => ({ ...prev, [name]: cleaned }));
      }
      return;
    }
    
    // Limit CVC to 3-4 digits
    if (name === "cvc") {
      setFormData(prev => ({ ...prev, [name]: value.slice(0, 4) }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "Payment Successful!",
      description: "Your subscription has been activated. Welcome to Rentt AI!",
    });

    setIsProcessing(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Navigation */}
      <nav className="border-b border-border/20 bg-[#0a0a0a]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/home" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <ClipboardList className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-white">Rentt</span>
              <span className="text-xl font-bold text-muted-foreground">AI</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <Link 
            to="/pricing" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pricing
          </Link>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Order Summary */}
            <Card className="bg-[#151515] border-border/30 h-fit">
              <CardHeader>
                <CardTitle className="text-white">Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-border/30">
                    <div>
                      <p className="text-white font-medium">{selectedPlan.name} Plan</p>
                      <p className="text-sm text-muted-foreground">Monthly subscription</p>
                    </div>
                    <p className="text-white font-medium">${selectedPlan.price}/mo</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-white font-medium">Total</p>
                    <p className="text-2xl font-bold text-white">${selectedPlan.price}/mo</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You will be charged ${selectedPlan.price} monthly. Cancel anytime.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payment Form */}
            <Card className="bg-[#151515] border-border/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="bg-[#0a0a0a] border-border/30 text-white placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardNumber" className="text-white">Card Number</Label>
                    <Input
                      id="cardNumber"
                      name="cardNumber"
                      placeholder="4242 4242 4242 4242"
                      value={formData.cardNumber}
                      onChange={handleInputChange}
                      required
                      className="bg-[#0a0a0a] border-border/30 text-white placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry" className="text-white">Expiry Date</Label>
                      <Input
                        id="expiry"
                        name="expiry"
                        placeholder="MM/YY"
                        value={formData.expiry}
                        onChange={handleInputChange}
                        required
                        className="bg-[#0a0a0a] border-border/30 text-white placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvc" className="text-white">CVC</Label>
                      <Input
                        id="cvc"
                        name="cvc"
                        placeholder="123"
                        value={formData.cvc}
                        onChange={handleInputChange}
                        required
                        className="bg-[#0a0a0a] border-border/30 text-white placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">Name on Card</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="bg-[#0a0a0a] border-border/30 text-white placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-white">Country</Label>
                      <Input
                        id="country"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        required
                        className="bg-[#0a0a0a] border-border/30 text-white placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode" className="text-white">Postal Code</Label>
                      <Input
                        id="postalCode"
                        name="postalCode"
                        placeholder="A1A 1A1"
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        required
                        className="bg-[#0a0a0a] border-border/30 text-white placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full mt-6" 
                    size="lg"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      "Processing..."
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Pay ${selectedPlan.price}
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
                    <Lock className="h-3 w-3" />
                    <span>Secured by Stripe. Your payment info is encrypted.</span>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
