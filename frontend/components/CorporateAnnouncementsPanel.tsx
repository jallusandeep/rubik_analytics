'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { announcementsAPI } from '@/lib/api'
import { useWebSocketStatus } from '@/lib/useWebSocket'

interface Announcement {
  id: string
  trade_date?: string
  symbol_nse?: string
  symbol_bse?: string
  company_name?: string
  news_headline?: string
  descriptor_name?: string
  announcement_type?: string
}

interface AnnouncementsResponse {
  announcements: Announcement[]
  total: number
  limit?: number
  offset: number
}

export function CorporateAnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  
  // Establish WebSocket connection for real-time updates
  useWebSocketStatus()

  useEffect(() => {
    loadAnnouncements()
  }, [])
  
  useEffect(() => {
    // Listen for real-time announcement updates via WebSocket
    const handleAnnouncementUpdate = (event: CustomEvent) => {
      const newAnnouncement = event.detail
      if (newAnnouncement && newAnnouncement.id) {
        // Add new announcement to the beginning of the list
        // Use functional update to avoid dependency on announcements
        setAnnouncements(prev => {
          // Check if announcement already exists (avoid duplicates)
          const exists = prev.some(ann => ann.id === newAnnouncement.id)
          if (!exists) {
            return [newAnnouncement, ...prev]
          }
          return prev
        })
      }
    }
    
    // Add event listener for announcement updates
    window.addEventListener('announcementUpdate', handleAnnouncementUpdate as EventListener)
    
    return () => {
      // Cleanup: remove event listener
      window.removeEventListener('announcementUpdate', handleAnnouncementUpdate as EventListener)
    }
  }, [])

  const loadAnnouncements = async () => {
    try {
      setLoading(true)
      setError(null)
      // Load all past announcements from database
      // Use a very large page_size to load all historical data (backend supports this)
      // The backend will return all announcements ordered by trade_date DESC (newest first)
      const response: AnnouncementsResponse = await announcementsAPI.getAnnouncements({
        page: 1,
        page_size: 10000  // Load up to 10,000 announcements to show all past data
      })
      setAnnouncements(response.announcements || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load announcements')
      console.error('Error loading announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    try {
      const date = new Date(dateStr)
      // Explicitly use Asia/Kolkata timezone to match Windows server timezone
      const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      return formatter.format(date)
    } catch {
      return dateStr
    }
  }

  const getSymbol = (ann: Announcement) => {
    return ann.symbol_nse || ann.symbol_bse || 'N/A'
  }

  const handleRowClick = async (announcement: Announcement) => {
    try {
      const fullAnnouncement = await announcementsAPI.getAnnouncement(announcement.id)
      setSelectedAnnouncement(fullAnnouncement)
      setShowDetails(true)
    } catch (err: any) {
      setError(err.message || 'Failed to load announcement details')
    }
  }

  if (loading) {
    return (
      <Card title="Corporate Announcements" compact>
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-text-secondary">Loading announcements...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="Corporate Announcements" compact>
        <div className="flex items-center justify-center py-8">
          <p className="text-xs font-sans text-error">{error}</p>
        </div>
      </Card>
    )
  }

  if (showDetails && selectedAnnouncement) {
    return (
      <Card title="Announcement Details" compact>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setShowDetails(false)
                setSelectedAnnouncement(null)
              }}
              className="text-xs font-sans text-primary hover:text-primary-dark"
            >
              ← Back to List
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-sans text-text-secondary uppercase tracking-wider mb-1">Date / Time</p>
              <p className="text-sm font-sans text-text-primary">{formatDate(selectedAnnouncement.trade_date)}</p>
            </div>

            <div>
              <p className="text-xs font-sans text-text-secondary uppercase tracking-wider mb-1">Symbol</p>
              <p className="text-sm font-sans text-text-primary">{getSymbol(selectedAnnouncement)}</p>
            </div>

            <div>
              <p className="text-xs font-sans text-text-secondary uppercase tracking-wider mb-1">Company Name</p>
              <p className="text-sm font-sans text-text-primary">{selectedAnnouncement.company_name || 'N/A'}</p>
            </div>

            <div>
              <p className="text-xs font-sans text-text-secondary uppercase tracking-wider mb-1">Headline</p>
              <p className="text-sm font-sans text-text-primary">{selectedAnnouncement.news_headline || 'N/A'}</p>
            </div>

            {(selectedAnnouncement as any).news_subhead && (
              <div>
                <p className="text-xs font-sans text-text-secondary uppercase tracking-wider mb-1">Sub-heading</p>
                <p className="text-sm font-sans text-text-primary">{(selectedAnnouncement as any).news_subhead}</p>
              </div>
            )}

            {(selectedAnnouncement as any).news_body && (
              <div>
                <p className="text-xs font-sans text-text-secondary uppercase tracking-wider mb-1">Body</p>
                <div className="text-sm font-sans text-text-primary whitespace-pre-wrap max-h-96 overflow-y-auto p-3 bg-panel rounded border border-border-subtle">
                  {(selectedAnnouncement as any).news_body}
                </div>
              </div>
            )}

            {selectedAnnouncement.descriptor_name && (
              <div>
                <p className="text-xs font-sans text-text-secondary uppercase tracking-wider mb-1">Descriptor</p>
                <p className="text-sm font-sans text-text-primary">{selectedAnnouncement.descriptor_name}</p>
              </div>
            )}

            {selectedAnnouncement.announcement_type && (
              <div>
                <p className="text-xs font-sans text-text-secondary uppercase tracking-wider mb-1">Announcement Type</p>
                <p className="text-sm font-sans text-text-primary">{selectedAnnouncement.announcement_type}</p>
              </div>
            )}

            {(selectedAnnouncement as any).date_of_meeting && (
              <div>
                <p className="text-xs font-sans text-text-secondary uppercase tracking-wider mb-1">Meeting Date</p>
                <p className="text-sm font-sans text-text-primary">{formatDate((selectedAnnouncement as any).date_of_meeting)}</p>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={async () => {
                  try {
                    const blob = await announcementsAPI.getAttachment(selectedAnnouncement.id)
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `announcement-${selectedAnnouncement.id}.pdf`
                    document.body.appendChild(a)
                    a.click()
                    window.URL.revokeObjectURL(url)
                    document.body.removeChild(a)
                  } catch (err: any) {
                    if (err.response?.status !== 404) {
                      setError(err.message || 'Failed to download attachment')
                    }
                  }
                }}
                className="text-xs font-sans text-primary hover:text-primary-dark"
              >
                Download Attachment (if available)
              </button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card title="Corporate Announcements" compact>
      {announcements.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-xs font-sans text-text-secondary">No announcements available</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableHeaderCell>Date / Time</TableHeaderCell>
            <TableHeaderCell>Symbol</TableHeaderCell>
            <TableHeaderCell>Company Name</TableHeaderCell>
            <TableHeaderCell>Headline</TableHeaderCell>
            <TableHeaderCell>Descriptor</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
          </TableHeader>
          <TableBody>
            {announcements.map((ann, index) => (
              <TableRow
                key={ann.id}
                index={index}
                onClick={() => handleRowClick(ann)}
                className="cursor-pointer hover:bg-panel-hover"
              >
                <TableCell className="text-text-secondary">
                  {formatDate(ann.trade_date)}
                </TableCell>
                <TableCell>{getSymbol(ann)}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {ann.company_name || 'N/A'}
                </TableCell>
                <TableCell className="max-w-md truncate">
                  {ann.news_headline || 'N/A'}
                </TableCell>
                <TableCell>{ann.descriptor_name || 'N/A'}</TableCell>
                <TableCell>{ann.announcement_type || 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

