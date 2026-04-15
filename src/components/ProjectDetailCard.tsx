'use client'
import { useState } from 'react'
import GanttChart from './GanttChart'
import BurndownChart from './BurndownChart'
import ProjectActions from './ProjectActions'

interface GanttTask {
   id: number
   title: string
   status: string
   actual_start: string | null
   actual_end: string | null
   assignees: { id: number; name: string }[]
}

interface GanttDeliverable {
   id: number
   title: string
   status: string
   mandays: number
   planned_start: string | null
   planned_end: string | null
   actual_start: string | null
   actual_end: string | null
   module_id: number | null
   _count?: { issues: number }
   tasks: GanttTask[]
}

interface GanttModule {
   id: number
   title: string
   start_date: string | null
   end_date: string | null
}

interface ProjectDetailCardProps {
   project: {
      id: number
      title: string
      description: string | null
      status: string
      start_date: string
      deadline: string
      health_status?: string | null
      unit_id?: number | null
      dept_id?: number | null
      company_id?: number | null
      assignees: { user: { id: number; name: string } }[]
   }
   isManager: boolean
   latestProgress: number
   computedStatus: string
   ganttDeliverables: GanttDeliverable[]
   ganttModules: GanttModule[]
   openIssueCount?: number
}

const STATUS_LABEL: Record<string, string> = {
   InProgress: 'In Progress',
   OnHold: 'On Hold',
   Done: 'Done',
   Pending: 'Pending',
}

const STATUS_COLORS: Record<string, string> = {
   Done: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700',
   InProgress: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700',
   OnHold: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700',
   Pending: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600',
}

type ViewTab = 'gantt' | 'burndown' | 'milestone'

