import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Search,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  Loader2,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  nome: string;
  preco_cents: number;
  categoria: string | null;
}

interface CartItem {
  id: string;
  productId: string | null;
  nome: string;
  preco_cents: number;
  quantidade: number;
}

interface Member {
  id: string;
  nome: string;
  telefone: string;
}

type PaymentMethod = 'DINHEIRO' | 'STRIPE';

const Sales = () => {
  const { staffId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
  const [customItem, setCustomItem] = useState({ nome: '', preco: '' });
  const [saleComplete, setSaleComplete] = useState(false);

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('ativo', true)
        .order('categoria')
        .order('nome');

      if (error) throw error;
      return data as Product[];
    },
  });

  // Search members
  const { data: memberResults } = useQuery({
    queryKey: ['member-search-sale', memberSearch],
    queryFn: async () => {
      if (!memberSearch.trim()) return [];
      const { data, error } = await supabase
        .from('members')
        .select('id, nome, telefone')
        .or(`nome.ilike.%${memberSearch}%,telefone.ilike.%${memberSearch}%`)
        .limit(5);
      if (error) throw error;
      return data as Member[];
    },
    enabled: memberSearch.length >= 2,
  });

  // Sale mutation
  const saleMutation = useMutation({
    mutationFn: async () => {
      if (!staffId || cart.length === 0) throw new Error('Dados incompletos');

      const total = cart.reduce((sum, item) => sum + item.preco_cents * item.quantidade, 0);

      // Create transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: 'PRODUTOS',
          amount_cents: total,
          payment_method: paymentMethod,
          member_id: selectedMember?.id || null,
          description: `Venda: ${cart.map(i => i.nome).join(', ')}`,
          created_by: staffId,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          total_cents: total,
          payment_method: paymentMethod,
          member_id: selectedMember?.id || null,
          transaction_id: transaction.id,
          created_by: staffId,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.productId,
        descricao: item.nome,
        quantidade: item.quantidade,
        preco_unit_cents: item.preco_cents,
        subtotal_cents: item.preco_cents * item.quantidade,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      return { total };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setSaleComplete(true);
    },
    onError: (error) => {
      console.error('Sale error:', error);
      toast({ title: 'Erro ao registrar venda', variant: 'destructive' });
    },
  });

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        id: crypto.randomUUID(),
        productId: product.id,
        nome: product.nome,
        preco_cents: product.preco_cents,
        quantidade: 1,
      }]);
    }
  };

  const addCustomItem = () => {
    if (!customItem.nome || !customItem.preco) return;
    const precoCents = Math.round(parseFloat(customItem.preco.replace(',', '.')) * 100);
    setCart([...cart, {
      id: crypto.randomUUID(),
      productId: null,
      nome: customItem.nome,
      preco_cents: precoCents,
      quantidade: 1,
    }]);
    setCustomItem({ nome: '', preco: '' });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantidade + delta;
        return newQty > 0 ? { ...item, quantidade: newQty } : item;
      }
      return item;
    }).filter(item => item.quantidade > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const total = cart.reduce((sum, item) => sum + item.preco_cents * item.quantidade, 0);

  const resetSale = () => {
    setCart([]);
    setSelectedMember(null);
    setMemberSearch('');
    setPaymentMethod('DINHEIRO');
    setSaleComplete(false);
  };

  const filteredProducts = products?.filter(p =>
    p.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Success screen
  if (saleComplete) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full bg-green-500/10 border-green-500/30">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl uppercase tracking-wider mb-2">Venda Registrada</h2>
              <p className="text-2xl font-bold text-green-500 mb-6">
                {formatPrice(total)}
              </p>
              <Button
                className="w-full bg-accent hover:bg-accent/90"
                onClick={resetSale}
              >
                Nova Venda
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl tracking-wider mb-1">VENDAS</h1>
          <p className="text-muted-foreground text-sm">
            Registrar venda de produtos
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Products */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary border-border"
              />
            </div>

            {/* Products Grid */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts?.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-3 bg-secondary hover:bg-secondary/80 rounded-lg text-left transition-colors"
                >
                  <p className="font-medium text-sm truncate">{product.nome}</p>
                  <p className="text-accent font-bold">{formatPrice(product.preco_cents)}</p>
                </button>
              ))}
            </div>

            {/* Custom Item */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="uppercase tracking-wider text-sm">Item Avulso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Descrição"
                    value={customItem.nome}
                    onChange={(e) => setCustomItem({ ...customItem, nome: e.target.value })}
                    className="bg-secondary border-border"
                  />
                  <Input
                    placeholder="Preço"
                    value={customItem.preco}
                    onChange={(e) => setCustomItem({ ...customItem, preco: e.target.value })}
                    className="bg-secondary border-border w-24"
                  />
                  <Button variant="outline" onClick={addCustomItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cart */}
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="uppercase tracking-wider text-base flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrinho
                  {cart.length > 0 && (
                    <Badge variant="secondary">{cart.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length > 0 ? (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-secondary rounded"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(item.preco_cents)} × {item.quantidade}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm">{item.quantidade}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Carrinho vazio
                  </p>
                )}

                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-xl font-bold text-accent">{formatPrice(total)}</span>
                  </div>

                  {/* Member (optional) */}
                  <div className="space-y-2 mb-4">
                    <Label className="text-xs">Associar a membro (opcional)</Label>
                    {selectedMember ? (
                      <div className="flex items-center justify-between p-2 bg-secondary rounded">
                        <span className="text-sm">{selectedMember.nome}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMember(null)}
                        >
                          Remover
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="Buscar membro..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="bg-secondary border-border text-sm"
                        />
                        {memberResults && memberResults.length > 0 && (
                          <div className="space-y-1">
                            {memberResults.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => {
                                  setSelectedMember(m);
                                  setMemberSearch('');
                                }}
                                className="w-full p-2 bg-secondary hover:bg-secondary/80 rounded text-left text-sm"
                              >
                                {m.nome}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2 mb-4">
                    <Label className="text-xs">Método de Pagamento</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'DINHEIRO', label: '💵 Dinheiro', icon: Banknote },
                        { value: 'STRIPE', label: '💳 Cartão', icon: CreditCard },
                      ].map((method) => {
                        const Icon = method.icon;
                        return (
                          <button
                            key={method.value}
                            onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                            className={cn(
                              'p-2 rounded border text-center transition-colors flex flex-col items-center gap-1',
                              paymentMethod === method.value
                                ? 'bg-accent/20 border-accent'
                                : 'bg-secondary border-transparent'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-xs">{method.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    className="w-full bg-accent hover:bg-accent/90"
                    disabled={cart.length === 0 || saleMutation.isPending}
                    onClick={() => saleMutation.mutate()}
                  >
                    {saleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Finalizar Venda
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Sales;
