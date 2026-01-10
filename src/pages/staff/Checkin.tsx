import { useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode, Search, UserPlus, Camera } from 'lucide-react';

const StaffCheckin = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [scanMode, setScanMode] = useState(false);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl tracking-wider mb-1">CHECK-IN</h1>
            <p className="text-muted-foreground text-sm">
              Registrar entrada de membros
            </p>
          </div>
          <Button variant="outline" className="uppercase tracking-wider text-xs">
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastro Rápido
          </Button>
        </div>

        {/* Scanner Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scanner QR Code
            </CardTitle>
            <CardDescription>
              Escaneie o QR code do membro ou busque manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scanMode ? (
              <div className="aspect-square max-w-md mx-auto bg-secondary rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                <div className="text-center">
                  <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Câmera será ativada aqui
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-4"
                    onClick={() => setScanMode(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Button
                  size="lg"
                  className="w-full max-w-md h-24 bg-accent hover:bg-accent/90 text-accent-foreground uppercase tracking-wider"
                  onClick={() => setScanMode(true)}
                >
                  <QrCode className="h-8 w-8 mr-3" />
                  Abrir Scanner
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Search */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
              <Search className="h-5 w-5" />
              Busca Manual
            </CardTitle>
            <CardDescription>
              Busque por nome ou telefone do membro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-secondary border-border"
              />
              <Button className="uppercase tracking-wider text-xs">
                Buscar
              </Button>
            </div>

            {/* Results will appear here */}
            <div className="min-h-[100px] flex items-center justify-center text-muted-foreground text-sm">
              Digite para buscar membros
            </div>
          </CardContent>
        </Card>

        {/* Recent Check-ins */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-base">
              Check-ins Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum check-in registrado hoje
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StaffCheckin;
