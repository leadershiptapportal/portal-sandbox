'use client'

import { useState, useEffect } from 'react'

const TAGLINES = [
  "Ready to take great care of your humans.",
  "Feels like a great day to show up for your people.",
  "Caring about your people is juicy af.",
  "Your humans are lucky to have someone like you.",
  "Real leadership starts with actually giving a damn.",
  "Go make your humans feel seen today.",
  "Great coaching is just great caring with structure.",
  "Someone out there is counting on you. Let's go.",
]

export default function DashboardTagline() {
  const [tagline, setTagline] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTagline(TAGLINES[Math.floor(Math.random() * TAGLINES.length)])
    setVisible(true)
  }, [])

  return (
    <p
      className={`text-sm text-muted-foreground mt-1 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {tagline}
    </p>
  )
}
