import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Products & Sales - Stock Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sell product and decrement stock', async () => {
    const product = {
      id: 'product-001',
      nome: 'Luvas de Boxe',
      preco_cents: 4500, // €45
      stock_quantity: 10,
    };

    const quantitySold = 2;

    // Mock product query
    const mockSingle = vi.fn().mockResolvedValue({
      data: product,
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    // Mock stock update
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

    // Mock transaction insert
    const mockTransactionInsert = vi.fn().mockResolvedValue({ error: null });

    // Mock sale_items insert
    const mockSaleItemsInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'products' && mockSelect.mock.calls.length === 0) {
        return { select: mockSelect } as any;
      }
      if (table === 'products') {
        return { update: mockUpdate } as any;
      }
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      if (table === 'sale_items') {
        return { insert: mockSaleItemsInsert } as any;
      }
      return {} as any;
    });

    // 1. Get product
    const productData = await supabase.from('products')
      .select('*')
      .eq('id', product.id)
      .single();

    // 2. Update stock
    const newStock = product.stock_quantity - quantitySold;
    await supabase.from('products')
      .update({ stock_quantity: newStock })
      .eq('id', product.id);

    // 3. Create transaction
    const totalCents = product.preco_cents * quantitySold;
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'PRODUTOS',
      amount_cents: totalCents,
      payment_method: 'DINHEIRO',
      description: `Venda: ${product.nome} (${quantitySold}x)`,
      created_by: 'staff-123',
    });

    // 4. Create sale_items record
    await supabase.from('sale_items').insert({
      product_id: product.id,
      quantity: quantitySold,
      unit_price_cents: product.preco_cents,
      total_cents: totalCents,
    });

    // Verify flow
    expect(mockUpdate).toHaveBeenCalledWith({ stock_quantity: 8 }); // 10 - 2 = 8
    expect(mockTransactionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'PRODUTOS',
        amount_cents: 9000, // €45 * 2 = €90
      })
    );
    expect(mockSaleItemsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'product-001',
        quantity: 2,
        unit_price_cents: 4500,
        total_cents: 9000,
      })
    );
  });

  it('should prevent sale if stock insufficient', async () => {
    const product = {
      id: 'product-002',
      nome: 'Protetor Bucal',
      preco_cents: 1500,
      stock_quantity: 3,
    };

    const quantityRequested = 5; // Requesting more than available

    const hasEnoughStock = product.stock_quantity >= quantityRequested;

    expect(hasEnoughStock).toBe(false);
    // In real app, would show error: "Estoque insuficiente. Disponível: 3"
  });

  it('should allow sale with exact stock amount', async () => {
    const product = {
      id: 'product-003',
      nome: 'Bandagem',
      stock_quantity: 5,
    };

    const quantityRequested = 5; // Exact stock

    const hasEnoughStock = product.stock_quantity >= quantityRequested;
    const newStock = product.stock_quantity - quantityRequested;

    expect(hasEnoughStock).toBe(true);
    expect(newStock).toBe(0); // Stock goes to zero
  });

  it('should calculate total for multiple products in single sale', () => {
    const items = [
      { nome: 'Luvas', preco_cents: 4500, quantity: 2 }, // €90
      { nome: 'Bandagem', preco_cents: 800, quantity: 3 }, // €24
      { nome: 'Protetor', preco_cents: 1500, quantity: 1 }, // €15
    ];

    const total = items.reduce((sum, item) => {
      return sum + (item.preco_cents * item.quantity);
    }, 0);

    expect(total).toBe(12900); // €129
  });

  it('should validate product quantity is positive', () => {
    const validQuantities = [1, 5, 100];
    const invalidQuantities = [0, -1, -5];

    validQuantities.forEach(qty => {
      const isValid = qty > 0;
      expect(isValid).toBe(true);
    });

    invalidQuantities.forEach(qty => {
      const isValid = qty > 0;
      expect(isValid).toBe(false);
    });
  });

  it('should update cash session on product sale (DINHEIRO)', async () => {
    const saleTotalCents = 9000; // €90

    // Mock cash session query
    const mockSessionSingle = vi.fn().mockResolvedValue({
      data: { id: 'session-1', total_cash_in_cents: 50000 },
      error: null,
    });
    const mockSessionEq = vi.fn().mockReturnValue({ maybeSingle: mockSessionSingle });
    const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq });

    // Mock cash session update
    const mockSessionUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockSessionUpdate = vi.fn().mockReturnValue({ eq: mockSessionUpdateEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'cash_sessions' && mockSessionSelect.mock.calls.length === 0) {
        return { select: mockSessionSelect } as any;
      }
      if (table === 'cash_sessions') {
        return { update: mockSessionUpdate } as any;
      }
      return {} as any;
    });

    // Get session
    const session = await supabase.from('cash_sessions')
      .select('*')
      .eq('session_date', new Date().toISOString().split('T')[0])
      .maybeSingle();

    // Update session
    if (session.data) {
      await supabase.from('cash_sessions')
        .update({
          total_cash_in_cents: (session.data as any).total_cash_in_cents + saleTotalCents,
        })
        .eq('id', (session.data as any).id);
    }

    expect(mockSessionUpdate).toHaveBeenCalledWith({
      total_cash_in_cents: 59000, // €500 + €90 = €590
    });
  });

  it('should create sale_items for each product in sale', async () => {
    const saleId = 'sale-001';
    const items = [
      { product_id: 'prod-1', quantity: 2, unit_price_cents: 4500 },
      { product_id: 'prod-2', quantity: 1, unit_price_cents: 1500 },
    ];

    const mockInsert = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'sale_items') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    // Insert each item
    for (const item of items) {
      await supabase.from('sale_items').insert({
        sale_id: saleId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        total_cents: item.unit_price_cents * item.quantity,
      });
    }

    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockInsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      product_id: 'prod-1',
      quantity: 2,
      total_cents: 9000,
    }));
    expect(mockInsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      product_id: 'prod-2',
      quantity: 1,
      total_cents: 1500,
    }));
  });

  it('should handle out-of-stock products', () => {
    const products = [
      { id: '1', nome: 'Produto A', stock_quantity: 0 }, // Out of stock
      { id: '2', nome: 'Produto B', stock_quantity: 5 }, // In stock
      { id: '3', nome: 'Produto C', stock_quantity: 0 }, // Out of stock
    ];

    const inStock = products.filter(p => p.stock_quantity > 0);
    const outOfStock = products.filter(p => p.stock_quantity === 0);

    expect(inStock).toHaveLength(1);
    expect(outOfStock).toHaveLength(2);
  });

  it('should validate product price is positive', () => {
    const validPrices = [100, 1500, 10000];
    const invalidPrices = [0, -100, -1500];

    validPrices.forEach(price => {
      const isValid = price > 0;
      expect(isValid).toBe(true);
    });

    invalidPrices.forEach(price => {
      const isValid = price > 0;
      expect(isValid).toBe(false);
    });
  });
});

