export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: AppRole
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: AppRole
          created_at?: string
          created_by?: string | null
        }
        Update: {
          role?: AppRole
        }
      }
      academic_years: {
        Row: {
          id: string
          year: number
          label: string
          is_current: boolean
          start_date: string | null
          end_date: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          year: number
          label: string
          is_current?: boolean
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          year?: number
          label?: string
          is_current?: boolean
          start_date?: string | null
          end_date?: string | null
        }
      }
      modalities: {
        Row: {
          id: string
          code: string
          name: string
          max_year: number
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          max_year: number
          created_at?: string
        }
        Update: {
          code?: string
          name?: string
          max_year?: number
        }
      }
      orientations: {
        Row: {
          id: string
          modality_id: string
          code: string
          name: string
          min_year: number
          max_year: number
          created_at: string
        }
        Insert: {
          id?: string
          modality_id: string
          code: string
          name: string
          min_year: number
          max_year: number
          created_at?: string
        }
        Update: {
          code?: string
          name?: string
          min_year?: number
          max_year?: number
        }
      }
      subjects: {
        Row: {
          id: string
          name: string
          normalized_name: string
          orientation_id: string | null
          modality_id: string | null
          year_level: number | null
          hours_per_week: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          normalized_name?: string
          orientation_id?: string | null
          modality_id?: string | null
          year_level?: number | null
          hours_per_week?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          normalized_name?: string
          orientation_id?: string | null
          modality_id?: string | null
          year_level?: number | null
          hours_per_week?: number | null
          is_active?: boolean
          updated_at?: string
        }
      }
      teachers: {
        Row: {
          id: string
          user_id: string | null
          dni: string
          full_name: string
          email: string | null
          phone: string | null
          status: TeacherStatus
          registration_code: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          dni: string
          full_name: string
          email?: string | null
          phone?: string | null
          status?: TeacherStatus
          registration_code?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          user_id?: string | null
          email?: string | null
          phone?: string | null
          status?: TeacherStatus
          registration_code?: string | null
          updated_at?: string
        }
      }
      students: {
        Row: {
          id: string
          dni: string
          full_name: string
          birth_date: string | null
          birth_place: string | null
          address: string | null
          phone: string | null
          email: string | null
          enrollment_date: string | null
          previous_school: string | null
          status: StudentStatus
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          dni: string
          full_name: string
          birth_date?: string | null
          birth_place?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          enrollment_date?: string | null
          previous_school?: string | null
          status?: StudentStatus
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          full_name?: string
          birth_date?: string | null
          birth_place?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          status?: StudentStatus
          notes?: string | null
          updated_at?: string
        }
      }
      course_sections: {
        Row: {
          id: string
          academic_year_id: string
          modality_id: string
          orientation_id: string | null
          year_level: number
          division: string
          shift: Shift
          is_active: boolean
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          academic_year_id: string
          modality_id: string
          orientation_id?: string | null
          year_level: number
          division: string
          shift: Shift
          is_active?: boolean
          created_at?: string
          created_by?: string | null
        }
        Update: {
          modality_id?: string
          orientation_id?: string | null
          year_level?: number
          division?: string
          shift?: Shift
          is_active?: boolean
        }
      }
      teacher_assignments: {
        Row: {
          id: string
          teacher_id: string
          course_section_id: string
          subject_id: string
          academic_year_id: string
          is_active: boolean
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          teacher_id: string
          course_section_id: string
          subject_id: string
          academic_year_id: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
        }
        Update: {
          is_active?: boolean
        }
      }
      student_enrollments: {
        Row: {
          id: string
          student_id: string
          course_section_id: string
          academic_year_id: string
          enrollment_number: number | null
          is_active: boolean
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          student_id: string
          course_section_id: string
          academic_year_id: string
          enrollment_number?: number | null
          is_active?: boolean
          created_at?: string
          created_by?: string | null
        }
        Update: {
          is_active?: boolean
          enrollment_number?: number | null
        }
      }
      grading_periods: {
        Row: {
          id: string
          academic_year_id: string
          name: string
          code: GradingPeriodCode
          order_index: number
          open_date: string | null
          close_date: string | null
          status: PeriodStatus
          closed_by: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          academic_year_id: string
          name: string
          code: GradingPeriodCode
          order_index: number
          open_date?: string | null
          close_date?: string | null
          status?: PeriodStatus
          closed_by?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          name?: string
          open_date?: string | null
          close_date?: string | null
          status?: PeriodStatus
          closed_by?: string | null
          closed_at?: string | null
        }
      }
      grades: {
        Row: {
          id: string
          student_enrollment_id: string
          subject_id: string
          grading_period_id: string
          teacher_assignment_id: string
          score: number | null
          observation: string | null
          status: GradeStatus
          submitted_at: string | null
          confirmed_at: string | null
          created_at: string
          updated_at: string
          created_by: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          student_enrollment_id: string
          subject_id: string
          grading_period_id: string
          teacher_assignment_id: string
          score?: number | null
          observation?: string | null
          status?: GradeStatus
          submitted_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
          updated_by?: string | null
        }
        Update: {
          score?: number | null
          observation?: string | null
          status?: GradeStatus
          submitted_at?: string | null
          confirmed_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_value: Json | null
          new_value: Json | null
          reason: string | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          reason?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Update: never
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_id: string }
        Returns: AppRole | null
      }
    }
    Enums: {
      app_role: 'admin' | 'directivo' | 'preceptor' | 'docente'
      teacher_status: 'pending_registration' | 'pending_approval' | 'active' | 'inactive'
      student_status: 'active' | 'graduated' | 'transferred' | 'dropped' | 'pending_docs'
      shift: 'M' | 'T' | 'N'
      grading_period_code: 'T1' | 'T2' | 'T3' | 'FINAL' | 'RECOVERY'
      period_status: 'open' | 'under_review' | 'closed' | 'reopened'
      grade_status: 'draft' | 'confirmed' | 'under_review' | 'closed' | 'reopened'
    }
  }
}

