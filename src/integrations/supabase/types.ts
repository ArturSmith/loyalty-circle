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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      business_locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_id: string
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_primary: boolean
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          postal_code: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_id: string
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_id?: string
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          email: string
          id: string
          invite_token: string
          invited_at: string
          invited_by: string | null
          permissions: string[]
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          email: string
          id?: string
          invite_token?: string
          invited_at?: string
          invited_by?: string | null
          permissions?: string[]
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          email?: string
          id?: string
          invite_token?: string
          invited_at?: string
          invited_by?: string | null
          permissions?: string[]
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_socials: {
        Row: {
          business_id: string
          created_at: string
          id: string
          platform: string
          url: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          platform: string
          url: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          platform?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_socials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_team_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_team_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "business_team_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      business_team_threads: {
        Row: {
          business_id: string
          created_at: string
          id: string
          kind: string
          last_message_at: string
          member_a: string | null
          member_b: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          kind: string
          last_message_at?: string
          member_a?: string | null
          member_b?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          kind?: string
          last_message_at?: string
          member_a?: string | null
          member_b?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_team_threads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          accepted_by_platform: boolean
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
          marketplace_rejection_reason: string | null
          marketplace_status: string
          marketplace_submitted_at: string | null
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          owner_id: string
          paused_at: string | null
          phone: string | null
          postal_code: string | null
          region: string | null
          slug: string | null
          trial_started_at: string | null
          updated_at: string
          website: string | null
          welcome_message: string | null
        }
        Insert: {
          accepted_by_platform?: boolean
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
          marketplace_rejection_reason?: string | null
          marketplace_status?: string
          marketplace_submitted_at?: string | null
          name: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          owner_id: string
          paused_at?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          slug?: string | null
          trial_started_at?: string | null
          updated_at?: string
          website?: string | null
          welcome_message?: string | null
        }
        Update: {
          accepted_by_platform?: boolean
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
          marketplace_rejection_reason?: string | null
          marketplace_status?: string
          marketplace_submitted_at?: string | null
          name?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          owner_id?: string
          paused_at?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          slug?: string | null
          trial_started_at?: string | null
          updated_at?: string
          website?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      card_events: {
        Row: {
          business_id: string
          card_instance_id: string | null
          created_at: string
          customer_id: string | null
          event_type: string
          id: string
          metadata: Json
          step_number: number | null
          template_id: string | null
        }
        Insert: {
          business_id: string
          card_instance_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          step_number?: number | null
          template_id?: string | null
        }
        Update: {
          business_id?: string
          card_instance_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          step_number?: number | null
          template_id?: string | null
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
          terms_accepted_at: string | null
          terms_accepted_by: string | null
          terms_accepted_text: string | null
          terms_accepted_version: number | null
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
          terms_accepted_at?: string | null
          terms_accepted_by?: string | null
          terms_accepted_text?: string | null
          terms_accepted_version?: number | null
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
          terms_accepted_at?: string | null
          terms_accepted_by?: string | null
          terms_accepted_text?: string | null
          terms_accepted_version?: number | null
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
          accepted_by_platform: boolean
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
          terms_and_conditions: string
          terms_version: number
          title: string
          total_steps: number
          updated_at: string
        }
        Insert: {
          accepted_by_platform?: boolean
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
          terms_and_conditions: string
          terms_version?: number
          title: string
          total_steps?: number
          updated_at?: string
        }
        Update: {
          accepted_by_platform?: boolean
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
          terms_and_conditions?: string
          terms_version?: number
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
      chat_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
          sender_role: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          business_id: string
          business_last_read_at: string
          created_at: string
          customer_id: string
          customer_last_read_at: string
          id: string
          last_message_at: string
        }
        Insert: {
          business_id: string
          business_last_read_at?: string
          created_at?: string
          customer_id: string
          customer_last_read_at?: string
          id?: string
          last_message_at?: string
        }
        Update: {
          business_id?: string
          business_last_read_at?: string
          created_at?: string
          customer_id?: string
          customer_last_read_at?: string
          id?: string
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_submissions: {
        Row: {
          business_id: string
          change_kind: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          proposed_data: Json
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          change_kind: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          proposed_data: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          change_kind?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          proposed_data?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_submissions_business_id_fkey"
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
          trial_consumed_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id: string
          trial_consumed_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id?: string
          trial_consumed_at?: string | null
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
          plan_tier: string | null
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
          plan_tier?: string | null
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
          plan_tier?: string | null
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
      vouchers: {
        Row: {
          business_id: string
          card_instance_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          label: string
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
          step_number: number
          template_id: string | null
        }
        Insert: {
          business_id: string
          card_instance_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          label: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          step_number: number
          template_id?: string | null
        }
        Update: {
          business_id?: string
          card_instance_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          label?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          step_number?: number
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_card_instance_id_fkey"
            columns: ["card_instance_id"]
            isOneToOne: false
            referencedRelation: "card_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_pass_events: {
        Row: {
          card_instance_id: string
          created_at: string
          event: string
          id: string
          object_id: string | null
          platform: string
          template_id: string | null
        }
        Insert: {
          card_instance_id: string
          created_at?: string
          event: string
          id?: string
          object_id?: string | null
          platform: string
          template_id?: string | null
        }
        Update: {
          card_instance_id?: string
          created_at?: string
          event?: string
          id?: string
          object_id?: string | null
          platform?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_pass_events_card_instance_id_fkey"
            columns: ["card_instance_id"]
            isOneToOne: false
            referencedRelation: "card_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_pass_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["id"]
          },
        ]
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
      business_is_listable: { Args: { _business_id: string }; Returns: boolean }
      business_slot_rank: { Args: { _business_id: string }; Returns: number }
      business_trial_active: {
        Args: { _business_id: string }
        Returns: boolean
      }
      can_access_business_team_thread: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      can_on_business: {
        Args: { _business_id: string; _permission: string }
        Returns: boolean
      }
      can_on_template: {
        Args: { _permission: string; _template_id: string }
        Returns: boolean
      }
      claim_anonymous_card: {
        Args: { _instance_id: string; _secret: string }
        Returns: string
      }
      delete_business: { Args: { _business_id: string }; Returns: undefined }
      discover_businesses: {
        Args: { _lat?: number; _limit?: number; _lng?: number; _q?: string }
        Returns: {
          brand_color: string
          business_id: string
          card_count: number
          category: string
          city: string
          country: string
          description: string
          distance_km: number
          latitude: number
          location_count: number
          locations: Json
          logo_url: string
          longitude: number
          name: string
        }[]
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
      get_business_detail_public: { Args: { _id: string }; Returns: Json }
      get_pending_moderation: {
        Args: { _entity_id: string; _entity_type: string }
        Returns: Json
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
      get_business_dashboard_stats: {
        Args: { _business_id: string }
        Returns: Json
      }
      has_business_permission: {
        Args: { _business_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_member: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      redeem_business_voucher: {
        Args: { _business_id: string; _voucher_id: string }
        Returns: Json
      }
      redeem_voucher: { Args: { _voucher_id: string }; Returns: Json }
      renew_card: { Args: { _card_instance_id: string }; Returns: undefined }
      review_moderation_submission: {
        Args: {
          _decision: string
          _reason?: string
          _reviewer_id: string
          _submission_id: string
        }
        Returns: undefined
      }
      set_business_paused: {
        Args: { _business_id: string; _paused: boolean }
        Returns: undefined
      }
      submit_business_changes: {
        Args: { _business_id: string; _changes: Json }
        Returns: string
      }
      submit_business_for_moderation: {
        Args: { _business_id: string }
        Returns: string
      }
      submit_business_locations: {
        Args: { _business_id: string; _locations: Json }
        Returns: Json
      }
      submit_business_socials: {
        Args: { _business_id: string; _socials: Json }
        Returns: Json
      }
      submit_card_changes: {
        Args: { _changes: Json; _template_id: string }
        Returns: string
      }
      set_business_marketplace_status: {
        Args: { _business_id: string; _status: string }
        Returns: undefined
      }
      stamp_business_card: {
        Args: { _business_id: string; _card_instance_id: string; _env?: string }
        Returns: Json
      }
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
