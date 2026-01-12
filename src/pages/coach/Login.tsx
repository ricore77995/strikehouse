import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCoachAuth } from '@/hooks/useCoachAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, Mail, Dumbbell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(100),
});

const CoachLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, coach, loading, isAuthenticated } = useCoachAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    console.log('[CoachLogin] useEffect check:', { loading, isAuthenticated, coach: coach?.nome });
    if (!loading && isAuthenticated && coach) {
      console.log('[CoachLogin] Redirecting to dashboard...');
      navigate('/coach/dashboard', { replace: true });
    }
  }, [loading, isAuthenticated, coach, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        title: 'Erro de validação',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: 'Email ou senha incorretos',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // Redirect will happen via useEffect when coach data loads
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4">
            <div className="h-12 w-12 bg-orange-500 rounded-sm flex items-center justify-center">
              <Dumbbell className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl tracking-wider">ÁREA DO COACH</CardTitle>
          <CardDescription className="text-muted-foreground">
            Entre com suas credenciais para gerenciar seus rentals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm uppercase tracking-wider">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-secondary border-border"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm uppercase tracking-wider">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-secondary border-border"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white uppercase tracking-wider"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Login de Staff →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoachLogin;