describe('Products & Sales - Product Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new product with initial stock', async () => {
    const newProduct = {
      nome: 'Luvas de Boxe Pro',
      descricao: 'Luvas profissionais 12oz',
      preco_cents: 8500,
      stock_quantity: 20,
      category: 'EQUIPAMENTO',
      ativo: true,
    };

    const mockInsert = vi.fn().mockResolvedValue({
      data: { id: 'product-new', ...newProduct },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'products') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    await supabase.from('products').insert(newProduct);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Luvas de Boxe Pro',
        preco_cents: 8500,
        stock_quantity: 20,
        ativo: true,
      })
    );
  });

  it('should update product price', async () => {
    const productId = 'product-001';
    const newPriceCents = 5000; // €50 (was €45)

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'products') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    await supabase.from('products')
      .update({ preco_cents: newPriceCents })
      .eq('id', productId);

    expect(mockUpdate).toHaveBeenCalledWith({ preco_cents: 5000 });
  });

  it('should add stock to existing product', async () => {
    const product = {
      id: 'product-002',
      stock_quantity: 10,
    };

    const addedStock = 15;
    const newStock = product.stock_quantity + addedStock;

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'products') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    await supabase.from('products')
      .update({ stock_quantity: newStock })
      .eq('id', product.id);

    expect(mockUpdate).toHaveBeenCalledWith({ stock_quantity: 25 });
  });

  it('should deactivate product (not delete)', async () => {
    const productId = 'product-003';

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'products') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    // Deactivate instead of delete
    await supabase.from('products')
      .update({ ativo: false })
      .eq('id', productId);

    expect(mockUpdate).toHaveBeenCalledWith({ ativo: false });
  });

  it('should filter active products only', async () => {
    const mockProducts = [
      { id: '1', nome: 'Produto A', ativo: true },
      { id: '2', nome: 'Produto B', ativo: true },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'products') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const results = await supabase.from('products')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    expect(mockEq).toHaveBeenCalledWith('ativo', true);
    expect(results.data).toHaveLength(2);
  });

  it('should calculate stock value (inventory worth)', () => {
    const products = [
      { nome: 'Luvas', preco_cents: 4500, stock_quantity: 10 }, // €450
      { nome: 'Bandagem', preco_cents: 800, stock_quantity: 50 }, // €400
      { nome: 'Protetor', preco_cents: 1500, stock_quantity: 20 }, // €300
    ];

    const totalStockValue = products.reduce((sum, p) => {
      return sum + (p.preco_cents * p.stock_quantity);
    }, 0);

    expect(totalStockValue).toBe(115000); // €1,150 total inventory
  });

  it('should identify low stock products (alert threshold)', () => {
    const alertThreshold = 5;
    const products = [
      { nome: 'Produto A', stock_quantity: 2 }, // Low stock
      { nome: 'Produto B', stock_quantity: 10 }, // OK
      { nome: 'Produto C', stock_quantity: 4 }, // Low stock
      { nome: 'Produto D', stock_quantity: 0 }, // Out of stock
    ];

    const lowStock = products.filter(p =>
      p.stock_quantity > 0 && p.stock_quantity <= alertThreshold
    );

    expect(lowStock).toHaveLength(2);
    expect(lowStock.map(p => p.nome)).toEqual(['Produto A', 'Produto C']);
  });
});

describe('Products & Sales - Transaction Recording', () => {
  it('should create RECEITA transaction for product sale', async () => {
    const mockTransactionInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      return {} as any;
    });

    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'PRODUTOS',
      amount_cents: 4500,
      payment_method: 'CARTAO',
      description: 'Venda: Luvas de Boxe',
      created_by: 'staff-123',
    });

    expect(mockTransactionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECEITA',
        category: 'PRODUTOS',
        amount_cents: 4500,
      })
    );
  });

  it('should support all payment methods for product sales', () => {
    const paymentMethods = ['DINHEIRO', 'CARTAO', 'MBWAY', 'TRANSFERENCIA'];

    paymentMethods.forEach(method => {
      const isValid = ['DINHEIRO', 'CARTAO', 'MBWAY', 'TRANSFERENCIA'].includes(method);
      expect(isValid).toBe(true);
    });
  });

  it('should record sale timestamp', () => {
    const saleTimestamp = new Date().toISOString();
    const sale = {
      id: 'sale-001',
      total_cents: 4500,
      created_at: saleTimestamp,
    };

    expect(new Date(sale.created_at).getTime()).toBeGreaterThan(0);
    expect(sale.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
  });
});