// Convenience type aliases
export type AppRole = 'admin' | 'directivo' | 'preceptor' | 'docente'
export type TeacherStatus = 'pending_registration' | 'pending_approval' | 'active' | 'inactive'
export type StudentStatus = 'active' | 'graduated' | 'transferred' | 'dropped' | 'pending_docs'
export type Shift = 'M' | 'T' | 'N'
export type GradingPeriodCode = 'T1' | 'T2' | 'T3' | 'FINAL' | 'RECOVERY'
export type PeriodStatus = 'open' | 'under_review' | 'closed' | 'reopened'
export type GradeStatus = 'draft' | 'confirmed' | 'under_review' | 'closed' | 'reopened'

// Row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type AcademicYear = Database['public']['Tables']['academic_years']['Row']
export type Modality = Database['public']['Tables']['modalities']['Row']
export type Orientation = Database['public']['Tables']['orientations']['Row']
export type Subject = Database['public']['Tables']['subjects']['Row']
export type Teacher = Database['public']['Tables']['teachers']['Row']
export type Student = Database['public']['Tables']['students']['Row']
export type CourseSection = Database['public']['Tables']['course_sections']['Row']
export type TeacherAssignment = Database['public']['Tables']['teacher_assignments']['Row']
export type StudentEnrollment = Database['public']['Tables']['student_enrollments']['Row']
export type GradingPeriod = Database['public']['Tables']['grading_periods']['Row']
export type Grade = Database['public']['Tables']['grades']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']

// UI helpers
export const SHIFT_LABELS: Record<Shift, string> = {
  M: 'Mañana',
  T: 'Tarde',
  N: 'Noche',
}

export const GRADE_STATUS_LABELS: Record<GradeStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  under_review: 'En revisión',
  closed: 'Cerrada',
  reopened: 'Reabierta',
}

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  open: 'Abierto',
  under_review: 'En revisión',
  closed: 'Cerrado',
  reopened: 'Reabierto',
}

export const GRADING_PERIOD_LABELS: Record<GradingPeriodCode, string> = {
  T1: '1° Trimestre',
  T2: '2° Trimestre',
  T3: '3° Trimestre',
  FINAL: 'Calificación Final',
  RECOVERY: 'Recuperación',
}

export const TEACHER_STATUS_LABELS: Record<TeacherStatus, string> = {
  pending_registration: 'Pendiente de registro',
  pending_approval: 'Pendiente de aprobación',
  active: 'Activo',
  inactive: 'Inactivo',
}

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: 'Activo',
  graduated: 'Egresado',
  transferred: 'Trasladado',
  dropped: 'Baja',
  pending_docs: 'Pendiente de documentación',
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  directivo: 'Directivo',
  preceptor: 'Preceptor',
  docente: 'Docente',
}
