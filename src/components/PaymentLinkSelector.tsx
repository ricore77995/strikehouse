import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

export interface PaymentLinkInfo {
  id: string
  url: string
  displayName: string
  priceAmountCents: number | null
  currency: string
  metadata: {
    weekly_limit?: string | null
    modalities_count?: string | null
    access_type?: string | null
    commitment_months?: string | null
    special?: string | null
  }
  active: boolean
}

interface PaymentLinkSelectorProps {
  value: string | null
  onChange: (linkId: string | null, link: PaymentLinkInfo | null) => void
  placeholder?: string
  disabled?: boolean
}

export function PaymentLinkSelector({
  value,
  onChange,
  placeholder = 'Seleccionar Payment Link',
  disabled = false,
}: PaymentLinkSelectorProps) {
  const [links, setLinks] = useState<PaymentLinkInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLinks() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: invokeError } = await supabase.functions.invoke(
          'list-payment-links'
        )

        if (invokeError) {
          throw new Error(invokeError.message)
        }

        if (data?.success && data?.links) {
          setLinks(data.links)
        } else {
          throw new Error(data?.error || 'Failed to fetch payment links')
        }
      } catch (err) {
        console.error('Error fetching payment links:', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar links')
      } finally {
        setLoading(false)
      }
    }

    fetchLinks()
  }, [])

  const formatPrice = (cents: number | null, currency: string) => {
    if (cents === null) return ''
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100)
  }

  const handleValueChange = (linkId: string) => {
    if (linkId === '__clear__') {
      onChange(null, null)
      return
    }
    const selectedLink = links.find((l) => l.id === linkId)
    onChange(linkId, selectedLink || null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando Payment Links...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-destructive text-sm py-2">
        Erro: {error}
      </div>
    )
  }

  if (links.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-2">
        Nenhum Payment Link activo encontrado
      </div>
    )
  }

  return (
    <Select
      value={value || undefined}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {value && (
          <SelectItem value="__clear__" className="text-muted-foreground">
            Limpar selecção
          </SelectItem>
        )}
        {links.map((link) => (
          <SelectItem key={link.id} value={link.id}>
            <span className="flex items-center gap-2">
              <span>{link.displayName}</span>
              {link.priceAmountCents !== null && (
                <span className="text-muted-foreground">
                  {formatPrice(link.priceAmountCents, link.currency)}
                </span>
              )}
              {link.metadata.weekly_limit && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {link.metadata.weekly_limit}x/sem
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
