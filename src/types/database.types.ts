
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "applications": {
                  Row: {
                    "archived_at": string | null,"company": string,"created_at": string,"date_applied": string | null,"description": string | null,"follow_up_note": string | null,"id": string,"job_url": string | null,"location": string | null,"next_follow_up_on": string | null,"role_title": string,"salary_currency": string,"salary_max": number | null,"salary_min": number | null,"source": string | null,"status": string,"updated_at": string,"user_id": string,"work_mode": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"company": string,"created_at"?: string,"date_applied"?: string | null,"description"?: string | null,"follow_up_note"?: string | null,"id"?: string,"job_url"?: string | null,"location"?: string | null,"next_follow_up_on"?: string | null,"role_title": string,"salary_currency"?: string,"salary_max"?: number | null,"salary_min"?: number | null,"source"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string,"work_mode"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"company"?: string,"created_at"?: string,"date_applied"?: string | null,"description"?: string | null,"follow_up_note"?: string | null,"id"?: string,"job_url"?: string | null,"location"?: string | null,"next_follow_up_on"?: string | null,"role_title"?: string,"salary_currency"?: string,"salary_max"?: number | null,"salary_min"?: number | null,"source"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string,"work_mode"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"contacts": {
                  Row: {
                    "application_id": string,"created_at": string,"email": string | null,"id": string,"linkedin_url": string | null,"name": string,"notes": string | null,"phone": string | null,"title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"created_at"?: string,"email"?: string | null,"id"?: string,"linkedin_url"?: string | null,"name": string,"notes"?: string | null,"phone"?: string | null,"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"linkedin_url"?: string | null,"name"?: string,"notes"?: string | null,"phone"?: string | null,"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_application_fkey"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"interview_contacts": {
                  Row: {
                    "application_id": string,"contact_id": string,"created_at": string,"id": string,"interview_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"contact_id": string,"created_at"?: string,"id"?: string,"interview_id": string,"user_id"?: string
                  }
                  Update: {
                    "application_id"?: string,"contact_id"?: string,"created_at"?: string,"id"?: string,"interview_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interview_contacts_application_fkey"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "interview_contacts_contact_fkey"
      columns: ["contact_id","application_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id","application_id"]
    },{
      foreignKeyName: "interview_contacts_interview_fkey"
      columns: ["interview_id","application_id"]
isOneToOne: false
      referencedRelation: "interviews"
      referencedColumns: ["id","application_id"]
    }
                  ]
                },"interviews": {
                  Row: {
                    "application_id": string,"created_at": string,"duration_minutes": number | null,"id": string,"interviewers": string | null,"kind": string,"location": string | null,"notes": string | null,"outcome": string,"scheduled_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"created_at"?: string,"duration_minutes"?: number | null,"id"?: string,"interviewers"?: string | null,"kind": string,"location"?: string | null,"notes"?: string | null,"outcome"?: string,"scheduled_at": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"duration_minutes"?: number | null,"id"?: string,"interviewers"?: string | null,"kind"?: string,"location"?: string | null,"notes"?: string | null,"outcome"?: string,"scheduled_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interviews_application_fkey"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "application_id": string,"body": string,"created_at": string,"id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"body": string,"created_at"?: string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "application_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_application_fkey"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"time_zone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"time_zone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"time_zone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"status_events": {
                  Row: {
                    "application_id": string,"changed_at": string,"created_at": string,"from_status": string | null,"id": string,"to_status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"changed_at"?: string,"created_at"?: string,"from_status"?: string | null,"id"?: string,"to_status": string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"changed_at"?: string,"created_at"?: string,"from_status"?: string | null,"id"?: string,"to_status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "status_events_application_fkey"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "stats_applied_per_day":
{ Args: { "from_day": string,"include_archived": boolean,"until_day": string }; Returns: {
              "applications": number,"day": string
            }[]
                           },
"stats_response_counts":
{ Args: { "include_archived": boolean,"reached_statuses": (string)[],"responded_statuses": (string)[] }; Returns: {
              "reached": number,"responded": number
            }[]
                           },
"stats_stage_durations":
{ Args: { "include_archived": boolean }; Returns: {
              "average_days": number,"status": string,"stays": number
            }[]
                           },
"stats_status_counts":
{ Args: { "include_archived": boolean }; Returns: {
              "applications": number,"status": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
