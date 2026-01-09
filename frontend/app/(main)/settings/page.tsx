'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuthStore, useThemeStore } from '@/lib/store'
import { userAPI } from '@/lib/api'
import { EditProfileModal } from '@/components/EditProfileModal'
import { UserChangePasswordModal } from '@/components/UserChangePasswordModal'
import { Edit, Key, User, Mail, Phone, UserCircle, Shield, CheckCircle, XCircle, Hash } from 'lucide-react'
import { SmartTooltip } from '@/components/ui/SmartTooltip'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const [themeLoading, setThemeLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false)
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  
  // Prevent hydration mismatch by only rendering user-dependent content after mount
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Initialize theme from user preference
  useEffect(() => {
    if (user?.theme_preference && (user.theme_preference === 'dark' || user.theme_preference === 'light')) {
      setTheme(user.theme_preference as 'dark' | 'light')
    }
  }, [user, setTheme])
  
  const handleThemeToggle = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setThemeLoading(true)
    try {
      await userAPI.updateTheme(newTheme)
      setTheme(newTheme)
      // Update user in store
      if (user) {
        useAuthStore.getState().setUser({ ...user, theme_preference: newTheme })
      }
    } catch (error) {
      console.error('Failed to update theme:', error)
    } finally {
      setThemeLoading(false)
    }
  }

  const handleProfileUpdate = async () => {
    // Refresh user data after profile update
    try {
      const updatedUser = await userAPI.getCurrentUser()
      useAuthStore.getState().setUser(updatedUser)
    } catch (error) {
      console.error('Failed to refresh user data:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-sans font-semibold text-text-primary mb-1">
          Settings
        </h1>
        <p className="text-xs font-sans text-text-secondary">
          Manage your account settings and preferences
        </p>
      </div>

      <Card title="Account Management" compact>
        <div className="space-y-3">
          {/* Profile Information Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#1a2332]/30 dark:bg-[#1a2332]/20 border border-border-subtle hover:border-primary/40 hover:shadow-md transition-all duration-200">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center border border-primary/20 dark:border-primary/30">
                <User className="w-4.5 h-4.5 text-primary dark:text-[#60a5fa]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-sans font-medium text-text-secondary uppercase tracking-wider mb-0.5">Username</span>
                <span className="text-xs font-sans font-semibold text-text-primary truncate">
                  {mounted && user?.username ? user.username : '—'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#1a2332]/30 dark:bg-[#1a2332]/20 border border-border-subtle hover:border-primary/40 hover:shadow-md transition-all duration-200">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center border border-primary/20 dark:border-primary/30">
                <UserCircle className="w-4.5 h-4.5 text-primary dark:text-[#60a5fa]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-sans font-medium text-text-secondary uppercase tracking-wider mb-0.5">Full Name</span>
                <span className="text-xs font-sans font-semibold text-text-primary truncate">
                  {mounted && user?.name ? user.name : '—'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#1a2332]/30 dark:bg-[#1a2332]/20 border border-border-subtle hover:border-primary/40 hover:shadow-md transition-all duration-200">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center border border-primary/20 dark:border-primary/30">
                <Mail className="w-4.5 h-4.5 text-primary dark:text-[#60a5fa]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-sans font-medium text-text-secondary uppercase tracking-wider mb-0.5">Email</span>
                <span className="text-xs font-sans font-semibold text-text-primary truncate">
                  {mounted && user?.email ? user.email : '—'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#1a2332]/30 dark:bg-[#1a2332]/20 border border-border-subtle hover:border-primary/40 hover:shadow-md transition-all duration-200">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center border border-primary/20 dark:border-primary/30">
                <Phone className="w-4.5 h-4.5 text-primary dark:text-[#60a5fa]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-sans font-medium text-text-secondary uppercase tracking-wider mb-0.5">Mobile</span>
                <span className="text-xs font-sans font-semibold text-text-primary truncate">
                  {mounted && user?.mobile ? user.mobile : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Fixed Account Details Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#1a2332]/30 dark:bg-[#1a2332]/20 border border-border-subtle hover:border-primary/40 hover:shadow-md transition-all duration-200">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center border border-primary/20 dark:border-primary/30">
                <Shield className="w-4.5 h-4.5 text-primary dark:text-[#60a5fa]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-sans font-medium text-text-secondary uppercase tracking-wider mb-0.5">Role</span>
                <span className="text-xs font-sans font-semibold text-text-primary uppercase">
                  {mounted && user?.role ? user.role.toUpperCase() : '—'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#1a2332]/30 dark:bg-[#1a2332]/20 border border-border-subtle hover:border-primary/40 hover:shadow-md transition-all duration-200">
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border ${
                mounted && user?.account_status 
                  ? (user.account_status === 'ACTIVE' 
                      ? 'bg-success/10 dark:bg-success/15 border-success/30' 
                      : 'bg-error/10 dark:bg-error/15 border-error/30')
                  : (user?.is_active 
                      ? 'bg-success/10 dark:bg-success/15 border-success/30' 
                      : 'bg-error/10 dark:bg-error/15 border-error/30')
              }`}>
                {mounted && (user?.account_status === 'ACTIVE' || (user?.is_active && !user?.account_status)) ? (
                  <CheckCircle className="w-4.5 h-4.5 text-success" />
                ) : (
                  <XCircle className="w-4.5 h-4.5 text-error" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-sans font-medium text-text-secondary uppercase tracking-wider mb-0.5">Status</span>
                <span className={`text-xs font-sans font-semibold ${
                  mounted && user?.account_status 
                    ? (user.account_status === 'ACTIVE' ? 'text-success' : 'text-error')
                    : (user?.is_active ? 'text-success' : 'text-error')
                }`}>
                  {mounted && user?.account_status 
                    ? user.account_status 
                    : (user?.is_active ? 'ACTIVE' : 'INACTIVE')
                  }
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#1a2332]/30 dark:bg-[#1a2332]/20 border border-border-subtle hover:border-primary/40 hover:shadow-md transition-all duration-200">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center border border-primary/20 dark:border-primary/30">
                <Hash className="w-4.5 h-4.5 text-primary dark:text-[#60a5fa]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-sans font-medium text-text-secondary uppercase tracking-wider mb-0.5">User ID</span>
                <span className="text-xs font-sans font-semibold text-text-primary font-mono truncate">
                  {mounted && user?.user_id ? user.user_id : (user?.id ? user.id : '—')}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 justify-end pt-1 border-t border-border-subtle">
            <Button 
              variant="primary" 
              size="sm"
              onClick={() => setEditProfileModalOpen(true)}
              className="px-3 py-1.5 text-xs"
            >
              <Edit className="w-3.5 h-3.5 mr-1.5 btn-icon-hover icon-button icon-button-bounce" aria-label="Edit Profile" />
              Edit Profile
            </Button>
            <Button 
              variant="primary" 
              size="sm"
              onClick={() => setChangePasswordModalOpen(true)}
              className="px-3 py-1.5 text-xs"
            >
              <Key className="w-3.5 h-3.5 mr-1.5 btn-icon-hover icon-button icon-button-bounce" aria-label="Change Password" />
              Change Password
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Appearance" compact>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-sans font-medium text-text-primary block mb-1">
                Theme
              </label>
              <p className="text-xs font-sans text-text-secondary">
                Choose between dark and light theme
              </p>
            </div>
            <button
              onClick={handleThemeToggle}
              disabled={themeLoading}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#d1d5db] dark:bg-[#1f2a44] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:focus:ring-[#3b82f6]/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Toggle theme"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-sans text-text-secondary">
            <span className={theme === 'dark' ? 'text-text-primary font-medium' : ''}>
              Dark
            </span>
            <span>/</span>
            <span className={theme === 'light' ? 'text-text-primary font-medium' : ''}>
              Light
            </span>
          </div>
        </div>
      </Card>

      <EditProfileModal
        isOpen={editProfileModalOpen}
        onClose={() => setEditProfileModalOpen(false)}
        user={user}
        onUpdate={handleProfileUpdate}
      />

      <UserChangePasswordModal
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
        user={user}
        onUpdate={() => {}}
      />
    </div>
  )
}
