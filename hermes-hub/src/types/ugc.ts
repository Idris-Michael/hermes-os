export interface UGCClient {
  id: string
  name: string
  handle: string
  email: string
  product_name: string
  product_category?: string
  brief?: string
  tone?: string
  hashtag_bank?: string[] | null
  banned_words?: string[] | null
  cta_variants?: string[] | null
  budget_gbp?: number
  spots_purchased: number
  status: 'intake' | 'approved' | 'generating' | 'delivering' | 'published'
  created_at: string
  updated_at: string
}

export interface UGCJob {
  id: string
  client_id: string
  brief: string
  hook_styles: string
  pillar?: string
  target_duration_s: number
  approval_state: 'pending' | 'generating' | 'queued' | 'approved' | 'rejected' | 'published' | 'error'
  created_at: string
  updated_at: string
}

export interface UGCVariant {
  id: string
  job_id: string
  hook_style: string
  hook_text: string
  caption: string
  script_json?: string
  render_path?: string
  thumbnail_path?: string
  created_at: string
}
