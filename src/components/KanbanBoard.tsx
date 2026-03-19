'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

interface Task {
  id: number
  title: string
  status: string
  is_predefined: boolean
  feature: {
    id: number
    title: string
    project: { id: number; title: string }
  }
}

type BoardState = Record<string, Task[]>

const COLUMNS: { id: string; label: string; headerClass: string }[] = [
  { id: 'Todo',       label: 'To Do',       headerClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' },
  { id: 'InProgress', label: 'In Progress', headerClass: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' },
  { id: 'InReview',   label: 'In Review',   headerClass: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' },
  { id: 'Done',       label: 'Done',        headerClass: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
]

function buildBoard(tasks: Task[]): BoardState {
  const board: BoardState = { Todo: [], InProgress: [], InReview: [], Done: [] }
  for (const task of tasks) {
    if (board[task.status]) board[task.status].push(task)
    else board['Todo'].push(task)
  }
  return board
}

export default function KanbanBoard() {
  const [board, setBoard] = useState<BoardState>({ Todo: [], InProgress: [], InReview: [], Done: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks/my')
      .then((r) => r.json())
      .then((tasks: Task[]) => {
        setBoard(buildBoard(tasks))
        setLoading(false)
      })
  }, [])

  async function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const taskId = Number(draggableId)
    const newStatus = destination.droppableId

    // Optimistic update
    setBoard((prev) => {
      const next: BoardState = {}
      for (const col of COLUMNS) next[col.id] = [...prev[col.id]]

      const task = next[source.droppableId].find((t) => t.id === taskId)!
      next[source.droppableId] = next[source.droppableId].filter((t) => t.id !== taskId)
      const updated = { ...task, status: newStatus }
      next[destination.droppableId].splice(destination.index, 0, updated)
      return next
    })

    // API call
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      // Revert on failure
      const tasks: Task[] = await fetch('/api/tasks/my').then((r) => r.json())
      setBoard(buildBoard(tasks))
    }
  }

  async function moveTask(taskId: number, currentStatus: string, direction: 'next' | 'prev') {
    const colIds = COLUMNS.map((c) => c.id)
    const idx = colIds.indexOf(currentStatus)
    const newIdx = direction === 'next' ? idx + 1 : idx - 1
    if (newIdx < 0 || newIdx >= colIds.length) return

    const newStatus = colIds[newIdx]

    setBoard((prev) => {
      const next: BoardState = {}
      for (const col of COLUMNS) next[col.id] = [...prev[col.id]]
      const task = next[currentStatus].find((t) => t.id === taskId)!
      next[currentStatus] = next[currentStatus].filter((t) => t.id !== taskId)
      next[newStatus] = [...next[newStatus], { ...task, status: newStatus }]
      return next
    })

    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        Loading your tasks...
      </div>
    )
  }

  const totalTasks = COLUMNS.reduce((sum, col) => sum + board[col.id].length, 0)

  return (
    <div>
      {totalTasks === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-base font-medium">No tasks assigned to you yet.</p>
          <p className="text-sm mt-1">Ask your team leader to assign tasks to your features.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-4 gap-4 items-start">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col">
                {/* Column header */}
                <div className={`rounded-lg px-3 py-2 mb-3 flex items-center justify-between ${col.headerClass}`}>
                  <span className="font-semibold text-sm">{col.label}</span>
                  <span className="text-xs font-medium opacity-70">{board[col.id].length}</span>
                </div>

                {/* Droppable column */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col gap-2 min-h-24 rounded-lg p-1 transition-colors ${
                        snapshot.isDraggingOver
                          ? 'bg-blue-50 dark:bg-blue-900/10'
                          : 'bg-transparent'
                      }`}
                    >
                      {board[col.id].map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg p-3 shadow-sm select-none transition-shadow ${
                                snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : 'hover:shadow-md'
                              }`}
                            >
                              <p className="font-medium text-sm text-slate-800 dark:text-white leading-snug">{task.title}</p>
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 truncate">{task.feature.title}</p>
                              <p className="text-xs text-slate-400 truncate">{task.feature.project.title}</p>

                              {task.is_predefined && (
                                <span className="inline-block mt-1.5 text-xs text-slate-400 dark:text-slate-500">SDLC</span>
                              )}

                              {/* Move buttons */}
                              <div className="flex items-center gap-1 mt-2">
                                {col.id !== 'Todo' && (
                                  <button
                                    onClick={() => moveTask(task.id, col.id, 'prev')}
                                    className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700"
                                    title="Move back"
                                  >
                                    ←
                                  </button>
                                )}
                                {col.id !== 'Done' && (
                                  <button
                                    onClick={() => moveTask(task.id, col.id, 'next')}
                                    className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700"
                                    title="Move forward"
                                  >
                                    →
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  )
}
