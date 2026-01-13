import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, RefreshCw } from "lucide-react";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "email" | "captcha" | "newPassword";

const generateMathProblem = () => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  return { num1, num2, answer: num1 + num2 };
};

const ForgotPasswordDialog = ({ open, onOpenChange }: ForgotPasswordDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Captcha state
  const [mathProblem, setMathProblem] = useState(generateMathProblem());
  const [mathAnswer, setMathAnswer] = useState("");
  const [notRobotChecked, setNotRobotChecked] = useState(false);
  
  // New password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setStep("email");
      setEmail("");
      setMathProblem(generateMathProblem());
      setMathAnswer("");
      setNotRobotChecked(false);
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if email exists in profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .or(`first_name.ilike.%${email}%,last_name.ilike.%${email}%`)
        .limit(1);

      // Also check by querying with user_id through auth
      const { data: authCheck } = await supabase.functions.invoke("check-email-exists", {
        body: { email },
      });

      if (authCheck?.exists) {
        setMathProblem(generateMathProblem());
        setStep("captcha");
      } else {
        toast({
          title: "Email Not Found",
          description: "No account found with this email address.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to verify email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!notRobotChecked) {
      toast({
        title: "Verification Required",
        description: "Please confirm you are not a robot.",
        variant: "destructive",
      });
      return;
    }

    if (parseInt(mathAnswer) !== mathProblem.answer) {
      toast({
        title: "Incorrect Answer",
        description: "Please solve the math problem correctly.",
        variant: "destructive",
      });
      setMathProblem(generateMathProblem());
      setMathAnswer("");
      return;
    }

    setStep("newPassword");
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { email, newPassword },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Password Reset Successful",
          description: "Your password has been updated. You can now log in.",
        });
        onOpenChange(false);
      } else {
        throw new Error(data?.error || "Failed to reset password");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshMathProblem = () => {
    setMathProblem(generateMathProblem());
    setMathAnswer("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "email" && "Forgot Password"}
            {step === "captcha" && "Security Verification"}
            {step === "newPassword" && "Set New Password"}
          </DialogTitle>
          <DialogDescription>
            {step === "email" && "Enter your email address to reset your password."}
            {step === "captcha" && "Please complete the verification below."}
            {step === "newPassword" && "Create a new password for your account."}
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Checking..." : "Continue"}
            </Button>
          </form>
        )}

        {step === "captcha" && (
          <form onSubmit={handleCaptchaSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Solve this math problem</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-muted rounded-md text-center font-mono text-lg">
                  {mathProblem.num1} + {mathProblem.num2} = ?
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={refreshMathProblem}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <Input
                type="number"
                placeholder="Enter your answer"
                value={mathAnswer}
                onChange={(e) => setMathAnswer(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center space-x-2 p-4 border rounded-md bg-muted/50">
              <Checkbox
                id="not-robot"
                checked={notRobotChecked}
                onCheckedChange={(checked) => setNotRobotChecked(checked as boolean)}
              />
              <Label htmlFor="not-robot" className="cursor-pointer">
                I'm not a robot
              </Label>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("email")}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1">
                Verify
              </Button>
            </div>
          </form>
        )}

        {step === "newPassword" && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("captcha")}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordDialog;