const STATUS_BADGE: Record<string, string> = {
   Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
   InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
   Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
   OnHold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

function fmt(iso?: string | null) {
   if (!iso) return '—'
   return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ProjectDetailCard({
   project,
   isManager,
   latestProgress,
   computedStatus,
   ganttDeliverables,
   ganttModules,
   openIssueCount = 0,
}: ProjectDetailCardProps) {
   const [exporting, setExporting] = useState(false)
   const [activeTab, setActiveTab] = useState<ViewTab>('gantt')

   async function handleExport() {
      setExporting(true)
      try {
         const res = await fetch(`/api/projects/${project.id}/export`)
         if (!res.ok) throw new Error('Export failed')
         const blob = await res.blob()
         const url = URL.createObjectURL(blob)
         const a = document.createElement('a')
         a.href = url
         a.download = `${project.title.replace(/[^a-z0-9]/gi, '_')}_report.pptx`
         a.click()
         URL.revokeObjectURL(url)
      } catch (e) {
         console.error('Export failed', e)
      } finally {
         setExporting(false)
      }
   }

   const radius = 36
   const circumference = 2 * Math.PI * radius
   const offset = circumference - (latestProgress / 100) * circumference

   const allTasks = ganttDeliverables.flatMap(d => d.tasks)

   return (
      <div className="rounded-xl border mb-6 bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 overflow-hidden">
         {/* Status badge strip — top-left of card */}
         <div className="px-6 pt-4 pb-0 flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[computedStatus] ?? STATUS_COLORS.Pending}`}>
               {STATUS_LABEL[computedStatus] ?? computedStatus}
            </span>
            {project.health_status && computedStatus !== 'Done' && (
               <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  project.health_status === 'on_track' ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400' :
                  project.health_status === 'at_risk'  ? 'bg-yellow-50 border-yellow-300 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-400' :
                  project.health_status === 'delayed'  ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400' :
                                                         'bg-neutral-100 border-neutral-400 text-neutral-700 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-300'
               }`}>
                  {project.health_status === 'on_track' ? '🟢 On Track' :
                   project.health_status === 'at_risk'  ? '🟡 At Risk'  :
                   project.health_status === 'delayed'  ? '🔴 Delayed'  : '⚫ Overdue'}
               </span>
            )}
         </div>

         {/* Title row */}
         <div className="flex items-center gap-6 p-6 border-b border-slate-100 dark:border-navy-700">
            {/* Circular progress */}
            <div className="shrink-0 relative w-24 h-24">
               <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-navy-700" />
                  <circle
                     cx="44" cy="44" r={radius}
                     fill="none" stroke="currentColor" strokeWidth="8"
                     strokeDasharray={circumference}
                     strokeDashoffset={offset}
                     strokeLinecap="round"
                     className={latestProgress >= 100 ? 'text-green-500' : 'text-blue-500'}
                     style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-slate-900 dark:text-white leading-none">{latestProgress}%</span>
                  <span className="text-xs text-slate-400 mt-0.5">progress</span>
               </div>
            </div>

            {/* Project info */}
            <div className="flex-1 min-w-0">
               <div className="flex items-start justify-between gap-4">
                  <div>
                     <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{project.title}</h1>
                     {project.description && (
                        <p className="text-slate-500 dark:text-slate-400 mt-1">{project.description}</p>
                     )}
                     <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>
                           Assignees:{' '}
                           <span className="text-slate-700 dark:text-slate-300">
                              {project.assignees.map(a => a.user.name).join(', ') || '—'}
                           </span>
                        </span>
                        <span>
                           Start:{' '}
                           <span className="text-slate-700 dark:text-slate-300">
                              {new Date(project.start_date).toLocaleDateString()}
                           </span>
                        </span>
                        <span>
                           Deadline:{' '}
                           <span className="text-slate-700 dark:text-slate-300">
                              {new Date(project.deadline).toLocaleDateString()}
                           </span>
                        </span>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                     <ProjectActions
                        project={{
                           id: project.id,
                           title: project.title,
                           description: project.description,
                           status: project.status,
                           start_date: project.start_date,
                           deadline: project.deadline,
                           unit_id: project.unit_id,
                           dept_id: project.dept_id,
                           company_id: project.company_id,
                           assignees: project.assignees,
                        }}
                        isManager={isManager}
                        openIssueCount={openIssueCount}
                     />
                     <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                     >
                        {exporting ? (
                           <><span className="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />Downloading...</>
                        ) : (
                           <>&#8595; Download Report</>
                        )}
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {/* View tabs */}
         <div className="border-t border-slate-200 dark:border-navy-700 px-6 pt-3 pb-0 flex items-center gap-1">
            {(['gantt', 'burndown', 'milestone'] as ViewTab[]).map(tab => (
               <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors capitalize ${
                     activeTab === tab
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
               >
                  {tab === 'gantt' ? 'Gantt Chart' : tab === 'burndown' ? 'Burndown Chart' : 'Milestone'}
               </button>
            ))}
         </div>

         {/* Tab content */}
         {activeTab === 'gantt' && (
            <GanttChart
               project={{
                  id: project.id,
                  title: project.title,
                  start_date: project.start_date,
                  deadline: project.deadline,
               }}
               deliverables={ganttDeliverables}
               modules={ganttModules}
               embedded
            />
         )}

         {activeTab === 'burndown' && (
            <div className="border-t border-slate-200 dark:border-navy-700">
               <BurndownChart
                  tasks={allTasks}
                  projectStart={project.start_date}
                  projectDeadline={project.deadline}
               />
            </div>
         )}

         {activeTab === 'milestone' && (
            <div className="border-t border-slate-200 dark:border-navy-700 p-6">
               {ganttDeliverables.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No deliverables yet.</p>
               ) : (
                  <div className="space-y-3">
                     {[...ganttDeliverables]
                        .sort((a, b) => {
                           const da = a.planned_end ?? a.actual_end ?? ''
                           const db = b.planned_end ?? b.actual_end ?? ''
                           return da.localeCompare(db)
                        })
                        .map((d, idx) => {
                           const doneTasks = d.tasks.filter(t => t.status === 'Done').length
                           const totalTasks = d.tasks.length
                           const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
                           const isLast = idx === ganttDeliverables.length - 1
                           return (
                              <div key={d.id} className="flex gap-4">
                                 {/* Timeline spine */}
                                 <div className="flex flex-col items-center shrink-0 w-5">
                                    <div className={`w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 ${d.status === 'Done' ? 'bg-green-500 border-green-500' : d.status === 'InProgress' ? 'bg-orange-400 border-orange-400' : 'bg-white dark:bg-navy-800 border-slate-300 dark:border-navy-500'}`} />
                                    {!isLast && <div className="w-px flex-1 bg-slate-200 dark:bg-navy-600 mt-1" />}
                                 </div>
                                 {/* Card */}
                                 <div className="flex-1 pb-4">
                                    <div className="flex items-start justify-between gap-3">
                                       <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                             <span className="text-sm font-semibold text-slate-800 dark:text-white">{d.title}</span>
                                             <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE[d.status] ?? STATUS_BADGE.Pending}`}>
                                                {d.status === 'InProgress' ? 'In Progress' : d.status}
                                             </span>
                                             {(d._count?.issues ?? 0) > 0 && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                   ⚠ {d._count!.issues}
                                                </span>
                                             )}
                                          </div>
                                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-400">
                                             <span>Planned: {fmt(d.planned_start)} → {fmt(d.planned_end)}</span>
                                             {d.actual_start && <span>Actual: {fmt(d.actual_start)} → {d.actual_end ? fmt(d.actual_end) : 'ongoing'}</span>}
                                             <span>{d.mandays} md</span>
                                          </div>
                                       </div>
                                       <div className="text-right shrink-0">
                                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{pct}%</span>
                                          <p className="text-[10px] text-slate-400">{doneTasks}/{totalTasks} tasks</p>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           )
                        })}
                  </div>
               )}
            </div>
         )}
      </div>
   )
}
