'use client'

import { useState } from 'react'
import { X, CreditCard, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BillingNoticeProps {
  className?: string
  variant?: 'warning' | 'info' | 'error'
  onDismiss?: () => void
  showDismiss?: boolean
}

export function BillingNotice({ 
  className, 
  variant = 'info', 
  onDismiss,
  showDismiss = true 
}: BillingNoticeProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  if (isDismissed) return null

  const variants = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800'
  }

  const icons = {
    info: <CreditCard className="w-4 h-4" />,
    warning: <Clock className="w-4 h-4" />,
    error: <X className="w-4 h-4" />
  }

  return (
    <div className={cn(
      'border rounded-lg p-4 relative',
      variants[variant],
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {icons[variant]}
        </div>
        <div className="flex-1 space-y-1">
          <div className="font-medium text-sm">
            Billing System Coming Soon
          </div>
          <div className="text-sm opacity-90">
            We&apos;re currently developing our billing system. During this beta period, 
            all users have a <strong>£1.00 monthly limit</strong> to try out The Duck. 
            Full billing options will be available soon!
          </div>
        </div>
        {showDismiss && (
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-black/5 rounded-md transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// Credit usage warning component
interface CreditWarningProps {
  remainingCredits: number
  totalCredits: number
  className?: string
}

export function CreditWarning({ remainingCredits, totalCredits, className }: CreditWarningProps) {
  const remainingPounds = remainingCredits / 100
  const totalPounds = totalCredits / 100
  const percentage = (remainingCredits / totalCredits) * 100

  // Determine variant based on percentage (used in conditional styling below)
  if (percentage <= 10) {
    // Will use error styles
  } else if (percentage <= 25) {
    // Will use warning styles  
  } else {
    // Will use info styles
  }

  return (
    <div className={cn(
      'border rounded-lg p-3',
      percentage <= 10 ? 'bg-red-50 border-red-200 text-red-800' :
      percentage <= 25 ? 'bg-amber-50 border-amber-200 text-amber-800' :
      'bg-blue-50 border-blue-200 text-blue-800',
      className
    )}>
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4" />
        <span className="text-sm font-medium">
          Credits: £{remainingPounds.toFixed(2)} remaining of £{totalPounds.toFixed(2)}
        </span>
      </div>
      {percentage <= 25 && (
        <div className="text-xs opacity-90 mt-1">
          {percentage <= 10 
            ? 'Credit limit nearly reached. Billing system coming soon!' 
            : 'Running low on credits for this billing period.'
          }
        </div>
      )}
    </div>
  )
}