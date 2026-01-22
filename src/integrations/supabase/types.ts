export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      areas: {
        Row: {
          ativo: boolean | null
          capacidade_pts: number
          created_at: string | null
          id: string
          is_exclusive: boolean | null
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          capacidade_pts?: number
          created_at?: string | null
          id?: string
          is_exclusive?: boolean | null
          nome: string
        }
        Update: {
          ativo?: boolean | null
          capacidade_pts?: number
          created_at?: string | null
          id?: string
          is_exclusive?: boolean | null
          nome?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
          user_id: string
          user_role: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id: string
          user_role: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          actual_closing_cents: number | null
          closed_at: string | null
          closed_by: string | null
          difference_cents: number | null
          expected_closing_cents: number | null
          id: string
          opened_at: string | null
          opened_by: string
          opening_balance_cents: number
          session_date: string
          status: string | null
        }
        Insert: {
          actual_closing_cents?: number | null
          closed_at?: string | null
          closed_by?: string | null
          difference_cents?: number | null
          expected_closing_cents?: number | null
          id?: string
          opened_at?: string | null
          opened_by: string
          opening_balance_cents: number
          session_date: string
          status?: string | null
        }
        Update: {
          actual_closing_cents?: number | null
          closed_at?: string | null
          closed_by?: string | null
          difference_cents?: number | null
          expected_closing_cents?: number | null
          id?: string
          opened_at?: string | null
          opened_by?: string
          opening_balance_cents?: number
          session_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string
          nome: string
          type: string
        }
        Insert: {
          code: string
          nome: string
          type: string
        }
        Update: {
          code?: string
          nome?: string
          type?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          class_id: string | null
          guest_name: string | null
          id: string
          member_id: string | null
          rental_id: string | null
          result: string
          type: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          class_id?: string | null
          guest_name?: string | null
          id?: string
          member_id?: string | null
          rental_id?: string | null
          result: string
          type: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          class_id?: string | null
          guest_name?: string | null
          id?: string
          member_id?: string | null
          rental_id?: string | null
          result?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_active_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "v_today_rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_checkins_staff"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          area_id: string | null
          ativo: boolean | null
          capacidade: number | null
          coach_id: string | null
          created_at: string | null
          dia_semana: number
          duracao_min: number
          hora_inicio: string
          id: string
          modalidade: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          ativo?: boolean | null
          capacidade?: number | null
          coach_id?: string | null
          created_at?: string | null
          dia_semana: number
          duracao_min?: number
          hora_inicio: string
          id?: string
          modalidade: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          ativo?: boolean | null
          capacidade?: number | null
          coach_id?: string | null
          created_at?: string | null
          dia_semana?: number
          duracao_min?: number
          hora_inicio?: string
          id?: string
          modalidade?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "external_coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_credits: {
        Row: {
          amount: number
          coach_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          reason: string
          rental_id: string | null
        }
        Insert: {
          amount: number
          coach_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reason: string
          rental_id?: string | null
        }
        Update: {
          amount?: number
          coach_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reason?: string
          rental_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_credits_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "external_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_coach_credits_rental"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_coach_credits_rental"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "v_today_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          ativo: boolean | null
          category: string
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          discount_type: string
          discount_value: number
          id: string
          max_uses: number | null
          min_commitment_months: number | null
          new_members_only: boolean | null
          nome: string
          referrer_credit_cents: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          ativo?: boolean | null
          category: string
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_type: string
          discount_value: number
          id?: string
          max_uses?: number | null
          min_commitment_months?: number | null
          new_members_only?: boolean | null
          nome: string
          referrer_credit_cents?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          ativo?: boolean | null
          category?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_uses?: number | null
          min_commitment_months?: number | null
          new_members_only?: boolean | null
          nome?: string
          referrer_credit_cents?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      external_coaches: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          credits_balance: number | null
          email: string | null
          fee_type: string
          fee_value: number
          id: string
          modalidade: string | null
          nome: string
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          credits_balance?: number | null
          email?: string | null
          fee_type: string
          fee_value: number
          id?: string
          modalidade?: string | null
          nome: string
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          credits_balance?: number | null
          email?: string | null
          fee_type?: string
          fee_value?: number
          id?: string
          modalidade?: string | null
          nome?: string
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      gym_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_name: string
          results: Json | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_name: string
          results?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_name?: string
          results?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      member_ibans: {
        Row: {
          created_at: string | null
          iban: string
          id: string
          is_primary: boolean | null
          label: string | null
          member_id: string
        }
        Insert: {
          created_at?: string | null
          iban: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          member_id: string
        }
        Update: {
          created_at?: string | null
          iban?: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_ibans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ibans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_active_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ibans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ibans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          access_expires_at: string | null
          access_type: string | null
          created_at: string | null
          credits_remaining: number | null
          current_plan_id: string | null
          current_subscription_id: string | null
          email: string | null
          id: string
          nome: string
          preferred_payment_method: string | null
          qr_code: string
          status: string | null
          telefone: string
          updated_at: string | null
        }
        Insert: {
          access_expires_at?: string | null
          access_type?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          current_plan_id?: string | null
          current_subscription_id?: string | null
          email?: string | null
          id?: string
          nome: string
          preferred_payment_method?: string | null
          qr_code: string
          status?: string | null
          telefone: string
          updated_at?: string | null
        }
        Update: {
          access_expires_at?: string | null
          access_type?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          current_plan_id?: string | null
          current_subscription_id?: string | null
          email?: string | null
          id?: string
          nome?: string
          preferred_payment_method?: string | null
          qr_code?: string
          status?: string | null
          telefone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_current_subscription_id_fkey"
            columns: ["current_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      modalities: {
        Row: {
          ativo: boolean | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          nome: string
          sort_order: number | null
        }
        Insert: {
          ativo?: boolean | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          nome: string
          sort_order?: number | null
        }
        Update: {
          ativo?: boolean | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          nome?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      pending_payments: {
        Row: {
          amount_cents: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          member_id: string
          metadata: Json | null
          payment_method: string
          plan_id: string | null
          reference: string
          status: string | null
          stripe_payment_id: string | null
          stripe_session_id: string | null
          transaction_id: string | null
        }
        Insert: {
          amount_cents: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          member_id: string
          metadata?: Json | null
          payment_method: string
          plan_id?: string | null
          reference: string
          status?: string | null
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount_cents?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          member_id?: string
          metadata?: Json | null
          payment_method?: string
          plan_id?: string | null
          reference?: string
          status?: string | null
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_active_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          ativo: boolean | null
          commitment_months: number | null
          created_at: string | null
          creditos: number | null
          duracao_dias: number | null
          enrollment_fee_cents: number | null
          id: string
          modalities: string[] | null
          nome: string
          preco_cents: number
          pricing_override: Json | null
          tipo: string
          visible: boolean | null
        }
        Insert: {
          ativo?: boolean | null
          commitment_months?: number | null
          created_at?: string | null
          creditos?: number | null
          duracao_dias?: number | null
          enrollment_fee_cents?: number | null
          id?: string
          modalities?: string[] | null
          nome: string
          preco_cents: number
          pricing_override?: Json | null
          tipo: string
          visible?: boolean | null
        }
        Update: {
          ativo?: boolean | null
          commitment_months?: number | null
          created_at?: string | null
          creditos?: number | null
          duracao_dias?: number | null
          enrollment_fee_cents?: number | null
          id?: string
          modalities?: string[] | null
          nome?: string
          preco_cents?: number
          pricing_override?: Json | null
          tipo?: string
          visible?: boolean | null
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          base_price_cents: number
          currency: string
          day_pass_price_cents: number
          enrollment_fee_cents: number
          extra_modality_price_cents: number
          id: string
          single_class_price_cents: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          base_price_cents?: number
          currency?: string
          day_pass_price_cents?: number
          enrollment_fee_cents?: number
          extra_modality_price_cents?: number
          id?: string
          single_class_price_cents?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          base_price_cents?: number
          currency?: string
          day_pass_price_cents?: number
          enrollment_fee_cents?: number
          extra_modality_price_cents?: number
          id?: string
          single_class_price_cents?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          id: string
          nome: string
          preco_cents: number
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          id?: string
          nome: string
          preco_cents: number
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          preco_cents?: number
        }
        Relationships: []
      }
      rentals: {
        Row: {
          area_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          coach_id: string
          created_at: string | null
          created_by: string | null
          credit_generated: boolean | null
          end_time: string
          fee_charged_cents: number | null
          guest_count: number | null
          id: string
          is_recurring: boolean | null
          rental_date: string
          series_id: string | null
          start_time: string
          status: string | null
        }
        Insert: {
          area_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          coach_id: string
          created_at?: string | null
          created_by?: string | null
          credit_generated?: boolean | null
          end_time: string
          fee_charged_cents?: number | null
          guest_count?: number | null
          id?: string
          is_recurring?: boolean | null
          rental_date: string
          series_id?: string | null
          start_time: string
          status?: string | null
        }
        Update: {
          area_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          coach_id?: string
          created_at?: string | null
          created_by?: string | null
          credit_generated?: boolean | null
          end_time?: string
          fee_charged_cents?: number | null
          guest_count?: number | null
          id?: string
          is_recurring?: boolean | null
          rental_date?: string
          series_id?: string | null
          start_time?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_rentals_cancelled_by"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rentals_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "external_coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string | null
          descricao: string
          id: string
          preco_unit_cents: number
          product_id: string | null
          quantidade: number
          sale_id: string
          subtotal_cents: number
        }
        Insert: {
          created_at?: string | null
          descricao: string
          id?: string
          preco_unit_cents: number
          product_id?: string | null
          quantidade?: number
          sale_id: string
          subtotal_cents: number
        }
        Update: {
          created_at?: string | null
          descricao?: string
          id?: string
          preco_unit_cents?: number
          product_id?: string | null
          quantidade?: number
          sale_id?: string
          subtotal_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          member_id: string | null
          payment_method: string
          total_cents: number
          transaction_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          member_id?: string | null
          payment_method: string
          total_cents: number
          transaction_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          member_id?: string | null
          payment_method?: string
          total_cents?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_active_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          ativo: boolean | null
          coach_id: string | null
          created_at: string | null
          email: string
          id: string
          nome: string
          role: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          coach_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          nome: string
          role: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          coach_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "external_coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payment_ledger: {
        Row: {
          amount_total: number
          auto_matched: boolean | null
          confirmed: boolean | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          currency: string | null
          customer_email: string
          customer_name: string | null
          event_id: string
          event_type: string
          id: string
          is_new_member: boolean | null
          matched_member_id: string | null
          metadata: Json | null
          payment_method: string | null
          payment_status: string | null
          product_type: string | null
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_total: number
          auto_matched?: boolean | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email: string
          customer_name?: string | null
          event_id: string
          event_type: string
          id?: string
          is_new_member?: boolean | null
          matched_member_id?: string | null
          metadata?: Json | null
          payment_method?: string | null
          payment_status?: string | null
          product_type?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_total?: number
          auto_matched?: boolean | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string
          customer_name?: string | null
          event_id?: string
          event_type?: string
          id?: string
          is_new_member?: boolean | null
          matched_member_id?: string | null
          metadata?: Json | null
          payment_method?: string | null
          payment_status?: string | null
          product_type?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payment_ledger_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payment_ledger_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payment_ledger_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "v_active_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payment_ledger_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payment_ledger_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_members"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          calculated_price_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          commitment_discount_id: string | null
          commitment_discount_pct: number
          commitment_months: number
          created_at: string | null
          created_by: string | null
          credits_remaining: number | null
          enrollment_fee_cents: number
          expires_at: string | null
          final_price_cents: number
          freeze_reason: string | null
          frozen_at: string | null
          frozen_until: string | null
          id: string
          member_id: string
          modalities: string[]
          original_expires_at: string | null
          plan_id: string | null
          promo_discount_id: string | null
          promo_discount_pct: number
          renewal_reminder_sent_at: string | null
          starts_at: string
          status: string
        }
        Insert: {
          auto_renew?: boolean
          calculated_price_cents: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commitment_discount_id?: string | null
          commitment_discount_pct?: number
          commitment_months?: number
          created_at?: string | null
          created_by?: string | null
          credits_remaining?: number | null
          enrollment_fee_cents?: number
          expires_at?: string | null
          final_price_cents: number
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_until?: string | null
          id?: string
          member_id: string
          modalities?: string[]
          original_expires_at?: string | null
          plan_id?: string | null
          promo_discount_id?: string | null
          promo_discount_pct?: number
          renewal_reminder_sent_at?: string | null
          starts_at?: string
          status?: string
        }
        Update: {
          auto_renew?: boolean
          calculated_price_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commitment_discount_id?: string | null
          commitment_discount_pct?: number
          commitment_months?: number
          created_at?: string | null
          created_by?: string | null
          credits_remaining?: number | null
          enrollment_fee_cents?: number
          expires_at?: string | null
          final_price_cents?: number
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_until?: string | null
          id?: string
          member_id?: string
          modalities?: string[]
          original_expires_at?: string | null
          plan_id?: string | null
          promo_discount_id?: string | null
          promo_discount_pct?: number
          renewal_reminder_sent_at?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_commitment_discount_id_fkey"
            columns: ["commitment_discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_active_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_promo_discount_id_fkey"
            columns: ["promo_discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_cents: number
          category: string
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          member_id: string | null
          payment_method: string
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
          type: string
        }
        Insert: {
          amount_cents: number
          category: string
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          member_id?: string | null
          payment_method: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          type: string
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          member_id?: string | null
          payment_method?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_active_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_active_members: {
        Row: {
          access_expires_at: string | null
          access_type: string | null
          created_at: string | null
          credits_remaining: number | null
          email: string | null
          id: string | null
          nome: string | null
          plano_nome: string | null
          plano_preco: number | null
          qr_code: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_daily_summary: {
        Row: {
          despesa_cents: number | null
          num_despesas: number | null
          num_receitas: number | null
          receita_cents: number | null
          resultado_cents: number | null
          transaction_date: string | null
        }
        Relationships: []
      }
      v_expiring_members: {
        Row: {
          access_expires_at: string | null
          access_type: string | null
          created_at: string | null
          credits_remaining: number | null
          dias_restantes: number | null
          email: string | null
          id: string | null
          nome: string | null
          qr_code: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          access_expires_at?: string | null
          access_type?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          dias_restantes?: never
          email?: string | null
          id?: string | null
          nome?: string | null
          qr_code?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          access_expires_at?: string | null
          access_type?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          dias_restantes?: never
          email?: string | null
          id?: string | null
          nome?: string | null
          qr_code?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_overdue_members: {
        Row: {
          access_expires_at: string | null
          access_type: string | null
          created_at: string | null
          credits_remaining: number | null
          dias_atraso: number | null
          email: string | null
          id: string | null
          nome: string | null
          qr_code: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          access_expires_at?: string | null
          access_type?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          dias_atraso?: never
          email?: string | null
          id?: string | null
          nome?: string | null
          qr_code?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          access_expires_at?: string | null
          access_type?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          dias_atraso?: never
          email?: string | null
          id?: string | null
          nome?: string | null
          qr_code?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_today_rentals: {
        Row: {
          area_capacidade: number | null
          area_id: string | null
          area_nome: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          coach_id: string | null
          coach_nome: string | null
          created_at: string | null
          created_by: string | null
          credit_generated: boolean | null
          end_time: string | null
          fee_charged_cents: number | null
          guest_count: number | null
          id: string | null
          is_recurring: boolean | null
          modalidade: string | null
          rental_date: string | null
          series_id: string | null
          start_time: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_rentals_cancelled_by"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rentals_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "external_coaches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_expected_closing: {
        Args: { p_session_date: string }
        Returns: number
      }
      generate_member_qr: { Args: never; Returns: string }
      generate_payment_reference: { Args: never; Returns: string }
      get_coach_id_from_auth: { Args: never; Returns: string }
      get_member_by_qr: {
        Args: { qr_code_input: string }
        Returns: {
          access_expires_at: string
          access_type: string
          credits_remaining: number
          email: string
          id: string
          nome: string
          qr_code: string
          status: string
          telefone: string
        }[]
      }
      get_staff_coach_id: { Args: { p_user_id: string }; Returns: string }
      get_user_role: { Args: { p_user_id: string }; Returns: string }
      has_staff_role: {
        Args: { p_roles: string[]; p_user_id: string }
        Returns: boolean
      }
      invoke_scheduled_jobs: { Args: never; Returns: undefined }
      is_staff_member: { Args: { p_user_id: string }; Returns: boolean }
      validate_kiosk_pin: { Args: { input_pin: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
