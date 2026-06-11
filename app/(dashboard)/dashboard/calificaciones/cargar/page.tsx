import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GradeEntryGrid from './GradeEntryGrid'
import { AlertTriangle, Lock } from 'lucide-react'

type PageProps = {
  searchParams: Promise<{ assignment?: string; period?: string }>
}

export default async function CargarCalificacionesPage({ searchParams }: PageProps) {
  const { assignment: assignmentId, period: periodId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!assignmentId) redirect('/dashboard/calificaciones')

  // Verify teacher owns this assignment
  const { data: teacher } = await supabase
    .from('teachers').select('id').eq('user_id', user.id).single()

  if (!teacher) {
    return <div className="p-6 text-red-600">Sin perfil docente vinculado.</div>
  }

  const { data: assignment } = await supabase
    .from('teacher_assignments')
    .select(`
      id, is_active,
      teacher_id,
      course_sections (
        id, year_level, division, shift, academic_year_id,
        modalities (name), orientations (name)
      ),
      subjects (id, name)
    `)
    .eq('id', assignmentId)
    .eq('teacher_id', teacher.id)
    .single()

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
        <p className="font-medium text-slate-700">Asignación no encontrada</p>
        <p className="text-slate-500 text-sm">No tenés permiso para acceder a esta asignación.</p>
      </div>
    )
  }

  const section = assignment.course_sections as any
  const subject = assignment.subjects as any

  // Get grading period
  const { data: period } = await supabase
    .from('grading_periods')
    .select('*')
    .eq('id', periodId ?? '')
    .single()

  // Fallback: get open period for this year
  const { data: openPeriod } = !period ? await supabase
    .from('grading_periods')
    .select('*')
    .eq('academic_year_id', section.academic_year_id)
    .eq('status', 'open')
    .order('order_index')
    .limit(1)
    .single() : { data: null }

  const activePeriod = period ?? openPeriod

  if (!activePeriod) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Lock className="w-10 h-10 text-slate-400 mb-3" />
        <p className="font-medium text-slate-700">Sin período de evaluación activo</p>
        <p className="text-slate-500 text-sm">No hay ningún período abierto para cargar notas.</p>
      </div>
    )
  }

  // Get enrolled students for this section
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select(`
      id,
      enrollment_number,
      students (id, full_name, dni)
    `)
    .eq('course_section_id', section.id)
    .eq('academic_year_id', section.academic_year_id)
    .eq('is_active', true)
    .order('enrollment_number')

  // Get existing grades
  const enrollmentIds = (enrollments ?? []).map((e: any) => e.id)
  const { data: existingGrades } = await supabase
    .from('grades')
    .select('id, student_enrollment_id, score, observation, status')
    .eq('grading_period_id', activePeriod.id)
    .eq('subject_id', subject.id)
    .in('student_enrollment_id', enrollmentIds)

  const isPeriodClosed = activePeriod.status === 'closed'

  return (
    <GradeEntryGrid
      assignment={assignment}
      section={section}
      subject={subject}
      period={activePeriod}
      enrollments={(enrollments ?? []) as any}
      existingGrades={(existingGrades ?? []) as any}
      isPeriodClosed={isPeriodClosed}
      teacherUserId={user.id}
    />
  )
}
