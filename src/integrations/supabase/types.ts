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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          client_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          field_name: string | null
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          field_name?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_name?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      board_source_files: {
        Row: {
          board_id: string
          created_at: string
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string
          id?: string
        }
        Update: {
          board_id?: string
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_source_files_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "strategy_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          preview_image: string | null
          template_data: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          preview_image?: string | null
          template_data?: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          preview_image?: string | null
          template_data?: Json
        }
        Relationships: []
      }
      cb_brands: {
        Row: {
          colors: string[]
          created_at: string
          description: string | null
          guides: string[]
          id: string
          logos: string[]
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          colors?: string[]
          created_at?: string
          description?: string | null
          guides?: string[]
          id?: string
          logos?: string[]
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          colors?: string[]
          created_at?: string
          description?: string | null
          guides?: string[]
          id?: string
          logos?: string[]
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cb_projects: {
        Row: {
          connections: Json
          created_at: string
          id: string
          name: string
          nodes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          connections?: Json
          created_at?: string
          id?: string
          name?: string
          nodes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          connections?: Json
          created_at?: string
          id?: string
          name?: string
          nodes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cb_reel_ideas: {
        Row: {
          created_at: string
          id: string
          ideas: Json
          niche: string | null
          sources: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ideas?: Json
          niche?: string | null
          sources?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ideas?: Json
          niche?: string | null
          sources?: string[]
          user_id?: string
        }
        Relationships: []
      }
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
      checklist_steps: {
        Row: {
          assigned_to: string | null
          checklist_id: string
          completed_at: string | null
          description: string | null
          id: string
          is_completed: boolean
          sort_order: number
          title: string
        }
        Insert: {
          assigned_to?: string | null
          checklist_id: string
          completed_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          assigned_to?: string | null
          checklist_id?: string
          completed_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_steps_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          category: string | null
          client_id: string
          created_at: string
          id: string
          month: number | null
          name: string
          status: string
          template_id: string | null
          year: number | null
        }
        Insert: {
          category?: string | null
          client_id: string
          created_at?: string
          id?: string
          month?: number | null
          name: string
          status?: string
          template_id?: string | null
          year?: number | null
        }
        Update: {
          category?: string | null
          client_id?: string
          created_at?: string
          id?: string
          month?: number | null
          name?: string
          status?: string
          template_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checklists_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sop_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_ai_messages: {
        Row: {
          client_id: string
          content: string
          created_at: string
          id: string
          mode: string | null
          role: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          id?: string
          mode?: string | null
          role?: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          mode?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_ai_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_inspirations: {
        Row: {
          ai_analysis: string | null
          category: string
          client_id: string
          created_at: string
          id: string
          month: number | null
          notes: string
          screenshot_url: string | null
          tags: string[]
          title: string
          updated_at: string
          url: string | null
          week_number: number | null
          year: number | null
        }
        Insert: {
          ai_analysis?: string | null
          category?: string
          client_id: string
          created_at?: string
          id?: string
          month?: number | null
          notes?: string
          screenshot_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          url?: string | null
          week_number?: number | null
          year?: number | null
        }
        Update: {
          ai_analysis?: string | null
          category?: string
          client_id?: string
          created_at?: string
          id?: string
          month?: number | null
          notes?: string
          screenshot_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          url?: string | null
          week_number?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_inspirations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_knowledge: {
        Row: {
          category: string
          client_id: string
          content: string
          created_at: string
          id: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          client_id: string
          content: string
          created_at?: string
          id?: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_knowledge_client_id_fkey"
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
          approval_token: string | null
          brand_accent: string | null
          brand_font_style: string | null
          brand_primary: string | null
          brand_secondary: string | null
          brand_text_dark: string | null
          brand_text_light: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          content_topics: string | null
          contract_duration: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string
          drive_branding_link: string | null
          drive_logo_link: string | null
          drive_styleguide_link: string | null
          id: string
          industry: string | null
          instagram_handle: string | null
          logo_url: string | null
          monthly_carousels: number
          monthly_price: number | null
          monthly_reels: number
          monthly_stories: number
          monthly_youtube_longform: number
          name: string
          review_notify_emails: string[]
          sector: string | null
          services: string[]
          show_marketing_approval: boolean
          status: string
          strategy_text: string | null
          summary: string | null
          target_audience: string | null
          tiktok_handle: string | null
          tonality: string | null
          updated_at: string
          usps: string | null
          website_url: string | null
          youtube_channel_id: string | null
        }
        Insert: {
          additional_products?: string[] | null
          approval_token?: string | null
          brand_accent?: string | null
          brand_font_style?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          brand_text_dark?: string | null
          brand_text_light?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          content_topics?: string | null
          contract_duration?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          drive_branding_link?: string | null
          drive_logo_link?: string | null
          drive_styleguide_link?: string | null
          id?: string
          industry?: string | null
          instagram_handle?: string | null
          logo_url?: string | null
          monthly_carousels?: number
          monthly_price?: number | null
          monthly_reels?: number
          monthly_stories?: number
          monthly_youtube_longform?: number
          name: string
          review_notify_emails?: string[]
          sector?: string | null
          services?: string[]
          show_marketing_approval?: boolean
          status?: string
          strategy_text?: string | null
          summary?: string | null
          target_audience?: string | null
          tiktok_handle?: string | null
          tonality?: string | null
          updated_at?: string
          usps?: string | null
          website_url?: string | null
          youtube_channel_id?: string | null
        }
        Update: {
          additional_products?: string[] | null
          approval_token?: string | null
          brand_accent?: string | null
          brand_font_style?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          brand_text_dark?: string | null
          brand_text_light?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          content_topics?: string | null
          contract_duration?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          drive_branding_link?: string | null
          drive_logo_link?: string | null
          drive_styleguide_link?: string | null
          id?: string
          industry?: string | null
          instagram_handle?: string | null
          logo_url?: string | null
          monthly_carousels?: number
          monthly_price?: number | null
          monthly_reels?: number
          monthly_stories?: number
          monthly_youtube_longform?: number
          name?: string
          review_notify_emails?: string[]
          sector?: string | null
          services?: string[]
          show_marketing_approval?: boolean
          status?: string
          strategy_text?: string | null
          summary?: string | null
          target_audience?: string | null
          tiktok_handle?: string | null
          tonality?: string | null
          updated_at?: string
          usps?: string | null
          website_url?: string | null
          youtube_channel_id?: string | null
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
      content_piece_comments: {
        Row: {
          client_id: string
          comment_text: string
          content_piece_id: string
          created_at: string
          id: string
          timestamp_seconds: number | null
        }
        Insert: {
          client_id: string
          comment_text: string
          content_piece_id: string
          created_at?: string
          id?: string
          timestamp_seconds?: number | null
        }
        Update: {
          client_id?: string
          comment_text?: string
          content_piece_id?: string
          created_at?: string
          id?: string
          timestamp_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_piece_comments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_piece_comments_content_piece_id_fkey"
            columns: ["content_piece_id"]
            isOneToOne: false
            referencedRelation: "content_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pieces: {
        Row: {
          assigned_to: string | null
          caption: string | null
          client_comment: string | null
          client_id: string
          created_at: string | null
          cta_label: string | null
          deadline: string | null
          has_script: boolean | null
          id: string
          phase: string
          preview_link: string | null
          priority: string | null
          revision_count: number
          scheduled_post_date: string | null
          script_links: Json | null
          script_text: string | null
          shoot_day_id: string | null
          slide_images: string[] | null
          tag: string | null
          target_month: number
          target_year: number
          team_reply: string | null
          title: string | null
          transcript: string | null
          type: string
          updated_at: string | null
          video_path: string | null
        }
        Insert: {
          assigned_to?: string | null
          caption?: string | null
          client_comment?: string | null
          client_id: string
          created_at?: string | null
          cta_label?: string | null
          deadline?: string | null
          has_script?: boolean | null
          id?: string
          phase: string
          preview_link?: string | null
          priority?: string | null
          revision_count?: number
          scheduled_post_date?: string | null
          script_links?: Json | null
          script_text?: string | null
          shoot_day_id?: string | null
          slide_images?: string[] | null
          tag?: string | null
          target_month: number
          target_year: number
          team_reply?: string | null
          title?: string | null
          transcript?: string | null
          type: string
          updated_at?: string | null
          video_path?: string | null
        }
        Update: {
          assigned_to?: string | null
          caption?: string | null
          client_comment?: string | null
          client_id?: string
          created_at?: string | null
          cta_label?: string | null
          deadline?: string | null
          has_script?: boolean | null
          id?: string
          phase?: string
          preview_link?: string | null
          priority?: string | null
          revision_count?: number
          scheduled_post_date?: string | null
          script_links?: Json | null
          script_text?: string | null
          shoot_day_id?: string | null
          slide_images?: string[] | null
          tag?: string | null
          target_month?: number
          target_year?: number
          team_reply?: string | null
          title?: string | null
          transcript?: string | null
          type?: string
          updated_at?: string | null
          video_path?: string | null
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
      contingent_extras: {
        Row: {
          client_id: string
          created_at: string | null
          extra_count: number
          id: string
          target_month: number
          target_year: number
          type: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          extra_count?: number
          id?: string
          target_month: number
          target_year: number
          type: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          extra_count?: number
          id?: string
          target_month?: number
          target_year?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contingent_extras_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      crm_activities: {
        Row: {
          ai_extracted: boolean | null
          body: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          file_urls: string[] | null
          id: string
          lead_id: string
          metadata: Json | null
          title: string
          type: Database["public"]["Enums"]["crm_activity_type"]
        }
        Insert: {
          ai_extracted?: boolean | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          file_urls?: string[] | null
          id?: string
          lead_id: string
          metadata?: Json | null
          title: string
          type: Database["public"]["Enums"]["crm_activity_type"]
        }
        Update: {
          ai_extracted?: boolean | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          file_urls?: string[] | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          title?: string
          type?: Database["public"]["Enums"]["crm_activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaign_entries: {
        Row: {
          appointments: number
          campaign_id: string
          closings: number
          created_at: string
          id: string
          messages_sent: number
          notes: string | null
          replies: number
          revenue: number | null
          second_appointments: number
          week_start: string
        }
        Insert: {
          appointments?: number
          campaign_id: string
          closings?: number
          created_at?: string
          id?: string
          messages_sent?: number
          notes?: string | null
          replies?: number
          revenue?: number | null
          second_appointments?: number
          week_start: string
        }
        Update: {
          appointments?: number
          campaign_id?: string
          closings?: number
          created_at?: string
          id?: string
          messages_sent?: number
          notes?: string | null
          replies?: number
          revenue?: number | null
          second_appointments?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          channel: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          lead_id: string
          phone: string | null
          position: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          lead_id: string
          phone?: string | null
          position?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          lead_id?: string
          phone?: string | null
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_emails: {
        Row: {
          body_preview: string | null
          contact_id: string | null
          date: string
          direction: Database["public"]["Enums"]["crm_email_direction"]
          from_email: string
          gmail_message_id: string | null
          id: string
          is_read: boolean
          lead_id: string | null
          snippet: string | null
          subject: string
          synced_at: string
          thread_id: string | null
          to_email: string
        }
        Insert: {
          body_preview?: string | null
          contact_id?: string | null
          date?: string
          direction?: Database["public"]["Enums"]["crm_email_direction"]
          from_email: string
          gmail_message_id?: string | null
          id?: string
          is_read?: boolean
          lead_id?: string | null
          snippet?: string | null
          subject?: string
          synced_at?: string
          thread_id?: string | null
          to_email: string
        }
        Update: {
          body_preview?: string | null
          contact_id?: string | null
          date?: string
          direction?: Database["public"]["Enums"]["crm_email_direction"]
          from_email?: string
          gmail_message_id?: string | null
          id?: string
          is_read?: boolean
          lead_id?: string | null
          snippet?: string | null
          subject?: string
          synced_at?: string
          thread_id?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_files: {
        Row: {
          created_at: string
          file_size: number
          file_url: string
          id: string
          lead_id: string
          mime_type: string
          name: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_size?: number
          file_url: string
          id?: string
          lead_id: string
          mime_type?: string
          name: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_size?: number
          file_url?: string
          id?: string
          lead_id?: string
          mime_type?: string
          name?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          ai_summary: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          deal_value: number | null
          description: string | null
          id: string
          instagram_handle: string | null
          last_activity_at: string | null
          linkedin_url: string | null
          name: string
          next_step: string | null
          next_step_date: string | null
          notes: string | null
          source: string | null
          stage: string
          status_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          ai_summary?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          deal_value?: number | null
          description?: string | null
          id?: string
          instagram_handle?: string | null
          last_activity_at?: string | null
          linkedin_url?: string | null
          name: string
          next_step?: string | null
          next_step_date?: string | null
          notes?: string | null
          source?: string | null
          stage?: string
          status_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          ai_summary?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          deal_value?: number | null
          description?: string | null
          id?: string
          instagram_handle?: string | null
          last_activity_at?: string | null
          linkedin_url?: string | null
          name?: string
          next_step?: string | null
          next_step_date?: string | null
          notes?: string | null
          source?: string | null
          stage?: string
          status_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          lead_id: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          closed_at: string | null
          contact_id: string | null
          created_at: string
          currency: string
          expected_close_date: string | null
          id: string
          lead_id: string
          note: string | null
          pipeline_id: string
          stage_id: string
          updated_at: string
          value: number
        }
        Insert: {
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          lead_id: string
          note?: string | null
          pipeline_id: string
          stage_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          lead_id?: string
          note?: string | null
          pipeline_id?: string
          stage_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string
          sort_order: number
          win_probability: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          sort_order?: number
          win_probability?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          sort_order?: number
          win_probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      crm_smart_views: {
        Row: {
          created_at: string
          created_by: string
          filters: Json
          id: string
          is_shared: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          filters?: Json
          id?: string
          is_shared?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          filters?: Json
          id?: string
          is_shared?: boolean
          name?: string
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          is_completed: boolean
          lead_id: string | null
          title: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_completed?: boolean
          lead_id?: string | null
          title: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_completed?: boolean
          lead_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_plans: {
        Row: {
          blocks: Json
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      follower_snapshots: {
        Row: {
          client_id: string
          created_at: string
          follower_count: number
          id: string
          platform: string
          snapshot_date: string
        }
        Insert: {
          client_id: string
          created_at?: string
          follower_count: number
          id?: string
          platform: string
          snapshot_date?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          follower_count?: number
          id?: string
          platform?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "follower_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          html_content: string
          id: string
          name: string
          preview_image_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          html_content?: string
          id?: string
          name: string
          preview_image_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          html_content?: string
          id?: string
          name?: string
          preview_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      landing_pages: {
        Row: {
          chat_history: Json | null
          client_id: string
          created_at: string
          custom_domain: string | null
          edit_url: string | null
          html_content: string | null
          id: string
          is_published: boolean
          published_url: string | null
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          chat_history?: Json | null
          client_id: string
          created_at?: string
          custom_domain?: string | null
          edit_url?: string | null
          html_content?: string | null
          id?: string
          is_published?: boolean
          published_url?: string | null
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          chat_history?: Json | null
          client_id?: string
          created_at?: string
          custom_domain?: string | null
          edit_url?: string | null
          html_content?: string | null
          id?: string
          is_published?: boolean
          published_url?: string | null
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_tracking: {
        Row: {
          ad_spend: number | null
          appointments_attended: number | null
          appointments_booked: number | null
          appointments_total: number | null
          client_id: string
          closing_rate: number | null
          closings: number | null
          cost_per_appointment: number | null
          cost_per_follower: number | null
          created_at: string
          dm_sent: number | null
          id: string
          new_conversations: number | null
          new_followers: number | null
          notes: string | null
          offer_quote: number | null
          offers_presented: number | null
          revenue_net: number | null
          sales_today: number | null
          show_rate: number | null
          tracking_date: string
          updated_at: string
        }
        Insert: {
          ad_spend?: number | null
          appointments_attended?: number | null
          appointments_booked?: number | null
          appointments_total?: number | null
          client_id: string
          closing_rate?: number | null
          closings?: number | null
          cost_per_appointment?: number | null
          cost_per_follower?: number | null
          created_at?: string
          dm_sent?: number | null
          id?: string
          new_conversations?: number | null
          new_followers?: number | null
          notes?: string | null
          offer_quote?: number | null
          offers_presented?: number | null
          revenue_net?: number | null
          sales_today?: number | null
          show_rate?: number | null
          tracking_date?: string
          updated_at?: string
        }
        Update: {
          ad_spend?: number | null
          appointments_attended?: number | null
          appointments_booked?: number | null
          appointments_total?: number | null
          client_id?: string
          closing_rate?: number | null
          closings?: number | null
          cost_per_appointment?: number | null
          cost_per_follower?: number | null
          created_at?: string
          dm_sent?: number | null
          id?: string
          new_conversations?: number | null
          new_followers?: number | null
          notes?: string | null
          offer_quote?: number | null
          offers_presented?: number | null
          revenue_net?: number | null
          sales_today?: number | null
          show_rate?: number | null
          tracking_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          slack_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          slack_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          slack_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_notification_queue: {
        Row: {
          client_id: string
          content_piece_id: string
          created_at: string
          id: string
          piece_title: string | null
          piece_type: string | null
          sent_at: string | null
        }
        Insert: {
          client_id: string
          content_piece_id: string
          created_at?: string
          id?: string
          piece_title?: string | null
          piece_type?: string | null
          sent_at?: string | null
        }
        Update: {
          client_id?: string
          content_piece_id?: string
          created_at?: string
          id?: string
          piece_title?: string | null
          piece_type?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_notification_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_notification_queue_content_piece_id_fkey"
            columns: ["content_piece_id"]
            isOneToOne: false
            referencedRelation: "content_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_prompts: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          prompt_text: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          prompt_text: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          prompt_text?: string
          updated_at?: string
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
      sop_template_steps: {
        Row: {
          created_at: string
          default_role: string | null
          description: string | null
          id: string
          sort_order: number
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          default_role?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          default_role?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sop_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_templates: {
        Row: {
          board_data: Json | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          trigger_type: string | null
          updated_at: string
        }
        Insert: {
          board_data?: Json | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          trigger_type?: string | null
          updated_at?: string
        }
        Update: {
          board_data?: Json | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          trigger_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      story_categories: {
        Row: {
          client_id: string
          color: string
          created_at: string | null
          id: string
          name: string
          scope: string
        }
        Insert: {
          client_id: string
          color?: string
          created_at?: string | null
          id?: string
          name: string
          scope?: string
        }
        Update: {
          client_id?: string
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_categories_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      story_sequence_tracking: {
        Row: {
          created_at: string | null
          id: string
          keyword_triggers: number | null
          notes: string | null
          screenshot_urls: string[] | null
          sequence_id: string
          total_link_clicks: number | null
          total_profile_visits: number | null
          total_replies: number | null
          total_views: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword_triggers?: number | null
          notes?: string | null
          screenshot_urls?: string[] | null
          sequence_id: string
          total_link_clicks?: number | null
          total_profile_visits?: number | null
          total_replies?: number | null
          total_views?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword_triggers?: number | null
          notes?: string | null
          screenshot_urls?: string[] | null
          sequence_id?: string
          total_link_clicks?: number | null
          total_profile_visits?: number | null
          total_replies?: number | null
          total_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "story_sequence_tracking_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: true
            referencedRelation: "story_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      story_sequences: {
        Row: {
          category_id: string | null
          client_id: string
          created_at: string | null
          id: string
          notes: string | null
          parent_sequence_id: string | null
          posted_at: string | null
          status: string
          title: string
          version: number
        }
        Insert: {
          category_id?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_sequence_id?: string | null
          posted_at?: string | null
          status?: string
          title: string
          version?: number
        }
        Update: {
          category_id?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_sequence_id?: string | null
          posted_at?: string | null
          status?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "story_sequences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "story_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_sequences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_sequences_parent_sequence_id_fkey"
            columns: ["parent_sequence_id"]
            isOneToOne: false
            referencedRelation: "story_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      story_slides: {
        Row: {
          category_id: string | null
          content_text: string
          created_at: string | null
          id: string
          image_url: string | null
          sequence_id: string
          slide_clicks: number | null
          slide_replies: number | null
          slide_type: string
          slide_views: number | null
          sort_order: number
        }
        Insert: {
          category_id?: string | null
          content_text?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          sequence_id: string
          slide_clicks?: number | null
          slide_replies?: number | null
          slide_type?: string
          slide_views?: number | null
          sort_order?: number
        }
        Update: {
          category_id?: string | null
          content_text?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          sequence_id?: string
          slide_clicks?: number | null
          slide_replies?: number | null
          slide_type?: string
          slide_views?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "story_slides_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "story_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_slides_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "story_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_boards: {
        Row: {
          ai_generated: boolean | null
          board_data: Json
          chat_history: Json | null
          client_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          share_token: string | null
          sources: Json | null
          template_type: string | null
          thumbnail: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          board_data?: Json
          chat_history?: Json | null
          client_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          share_token?: string | null
          sources?: Json | null
          template_type?: string | null
          thumbnail?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          board_data?: Json
          chat_history?: Json | null
          client_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          share_token?: string | null
          sources?: Json | null
          template_type?: string | null
          thumbnail?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_boards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string
          completed_at: string | null
          completed_by: string | null
          content_piece_id: string | null
          created_at: string | null
          created_by: string | null
          deadline: string | null
          description: string | null
          due_time: string | null
          group_source: string | null
          id: string
          is_completed: boolean | null
          notes: string | null
          parent_id: string | null
          priority: string | null
          sort_order: number | null
          status: string | null
          tag: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          content_piece_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          due_time?: string | null
          group_source?: string | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          parent_id?: string | null
          priority?: string | null
          sort_order?: number | null
          status?: string | null
          tag?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          content_piece_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          due_time?: string | null
          group_source?: string | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          parent_id?: string | null
          priority?: string | null
          sort_order?: number | null
          status?: string | null
          tag?: string | null
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
          {
            foreignKeyName: "tasks_content_piece_id_fkey"
            columns: ["content_piece_id"]
            isOneToOne: false
            referencedRelation: "content_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          activity_type: string
          client_id: string | null
          created_at: string
          date: string
          end_time: string | null
          entry_mode: string
          hours: number
          id: string
          note: string | null
          start_time: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          client_id?: string | null
          created_at?: string
          date: string
          end_time?: string | null
          entry_mode?: string
          hours: number
          id?: string
          note?: string | null
          start_time?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          client_id?: string | null
          created_at?: string
          date?: string
          end_time?: string | null
          entry_mode?: string
          hours?: number
          id?: string
          note?: string | null
          start_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_expense_reports: {
        Row: {
          created_at: string
          grand_total: number | null
          id: string
          month: number
          pdf_url: string | null
          sent_at: string | null
          status: string
          total_extras: number | null
          total_km: number | null
          total_meals: number | null
          total_overnight: number | null
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          grand_total?: number | null
          id?: string
          month: number
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          total_extras?: number | null
          total_km?: number | null
          total_meals?: number | null
          total_overnight?: number | null
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          grand_total?: number | null
          id?: string
          month?: number
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          total_extras?: number | null
          total_km?: number | null
          total_meals?: number | null
          total_overnight?: number | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      travel_expenses: {
        Row: {
          created_at: string
          departure_date: string
          departure_time: string
          destination: string
          extras_amount: number | null
          extras_description: string | null
          id: string
          km_driven: number | null
          km_rate: number | null
          meals_total: number | null
          month: number
          note: string | null
          overnight_count: number | null
          overnight_rate: number | null
          purpose: string
          return_date: string
          return_time: string
          status: string
          total_amount: number | null
          transport: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          departure_date: string
          departure_time: string
          destination: string
          extras_amount?: number | null
          extras_description?: string | null
          id?: string
          km_driven?: number | null
          km_rate?: number | null
          meals_total?: number | null
          month: number
          note?: string | null
          overnight_count?: number | null
          overnight_rate?: number | null
          purpose: string
          return_date: string
          return_time: string
          status?: string
          total_amount?: number | null
          transport: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          departure_date?: string
          departure_time?: string
          destination?: string
          extras_amount?: number | null
          extras_description?: string | null
          id?: string
          km_driven?: number | null
          km_rate?: number | null
          meals_total?: number | null
          month?: number
          note?: string | null
          overnight_count?: number | null
          overnight_rate?: number | null
          purpose?: string
          return_date?: string
          return_time?: string
          status?: string
          total_amount?: number | null
          transport?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
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
      vacation_budgets: {
        Row: {
          carry_over_days: number
          id: string
          total_days: number
          user_id: string
          year: number
        }
        Insert: {
          carry_over_days?: number
          id?: string
          total_days: number
          user_id: string
          year: number
        }
        Update: {
          carry_over_days?: number
          id?: string
          total_days?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          created_at: string
          days: number
          end_date: string
          id: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days: number
          end_date: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_client_piece_comment: {
        Args: {
          _comment: string
          _piece_id: string
          _timestamp_seconds?: number
          _token: string
        }
        Returns: Json
      }
      cleanup_old_activity_logs: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      create_sop_tasks_for_trigger: {
        Args: { p_client_id: string; p_context?: Json; p_trigger_type: string }
        Returns: undefined
      }
      delete_client_piece_comment: {
        Args: { _comment_id: string; _token: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_client_approval_data: { Args: { _token: string }; Returns: Json }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      submit_client_piece_review: {
        Args: {
          _action: string
          _comment?: string
          _comments?: Json
          _piece_id: string
          _token: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "head_of_content" | "cutter"
      crm_activity_type:
        | "note"
        | "call"
        | "email"
        | "sms"
        | "status_change"
        | "opportunity_change"
        | "task_completed"
        | "created"
      crm_email_direction: "inbound" | "outbound"
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
      crm_activity_type: [
        "note",
        "call",
        "email",
        "sms",
        "status_change",
        "opportunity_change",
        "task_completed",
        "created",
      ],
      crm_email_direction: ["inbound", "outbound"],
    },
  },
} as const
