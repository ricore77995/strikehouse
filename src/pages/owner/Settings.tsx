import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Settings, Bell, Clock, DollarSign, Save, Building, Mail, MessageSquare } from 'lucide-react';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    // Business Info
    gymName: 'Strikers House',
    gymEmail: 'info@strikershouse.pt',
    gymPhone: '+351 912 345 678',
    gymAddress: 'Rua da Luta, 123 - Lisboa',
    
    // Operating Hours
    openTime: '07:00',
    closeTime: '22:00',
    weekendOpenTime: '09:00',
    weekendCloseTime: '18:00',
    
    // Notifications
    emailReminders: true,
    reminderDaysBefore: 3,
    autoRemindOverdue: true,
    overdueReminderFrequency: 7,
    
    // Financial
    defaultPaymentDays: 5,
    gracePeriodDays: 3,
    lateFeePercent: 0,
    
    // Rentals
    minRentalDuration: 60,
    maxAdvanceBookingDays: 30,
    cancellationHours: 24,
  });

  const handleSave = () => {
    // In a real app, this would save to a settings table
    localStorage.setItem('gym_settings', JSON.stringify(settings));
    toast.success('Configurações guardadas com sucesso!');
  };

  const handleTestEmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Precisa estar autenticado');
        return;
      }

      const response = await supabase.functions.invoke('send-notification', {
        body: {
          type: 'WELCOME',
          recipientEmail: session.user.email,
          recipientName: 'Teste',
        },
      });

      if (response.error) throw response.error;
      toast.success('Email de teste enviado!');
    } catch (error: any) {
      toast.error('Erro ao enviar email: ' + error.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-accent" />
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wider">Configurações</h1>
              <p className="text-muted-foreground text-sm">Configurações gerais do sistema</p>
            </div>
          </div>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>

        <Tabs defaultValue="business" className="space-y-4">
          <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
            <TabsTrigger value="business" className="gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Negócio</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Horários</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <Card>
              <CardHeader>
                <CardTitle className="uppercase tracking-wider text-sm">Informações do Negócio</CardTitle>
                <CardDescription>Dados gerais da academia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gymName">Nome da Academia</Label>
                    <Input
                      id="gymName"
                      value={settings.gymName}
                      onChange={(e) => setSettings({ ...settings, gymName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gymEmail">Email</Label>
                    <Input
                      id="gymEmail"
                      type="email"
                      value={settings.gymEmail}
                      onChange={(e) => setSettings({ ...settings, gymEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gymPhone">Telefone</Label>
                    <Input
                      id="gymPhone"
                      value={settings.gymPhone}
                      onChange={(e) => setSettings({ ...settings, gymPhone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gymAddress">Morada</Label>
                    <Input
                      id="gymAddress"
                      value={settings.gymAddress}
                      onChange={(e) => setSettings({ ...settings, gymAddress: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle className="uppercase tracking-wider text-sm">Horário de Funcionamento</CardTitle>
                <CardDescription>Define os horários de abertura e fecho</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-4">Segunda a Sexta</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="openTime">Abertura</Label>
                      <Input
                        id="openTime"
                        type="time"
                        value={settings.openTime}
                        onChange={(e) => setSettings({ ...settings, openTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="closeTime">Fecho</Label>
                      <Input
                        id="closeTime"
                        type="time"
                        value={settings.closeTime}
                        onChange={(e) => setSettings({ ...settings, closeTime: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="text-sm font-medium mb-4">Fins de Semana</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="weekendOpenTime">Abertura</Label>
                      <Input
                        id="weekendOpenTime"
                        type="time"
                        value={settings.weekendOpenTime}
                        onChange={(e) => setSettings({ ...settings, weekendOpenTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weekendCloseTime">Fecho</Label>
                      <Input
                        id="weekendCloseTime"
                        type="time"
                        value={settings.weekendCloseTime}
                        onChange={(e) => setSettings({ ...settings, weekendCloseTime: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Notificações por Email
                  </CardTitle>
                  <CardDescription>Configure os lembretes automáticos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Lembretes de Renovação</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar email quando o plano está a vencer
                      </p>
                    </div>
                    <Switch
                      checked={settings.emailReminders}
                      onCheckedChange={(checked) => setSettings({ ...settings, emailReminders: checked })}
                    />
                  </div>

                  {settings.emailReminders && (
                    <div className="space-y-2 pl-4 border-l-2 border-accent">
                      <Label htmlFor="reminderDays">Dias antes do vencimento</Label>
                      <Input
                        id="reminderDays"
                        type="number"
                        min={1}
                        max={30}
                        className="w-24"
                        value={settings.reminderDaysBefore}
                        onChange={(e) => setSettings({ ...settings, reminderDaysBefore: parseInt(e.target.value) })}
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Cobranças Automáticas</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar lembretes para membros em atraso
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoRemindOverdue}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoRemindOverdue: checked })}
                    />
                  </div>

                  {settings.autoRemindOverdue && (
                    <div className="space-y-2 pl-4 border-l-2 border-accent">
                      <Label htmlFor="overdueFreq">Frequência (dias)</Label>
                      <Input
                        id="overdueFreq"
                        type="number"
                        min={1}
                        max={30}
                        className="w-24"
                        value={settings.overdueReminderFrequency}
                        onChange={(e) => setSettings({ ...settings, overdueReminderFrequency: parseInt(e.target.value) })}
                      />
                    </div>
                  )}

                  <Separator />

                  <div>
                    <Button variant="outline" onClick={handleTestEmail} className="gap-2">
                      <Mail className="h-4 w-4" />
                      Enviar Email de Teste
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Envia um email de boas-vindas para o seu email logado
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </CardTitle>
                  <CardDescription>Integração com WhatsApp (links diretos)</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    O sistema utiliza links diretos do WhatsApp (wa.me) para enviar mensagens.
                    Não é necessária configuração adicional.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="financial">
            <Card>
              <CardHeader>
                <CardTitle className="uppercase tracking-wider text-sm">Configurações Financeiras</CardTitle>
                <CardDescription>Regras de pagamento e cobranças</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="paymentDays">Dias para pagamento</Label>
                    <Input
                      id="paymentDays"
                      type="number"
                      min={1}
                      max={30}
                      value={settings.defaultPaymentDays}
                      onChange={(e) => setSettings({ ...settings, defaultPaymentDays: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Prazo para pagamento após emissão
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gracePeriod">Período de tolerância (dias)</Label>
                    <Input
                      id="gracePeriod"
                      type="number"
                      min={0}
                      max={15}
                      value={settings.gracePeriodDays}
                      onChange={(e) => setSettings({ ...settings, gracePeriodDays: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Dias extras antes de bloquear acesso
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="lateFee">Taxa de atraso (%)</Label>
                  <Input
                    id="lateFee"
                    type="number"
                    min={0}
                    max={20}
                    className="w-24"
                    value={settings.lateFeePercent}
                    onChange={(e) => setSettings({ ...settings, lateFeePercent: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentagem a adicionar em pagamentos atrasados (0 = sem taxa)
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-4">Configurações de Rentals</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="minRental">Duração mínima (min)</Label>
                      <Input
                        id="minRental"
                        type="number"
                        min={30}
                        max={180}
                        step={30}
                        value={settings.minRentalDuration}
                        onChange={(e) => setSettings({ ...settings, minRentalDuration: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxAdvance">Antecedência máx (dias)</Label>
                      <Input
                        id="maxAdvance"
                        type="number"
                        min={7}
                        max={90}
                        value={settings.maxAdvanceBookingDays}
                        onChange={(e) => setSettings({ ...settings, maxAdvanceBookingDays: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cancellation">Cancelamento (horas)</Label>
                      <Input
                        id="cancellation"
                        type="number"
                        min={1}
                        max={72}
                        value={settings.cancellationHours}
                        onChange={(e) => setSettings({ ...settings, cancellationHours: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
