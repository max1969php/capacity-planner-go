import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, queryKeys } from './api.ts'

export const usePeople = () => useQuery({ queryKey: queryKeys.people, queryFn: api.listPeople })

export const useProjects = () => useQuery({ queryKey: queryKeys.projects, queryFn: api.listProjects })

export const useCapacity = (from: string, to: string) =>
  useQuery({
    queryKey: queryKeys.capacity(from, to),
    queryFn: () => api.capacity(from, to),
    enabled: from !== '' && to !== '',
  })

// Every write changes the capacity report, so each mutation also marks all
// cached reports stale.
export function useCreatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createPerson,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.people })
      qc.invalidateQueries({ queryKey: queryKeys.allCapacity })
    },
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects }),
  })
}

export function useCreateAllocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createAllocation,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.allCapacity }),
  })
}

export function useCreateTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createTimeEntry,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.allCapacity }),
  })
}
