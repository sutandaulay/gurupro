'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTeacherStore } from './teacherStore'

interface SchoolItem {
  id: string
  nama_sekolah: string
  logo: string | null
  alamat: string | null
  npsn: string | null
  user_id: string
}

interface UseActiveSchoolReturn {
  activeSchoolId: string
  schools: SchoolItem[]
  activeSchool: SchoolItem | null
  isLoading: boolean
}

const SESSION_KEY = 'gurupro_school_selected'

export function useActiveSchool(): UseActiveSchoolReturn {
  const [schools, setSchools] = useState<SchoolItem[]>([])
  const [activeSchoolId, setActiveSchoolIdState] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  const storeActiveSchoolId = useTeacherStore((s) => s.activeSchoolId)
  const setStoreActiveSchool = useTeacherStore((s) => s.setActiveSchool)
  const setStoreSchools = useTeacherStore((s) => s.setSchools)

  const fetchSchools = useCallback(async () => {
    try {
      const res = await fetch('/api/schools')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setSchools(data)
          setStoreSchools(data)

          const saved = sessionStorage.getItem(SESSION_KEY) || ''
          if (saved && data.some((s: any) => s.id === saved)) {
            setActiveSchoolIdState(saved)
            if (storeActiveSchoolId !== saved) {
              setStoreActiveSchool(saved)
            }
          } else if (data.length > 0) {
            setActiveSchoolIdState(data[0].id)
            sessionStorage.setItem(SESSION_KEY, data[0].id)
            setStoreActiveSchool(data[0].id)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load schools:', err)
    } finally {
      setIsLoading(false)
    }
  }, [storeActiveSchoolId, setStoreActiveSchool, setStoreSchools])

  useEffect(() => {
    fetchSchools()
  }, [fetchSchools])

  useEffect(() => {
    const handleChange = () => {
      const saved = sessionStorage.getItem(SESSION_KEY) || ''
      if (saved && saved !== activeSchoolId) {
        setActiveSchoolIdState(saved)
        if (storeActiveSchoolId !== saved) {
          setStoreActiveSchool(saved)
        }
      }
    }
    window.addEventListener('gurupro_school_changed', handleChange)
    return () => window.removeEventListener('gurupro_school_changed', handleChange)
  }, [activeSchoolId, storeActiveSchoolId, setStoreActiveSchool])

  const activeSchool = schools.find(s => s.id === activeSchoolId) || null

  return { activeSchoolId, schools, activeSchool, isLoading }
}
