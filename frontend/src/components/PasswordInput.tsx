'use client'

import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a13.16 13.16 0 0 1-3.05 3.94M6.5 6.5C3.36 8.36 1 12 1 12s4 7 11 7a9.5 9.5 0 0 0 4.15-.94M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M1 1l22 22" />
    </svg>
  )
}

/** A password input with a show/hide toggle — drop-in replacement for
 * `<input type="password">` that keeps the caller's own className. */
export function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className ?? ''} w-full pe-9`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'hide password' : 'show password'}
        className="absolute inset-y-0 end-0 flex items-center px-2.5 text-ink-400 hover:text-ink-700 dark:text-ink-500 dark:hover:text-ink-200"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}
