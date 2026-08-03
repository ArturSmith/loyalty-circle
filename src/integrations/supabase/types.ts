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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      businesses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          brand_color: string | null
          category: string | null
          city: string | null
          comped: boolean
          comped_note: string | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          owner_id: string
          phone: string | null
          postal_code: string | null
          region: string | null
          slug: string | null
          updated_at: string
          website: string | null
          welcome_message: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          brand_color?: string | null
          category?: string | null
          city?: string | null
          comped?: boolean
          comped_note?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          owner_id: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          slug?: string | null
          updated_at?: string
          website?: string | null
          welcome_message?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          brand_color?: string | null
          category?: string | null
          city?: string | null
          comped?: boolean
          comped_note?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          slug?: string | null
          updated_at?: string
          website?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      card_instances: {
        Row: {
          anon_secret: string | null
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          google_object_id: string | null
          id: string
          order_index: number | null
          stamps_count: number
          template_id: string
        }
        Insert: {
          anon_secret?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          google_object_id?: string | null
          id?: string
          order_index?: number | null
          stamps_count?: number
          template_id: string
        }
        Update: {
          anon_secret?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          google_object_id?: string | null
          id?: string
          order_index?: number | null
          stamps_count?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      card_templates: {
        Row: {
          accent_color: string
          active: boolean
          bg_color: string
          business_id: string
          corner_title: string | null
          created_at: string
          description: string | null
          google_class_id: string | null
          grid_cols: number | null
          id: string
          logo_url: string | null
          rewards: Json
          shape: string
          stamp_icon: string
          stamp_shape: string
          step_size: string
          subtitle: string | null
          text_color: string
          title: string
          total_steps: number
          updated_at: string
        }
        Insert: {
          accent_color?: string
          active?: boolean
          bg_color?: string
          business_id: string
          corner_title?: string | null
          created_at?: string
          description?: string | null
          google_class_id?: string | null
          grid_cols?: number | null
          id?: string
          logo_url?: string | null
          rewards?: Json
          shape?: string
          stamp_icon?: string
          stamp_shape?: string
          step_size?: string
          subtitle?: string | null
          text_color?: string
          title: string
          total_steps?: number
          updated_at?: string
        }
        Update: {
          accent_color?: string
          active?: boolean
          bg_color?: string
          business_id?: string
          corner_title?: string | null
          created_at?: string
          description?: string | null
          google_class_id?: string | null
          grid_cols?: number | null
          id?: string
          logo_url?: string | null
          rewards?: Json
          shape?: string
          stamp_icon?: string
          stamp_shape?: string
          step_size?: string
          subtitle?: string | null
          text_color?: string
          title?: string
          total_steps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          id: string
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id: string
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id?: string
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stamps: {
        Row: {
          business_id: string
          card_instance_id: string
          created_at: string
          id: string
          issued_by: string
          step_number: number
        }
        Insert: {
          business_id: string
          card_instance_id: string
          created_at?: string
          id?: string
          issued_by: string
          step_number: number
        }
        Update: {
          business_id?: string
          card_instance_id?: string
          created_at?: string
          id?: string
          issued_by?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "stamps_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_card_instance_id_fkey"
            columns: ["card_instance_id"]
            isOneToOne: false
            referencedRelation: "card_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_trial_active: { Args: { _user_id: string }; Returns: boolean }
      active_subscription_count: {
        Args: { _env?: string; _user_id: string }
        Returns: number
      }
      add_stamp:
        | { Args: { _card_instance_id: string }; Returns: Json }
        | { Args: { _card_instance_id: string; _env?: string }; Returns: Json }
      business_has_access: {
        Args: { _business_created_at: string; _owner_id: string }
        Returns: boolean
      }
      business_has_access_v2: {
        Args: { _business_id: string; _env?: string }
        Returns: boolean
      }
      business_slot_rank: { Args: { _business_id: string }; Returns: number }
      claim_anonymous_card: {
        Args: { _instance_id: string; _secret: string }
        Returns: string
      }
      discover_cards: {
        Args: { _lat?: number; _limit?: number; _lng?: number; _q?: string }
        Returns: {
          accent_color: string
          bg_color: string
          business_id: string
          business_logo_url: string
          business_name: string
          category: string
          city: string
          corner_title: string
          country: string
          created_at: string
          description: string
          distance_km: number
          grid_cols: number
          latitude: number
          logo_url: string
          longitude: number
          rewards: Json
          shape: string
          stamp_icon: string
          subtitle: string
          template_id: string
          text_color: string
          title: string
          total_steps: number
        }[]
      }
      get_business_public: {
        Args: { _id: string }
        Returns: {
          address_line1: string
          address_line2: string
          brand_color: string
          category: string
          city: string
          country: string
          created_at: string
          description: string
          id: string
          latitude: number
          logo_url: string
          longitude: number
          name: string
          phone: string
          postal_code: string
          region: string
          slug: string
          website: string
          welcome_message: string
        }[]
      }
      get_frozen_business_ids:
        | {
            Args: { _ids: string[] }
            Returns: {
              business_id: string
            }[]
          }
        | {
            Args: { _env?: string; _ids: string[] }
            Returns: {
              business_id: string
            }[]
          }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      renew_card: { Args: { _card_instance_id: string }; Returns: undefined }
      user_holds_card_for_business: {
        Args: { _business_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
