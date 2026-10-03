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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_approvals: {
        Row: {
          created_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["account_approval_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["account_approval_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["account_approval_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_approvals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_approvals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_calls: {
        Row: {
          agent_id: string
          created_at: string
          id: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: never
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "agent_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_daily: {
        Row: {
          activity_score: number | null
          agent_id: string
          avg_context_fill: number | null
          baseline_latency_ms: number | null
          cache_hit_rate: number | null
          call_count: number | null
          calls_per_hour: number | null
          correction_rate: number | null
          created_at: string
          day: string
          error_rate: number | null
          error_rate_deviation: number | null
          freshness_score: number | null
          id: string
          latency_variability_ms: number | null
          output_tokens: number | null
          raw: Json | null
          readiness_score: number | null
          retry_rate: number | null
          total_tokens: number | null
          updated_at: string
        }
        Insert: {
          activity_score?: number | null
          agent_id: string
          avg_context_fill?: number | null
          baseline_latency_ms?: number | null
          cache_hit_rate?: number | null
          call_count?: number | null
          calls_per_hour?: number | null
          correction_rate?: number | null
          created_at?: string
          day: string
          error_rate?: number | null
          error_rate_deviation?: number | null
          freshness_score?: number | null
          id?: string
          latency_variability_ms?: number | null
          output_tokens?: number | null
          raw?: Json | null
          readiness_score?: number | null
          retry_rate?: number | null
          total_tokens?: number | null
          updated_at?: string
        }
        Update: {
          activity_score?: number | null
          agent_id?: string
          avg_context_fill?: number | null
          baseline_latency_ms?: number | null
          cache_hit_rate?: number | null
          call_count?: number | null
          calls_per_hour?: number | null
          correction_rate?: number | null
          created_at?: string
          day?: string
          error_rate?: number | null
          error_rate_deviation?: number | null
          freshness_score?: number | null
          id?: string
          latency_variability_ms?: number | null
          output_tokens?: number | null
          raw?: Json | null
          readiness_score?: number | null
          retry_rate?: number | null
          total_tokens?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_daily_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_events: {
        Row: {
          agent_id: string
          cached_tokens: number | null
          context_limit: number | null
          context_tokens: number | null
          created_at: string
          error: string | null
          event_type: string
          id: string
          latency_ms: number | null
          model: string | null
          retry_count: number
          status: string
          task_id: string | null
          tokens_in: number | null
          tokens_out: number | null
          was_corrected: boolean
        }
        Insert: {
          agent_id: string
          cached_tokens?: number | null
          context_limit?: number | null
          context_tokens?: number | null
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          retry_count?: number
          status?: string
          task_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          was_corrected?: boolean
        }
        Update: {
          agent_id?: string
          cached_tokens?: number | null
          context_limit?: number | null
          context_tokens?: number | null
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          retry_count?: number
          status?: string
          task_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          was_corrected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_keys: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_keys_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          created_at: string
          id: string
          model: string | null
          name: string
          oauth_client_id: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          name: string
          oauth_client_id?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          name?: string
          oauth_client_id?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          agent_id: string
          agent_readiness: number | null
          created_at: string
          decision: string
          human_readiness: number | null
          id: string
          message: string | null
          reason: string | null
          responded_at: string | null
          response_energy: number | null
          response_note: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          agent_readiness?: number | null
          created_at?: string
          decision?: string
          human_readiness?: number | null
          id?: string
          message?: string | null
          reason?: string | null
          responded_at?: string | null
          response_energy?: number | null
          response_note?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          agent_readiness?: number | null
          created_at?: string
          decision?: string
          human_readiness?: number | null
          id?: string
          message?: string | null
          reason?: string | null
          responded_at?: string | null
          response_energy?: number | null
          response_note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      oura_daily: {
        Row: {
          active_calories: number | null
          activity_score: number | null
          average_heart_rate: number | null
          average_hrv: number | null
          created_at: string
          day: string
          id: string
          main_sleep_seconds: number | null
          nap_count: number | null
          nap_seconds: number | null
          raw_activity: Json | null
          raw_readiness: Json | null
          raw_sleep_daily: Json | null
          raw_sleep_sessions: Json | null
          readiness_score: number | null
          respiratory_rate: number | null
          resting_heart_rate: number | null
          sleep_efficiency: number | null
          sleep_score: number | null
          sleep_session_count: number | null
          steps: number | null
          temperature_deviation: number | null
          total_calories: number | null
          total_sleep_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_calories?: number | null
          activity_score?: number | null
          average_heart_rate?: number | null
          average_hrv?: number | null
          created_at?: string
          day: string
          id?: string
          main_sleep_seconds?: number | null
          nap_count?: number | null
          nap_seconds?: number | null
          raw_activity?: Json | null
          raw_readiness?: Json | null
          raw_sleep_daily?: Json | null
          raw_sleep_sessions?: Json | null
          readiness_score?: number | null
          respiratory_rate?: number | null
          resting_heart_rate?: number | null
          sleep_efficiency?: number | null
          sleep_score?: number | null
          sleep_session_count?: number | null
          steps?: number | null
          temperature_deviation?: number | null
          total_calories?: number | null
          total_sleep_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_calories?: number | null
          activity_score?: number | null
          average_heart_rate?: number | null
          average_hrv?: number | null
          created_at?: string
          day?: string
          id?: string
          main_sleep_seconds?: number | null
          nap_count?: number | null
          nap_seconds?: number | null
          raw_activity?: Json | null
          raw_readiness?: Json | null
          raw_sleep_daily?: Json | null
          raw_sleep_sessions?: Json | null
          readiness_score?: number | null
          respiratory_rate?: number | null
          resting_heart_rate?: number | null
          sleep_efficiency?: number | null
          sleep_score?: number | null
          sleep_session_count?: number | null
          steps?: number | null
          temperature_deviation?: number | null
          total_calories?: number | null
          total_sleep_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oura_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      thread_messages: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          energy: number | null
          event_id: string | null
          id: string
          kind: string
          role: string
          user_id: string
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          energy?: number | null
          event_id?: string | null
          id?: string
          kind: string
          role: string
          user_id: string
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          energy?: number | null
          event_id?: string | null
          id?: string
          kind?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "agent_events"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_checkin_cron_secret: {
        Args: { p_secret: string }
        Returns: boolean
      }
      consume_agent_call: {
        Args: { p_agent_id: string; p_limit: number; p_window_seconds: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      mark_event_corrected: {
        Args: { p_corrected?: boolean; p_event_id: string }
        Returns: undefined
      }
      refresh_agent_daily: {
        Args: { p_agent_id: string; p_day: string }
        Returns: undefined
      }
    }
    Enums: {
      account_approval_status: "pending" | "approved" | "denied"
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_approval_status: ["pending", "approved", "denied"],
      app_role: ["admin", "user"],
    },
  },
} as const
