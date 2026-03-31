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
   assigned_to: number | null
   assignee: { id: number; name: string } | null
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
      assignees: { user: { id: number; name: string } }[]
   }
   isManager: boolean
   latestProgress: number
   computedStatus: string
   ganttDeliverables: GanttDeliverable[]
   ganttModules: GanttModule[]
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

export default function ProjectDetailCard({
   project,
   isManager,
   latestProgress,
   computedStatus,
   ganttDeliverables,
   ganttModules,
}: ProjectDetailCardProps) {
   const [exporting, setExporting] = useState(false)

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
                           assignees: project.assignees,
                        }}
                        isManager={isManager}
                     />
                     <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                     >
                        {exporting ? (
                           <><span className="inline-block w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />Exporting...</>
                        ) : (
                           <>&#8595; Export PPTX</>
                        )}
                     </button>
                     <span
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[computedStatus] ?? STATUS_COLORS.Pending
                           }`}
                     >
                        {STATUS_LABEL[computedStatus] ?? computedStatus}
                     </span>
                  </div>
               </div>
            </div>
         </div>

         {/* Gantt chart — fills edge-to-edge */}
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

         {/* Burndown chart — always visible */}
         <div className="border-t border-slate-200 dark:border-navy-700">
            <BurndownChart
               tasks={allTasks}
               projectStart={project.start_date}
               projectDeadline={project.deadline}
            />
         </div>
      </div>
   )
}
