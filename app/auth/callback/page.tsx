"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CallbackPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/")
  }, [router])

  return <p>Entrando...</p>
}