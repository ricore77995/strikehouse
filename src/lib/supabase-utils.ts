export const handleSupabaseError = (error: any, operation: string): string => {
  console.error(`[Supabase Error] ${operation}:`, error);

  // RLS policy violation
  if (error.code === '42501' || error.message?.includes('permission denied')) {
    return 'Permissão negada. Você não tem acesso para realizar esta operação. Contate o administrador.';
  }

  // Check constraint violation
  if (error.code === '23514') {
    const match = error.message?.match(/constraint "(.+?)"/);
    const constraint = match ? match[1] : '';
    return `Dados inválidos (${constraint}). Verifique os valores informados.`;
  }

  // Foreign key violation
  if (error.code === '23503') {
    return 'Registro relacionado não encontrado. Verifique os dados e tente novamente.';
  }

  // Unique constraint violation
  if (error.code === '23505') {
    return 'Este registro já existe. Verifique se não há duplicação.';
  }

  // Not null violation
  if (error.code === '23502') {
    return 'Campos obrigatórios não preenchidos. Complete todos os dados necessários.';
  }

  // Generic fallback
  return `Erro ao ${operation}: ${error.message || 'Erro desconhecido'}`;
};

export const isRLSError = (error: any): boolean => {
  return error?.code === '42501' || error?.message?.includes('permission denied');
};

export const isConstraintError = (error: any): boolean => {
  return error?.code?.startsWith('23');
};
