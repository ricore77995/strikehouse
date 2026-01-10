import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { RefreshCw, CheckCircle, XCircle, Clock, Play } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobLog {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  results: {
    expiredMembers?: number;
    completedRentals?: number;
    cancelledPayments?: number;
    transactionsCreated?: number;
    emailsSent?: number;
    expiringReminders?: number;
    rentalReminders?: number;
  } | null;
  error_message: string | null;
}

export default function JobLogs() {
  const [isRunning, setIsRunning] = useState(false);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["job-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as JobLog[];
    },
  });

  const runJobManually = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scheduled-jobs");
      
      if (error) throw error;
      
      toast.success("Job executado com sucesso!", {
        description: `Resultados: ${JSON.stringify(data.results)}`,
      });
      
      refetch();
    } catch (error: any) {
      toast.error("Erro ao executar job", {
        description: error.message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Sucesso
          </Badge>
        );
      case "ERROR":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      case "RUNNING":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Executando
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (started: string, completed: string | null) => {
    if (!completed) return "-";
    const start = new Date(started).getTime();
    const end = new Date(completed).getTime();
    const diff = end - start;
    
    if (diff < 1000) return `${diff}ms`;
    if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
    return `${(diff / 60000).toFixed(1)}min`;
  };

  const formatResults = (results: JobLog["results"]) => {
    if (!results) return "-";
    
    const items = [];
    if (results.expiredMembers) items.push(`${results.expiredMembers} expirados`);
    if (results.completedRentals) items.push(`${results.completedRentals} rentals`);
    if (results.cancelledPayments) items.push(`${results.cancelledPayments} pagamentos`);
    if (results.emailsSent) items.push(`${results.emailsSent} emails`);
    
    return items.length > 0 ? items.join(", ") : "Nenhuma ação";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Jobs Automáticos</h1>
            <p className="text-muted-foreground">
              Histórico de execuções dos jobs agendados
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              onClick={runJobManually}
              disabled={isRunning}
            >
              <Play className={`h-4 w-4 mr-2 ${isRunning ? "animate-pulse" : ""}`} />
              Executar Agora
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Execuções
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{logs?.length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sucesso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">
                {logs?.filter((l) => l.status === "SUCCESS").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Erros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-400">
                {logs?.filter((l) => l.status === "ERROR").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Última Execução
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">
                {logs?.[0]
                  ? format(new Date(logs[0].started_at), "dd/MM HH:mm", { locale: pt })
                  : "-"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Resultados</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma execução registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {format(new Date(log.started_at), "dd/MM/yyyy HH:mm:ss", {
                          locale: pt,
                        })}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        {formatDuration(log.started_at, log.completed_at)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {formatResults(log.results)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-red-400">
                        {log.error_message || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
