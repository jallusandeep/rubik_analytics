'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authAPI } from '@/lib/api'
import { getErrorMessage } from '@/lib/error-utils'

interface ContactAdminModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContactAdminModal({ isOpen, onClose }: ContactAdminModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    company: '',
    reason: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleClose = () => {
    setFormData({ name: '', email: '', mobile: '', company: '', reason: '' })
    setMessage('')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent duplicate submissions
    if (loading) return

    // Client-side validation
    if (!formData.name.trim()) {
      setMessage('Name is required')
      return
    }

    if (!formData.mobile.trim()) {
      setMessage('Mobile number is required')
      return
    }

    if (!formData.reason.trim()) {
      setMessage('Reason for access is required')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // Prepare payload - only send fields supported by backend
      const payload: {
        name: string
        email?: string | null
        mobile: string
        company?: string | null
        reason: string
      } = {
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        reason: formData.reason.trim(),
      }

      // Add optional fields only if they have values
      // Validate email format if provided
      const emailTrimmed = formData.email.trim()
      if (emailTrimmed) {
        // Basic email validation (backend will do stricter validation)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(emailTrimmed)) {
          setMessage('Please enter a valid email address')
          setLoading(false)
          return
        }
        payload.email = emailTrimmed
      } else {
        payload.email = null
      }

      const companyTrimmed = formData.company.trim()
      if (companyTrimmed) {
        payload.company = companyTrimmed
      } else {
        payload.company = null
      }

      await authAPI.requestAccess(payload)

      // Success
      setMessage('Request submitted successfully! An admin will review your request.')
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (error: any) {
      // Extract error message from backend response
      let errorMessage = 'Failed to submit request. Please try again.'

      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error?.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }

      setMessage(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Request Login Access"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="Enter your full name"
          disabled={loading}
        />

        <Input
          label="Email (Optional)"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="Enter your email (optional)"
          disabled={loading}
        />

        <Input
          label="Mobile Number (Required)"
          type="tel"
          value={formData.mobile}
          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
          required
          placeholder="Enter your mobile number"
          disabled={loading}
        />

        <Input
          label="Company (Required)"
          type="text"
          value={formData.company}
          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          required
          placeholder="Enter your company name"
          disabled={loading}
        />

        <div className="w-full">
          <label className="block text-sm font-sans font-medium text-[#9ca3af] mb-1.5">
            Reason for Access (Required)
          </label>
          <textarea
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            required
            rows={3}
            className="w-full px-3 py-2 border border-[#1f2a44] rounded-lg bg-[#121b2f] text-[#e5e7eb] font-sans text-base placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30 focus:border-[#3b82f6] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 resize-none"
            placeholder="Explain why you need access to the platform"
            disabled={loading}
          />
        </div>

        {message && (
          <div className={`rounded-sm p-2.5 ${message.includes('successfully')
            ? 'bg-success/10 border border-success'
            : 'bg-error/10 border border-error'
            }`}>
            <p className={`text-sm font-sans ${message.includes('successfully') ? 'text-success' : 'text-error'
              }`}>
              {typeof message === 'string' ? message : getErrorMessage(message, 'An error occurred')}
            </p>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

