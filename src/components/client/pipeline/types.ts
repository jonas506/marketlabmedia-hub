export interface ContentPiece {
  id: string;
  client_id: string;
  shoot_day_id: string | null;
  type: string;
  title: string | null;
  assigned_to: string | null;
  phase: string;
  target_month: number;
  target_year: number;
  has_script: boolean;
  preview_link?: string | null;
  deadline?: string | null;
  priority?: string | null;
  client_comment?: string | null;
  script_text?: string | null;
  transcript?: string | null;
  caption?: string | null;
  video_path?: string | null;
  cta_label?: string | null;
  tag?: string | null;
  scheduled_post_date?: string | null;
  slide_images?: string[] | null;
  team_reply?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface TeamMember {
  user_id: string;
  name: string | null;
  email: string | null;
}

export interface PipelineConfig {
  label: string;
  emoji: string;
  phases: { key: string; label: string; emoji: string }[];
  addLabel: string;
}

export interface MonthOption {
  month: number;
  year: number;
  label: string;
}

export interface PriorityOption {
  value: string;
  label: string;
  color: string;
  bg: string;
}
