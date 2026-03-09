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
  public: {
    Tables: {
      checklist_items: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_completed: boolean
          label: string
          updated_at: string
          week_number: number
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_completed?: boolean
          label: string
          updated_at?: string
          week_number: number
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          label?: string
          updated_at?: string
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          additional_products: string[] | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          content_topics: string | null
          contract_duration: string | null
          contract_start: string | null
          created_at: string
          drive_branding_link: string | null
          drive_logo_link: string | null
          drive_styleguide_link: string | null
          id: string
          industry: string | null
          logo_url: string | null
          monthly_carousels: number
          monthly_price: number | null
          monthly_reels: number
          monthly_stories: number
          name: string
          sector: string | null
          status: string
          strategy_text: string | null
          summary: string | null
          target_audience: string | null
          tonality: string | null
          updated_at: string
          usps: string | null
          website_url: string | null
        }
        Insert: {
          additional_products?: string[] | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          content_topics?: string | null
          contract_duration?: string | null
          contract_start?: string | null
          created_at?: string
          drive_branding_link?: string | null
          drive_logo_link?: string | null
          drive_styleguide_link?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          monthly_carousels?: number
          monthly_price?: number | null
          monthly_reels?: number
          monthly_stories?: number
          name: string
          sector?: string | null
          status?: string
          strategy_text?: string | null
          summary?: string | null
          target_audience?: string | null
          tonality?: string | null
          updated_at?: string
          usps?: string | null
          website_url?: string | null
        }
        Update: {
          additional_products?: string[] | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          content_topics?: string | null
          contract_duration?: string | null
          contract_start?: string | null
          created_at?: string
          drive_branding_link?: string | null
          drive_logo_link?: string | null
          drive_styleguide_link?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          monthly_carousels?: number
          monthly_price?: number | null
          monthly_reels?: number
          monthly_stories?: number
          name?: string
          sector?: string | null
          status?: string
          strategy_text?: string | null
          summary?: string | null
          target_audience?: string | null
          tonality?: string | null
          updated_at?: string
          usps?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      clips: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string
          has_script: boolean | null
          id: string
          phase: string
          shoot_day_id: string | null
          target_month: number | null
          target_year: number | null
          title: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string
          has_script?: boolean | null
          id?: string
          phase?: string
          shoot_day_id?: string | null
          target_month?: number | null
          target_year?: number | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          has_script?: boolean | null
          id?: string
          phase?: string
          shoot_day_id?: string | null
          target_month?: number | null
          target_year?: number | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clips_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pieces: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string | null
          deadline: string | null
          has_script: boolean | null
          id: string
          phase: string
          preview_link: string | null
          priority: string | null
          shoot_day_id: string | null
          target_month: number
          target_year: number
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string | null
          deadline?: string | null
          has_script?: boolean | null
          id?: string
          phase: string
          preview_link?: string | null
          priority?: string | null
          shoot_day_id?: string | null
          target_month: number
          target_year: number
          title?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string | null
          deadline?: string | null
          has_script?: boolean | null
          id?: string
          phase?: string
          preview_link?: string | null
          priority?: string | null
          shoot_day_id?: string | null
          target_month?: number
          target_year?: number
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_pieces_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pieces_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_changes: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          client_id: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          client_id: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          client_id?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_changes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shoot_days: {
        Row: {
          client_id: string
          clip_count: number
          created_at: string
          date: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          clip_count?: number
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          clip_count?: number
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_days_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string | null
          deadline: string | null
          id: string
          is_completed: boolean | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string | null
          deadline?: string | null
          id?: string
          is_completed?: boolean | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string | null
          deadline?: string | null
          id?: string
          is_completed?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "head_of_content" | "cutter"
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
      app_role: ["admin", "head_of_content", "cutter"],
    },
  },
} as const
