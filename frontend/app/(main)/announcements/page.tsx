'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { announcementsAPI } from '@/lib/api'
import { useWebSocketStatus } from '@/lib/useWebSocket'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, Eye, Download, AlertCircle, Radio } from 'lucide-react'

interface Link {
  title?: string
  url: string
}

interface Announcement {
  id: string
  trade_date?: string
  script_code?: number
  symbol_nse?: string
  symbol_bse?: string
  company_name?: string
  news_headline?: string
  descriptor_name?: string
  announcement_type?: string
  news_subhead?: string
  news_body?: string
  descriptor_category?: string
  date_of_meeting?: string
  links?: Link[]
  // Note: attachments are NOT in payload - must be fetched on-demand
}

interface AnnouncementsResponse {
  announcements: Announcement[]
  total: number
  page?: number
  page_size?: number
  total_pages?: number
  limit?: number
  offset: number
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [openLinksMenu, setOpenLinksMenu] = useState<string | null>(null)
  const [needsExpansionMap, setNeedsExpansionMap] = useState<Map<string, boolean>>(new Map())
  const [downloadingAttachment, setDownloadingAttachment] = useState<Set<string>>(new Set())
  const [viewingAttachment, setViewingAttachment] = useState<Set<string>>(new Set())
  const [attachmentErrors, setAttachmentErrors] = useState<Map<string, string>>(new Map())
  
  const MAX_VISIBLE_LINES = 3
  const descriptionRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Establish WebSocket connection for real-time updates
  useWebSocketStatus()

  useEffect(() => {
    loadAnnouncements()
    // Auto-refresh removed - using real-time WebSocket updates instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  // Listen for real-time announcement updates via WebSocket
  useEffect(() => {
    const handleAnnouncementUpdate = (event: CustomEvent) => {
      const newAnnouncement = event.detail
      if (newAnnouncement && newAnnouncement.id) {
        // Add new announcement to the beginning of the list
        setAnnouncements(prev => {
          // Check if announcement already exists (avoid duplicates)
          const exists = prev.some(ann => ann.id === newAnnouncement.id)
          if (!exists) {
            // Only add if we're on the first page
            if (page === 1) {
              return [newAnnouncement, ...prev]
            }
          }
          return prev
        })
        // Update last refresh time
        setLastRefresh(new Date())
      }
    }
    
    // Add event listener for announcement updates
    window.addEventListener('announcementUpdate', handleAnnouncementUpdate as EventListener)
    
    return () => {
      // Cleanup: remove event listener
      window.removeEventListener('announcementUpdate', handleAnnouncementUpdate as EventListener)
    }
  }, [page])

  // Close links menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openLinksMenu && !(event.target as Element).closest('.links-menu-container')) {
        setOpenLinksMenu(null)
      }
    }
    
    if (openLinksMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openLinksMenu])


  const loadAnnouncements = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await announcementsAPI.getAnnouncements({
        page: page,
        page_size: pageSize
      })
      
      console.log('API Response:', response)
      
      const data = response.announcements || []
      setAnnouncements(data)
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || Math.ceil((response.total || 0) / pageSize))
      setLastRefresh(new Date())
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // Format date as DD Jan YYYY on first line, hh:mm AM/PM on second line
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return { date: 'N/A', time: '' }
    try {
      const date = new Date(dateStr)
      const day = String(date.getDate()).padStart(2, '0')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = monthNames[date.getMonth()]
      const year = date.getFullYear()
      const datePart = `${day} ${month} ${year}`
      
      const hours = date.getHours()
      const minutes = date.getMinutes()
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12
      const timePart = `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`
      
      return { date: datePart, time: timePart }
    } catch {
      return { date: dateStr, time: '' }
    }
  }

  // Format symbol as stacked NSE/BSE
  // BSE should show numeric code (script_code), not symbol
  const formatSymbol = (ann: Announcement) => {
    const nse = ann.symbol_nse
    // Use script_code for BSE (numeric code), fallback to symbol_bse without _BSE suffix
    const bse = ann.script_code?.toString() || ann.symbol_bse?.replace('_BSE', '')
    
    if (nse && bse) {
      return { nse, bse }
    } else if (nse) {
      return { nse, bse: null }
    } else if (bse) {
      return { nse: null, bse }
    }
    return { nse: null, bse: null }
  }

  // Check if description actually overflows (using DOM measurements)
  const checkDescriptionOverflow = (id: string, description: string) => {
    if (!description.trim()) {
      setNeedsExpansionMap(prev => {
        const newMap = new Map(prev)
        newMap.set(id, false)
        return newMap
      })
      return
    }

    const element = descriptionRefs.current.get(id)
    if (!element) {
      // Element not yet rendered, will check after render
      return
    }

    // Check if scrollHeight > clientHeight (actual overflow)
    const hasOverflow = element.scrollHeight > element.clientHeight
    
    setNeedsExpansionMap(prev => {
      const newMap = new Map(prev)
      newMap.set(id, hasOverflow)
      return newMap
    })
  }

  // Check overflow for all descriptions after render
  useEffect(() => {
    const checkAllOverflows = () => {
      announcements.forEach(ann => {
        if (ann.news_body && !expandedRows.has(ann.id)) {
          // Use setTimeout to ensure DOM is rendered
          setTimeout(() => {
            checkDescriptionOverflow(ann.id, ann.news_body || '')
          }, 0)
        }
      })
    }

    checkAllOverflows()

    // Also check on window resize (debounced)
    let resizeTimeout: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        checkAllOverflows()
      }, 150)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [announcements, expandedRows])
  
  // Check if announcement has links
  // Note: Attachments are NOT in payload - they must be fetched on-demand
  const hasLinks = (ann: Announcement) => {
    const links = ann.links || []
    return links.length > 0 && links.some(l => l.url)
  }
  
  // Handle attachment download (on-demand fetch from TrueData)
  const handleDownloadAttachment = async (announcementId: string) => {
    if (downloadingAttachment.has(announcementId) || viewingAttachment.has(announcementId)) {
      return // Already processing
    }
    
    // Clear any previous error
    setAttachmentErrors(prev => {
      const newMap = new Map(prev)
      newMap.delete(announcementId)
      return newMap
    })
    
    try {
      setDownloadingAttachment(prev => new Set(prev).add(announcementId))
      
      // Fetch attachment on-demand (DB-first, then TrueData)
      const blob = await announcementsAPI.getAttachment(announcementId)
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `announcement-${announcementId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to download attachment'
      setAttachmentErrors(prev => new Map(prev).set(announcementId, errorMsg))
      console.error('Error downloading attachment:', err)
    } finally {
      setDownloadingAttachment(prev => {
        const newSet = new Set(prev)
        newSet.delete(announcementId)
        return newSet
      })
    }
  }
  
  // Handle attachment view (open in new tab)
  const handleViewAttachment = async (announcementId: string) => {
    if (downloadingAttachment.has(announcementId) || viewingAttachment.has(announcementId)) {
      return // Already processing
    }
    
    // Clear any previous error
    setAttachmentErrors(prev => {
      const newMap = new Map(prev)
      newMap.delete(announcementId)
      return newMap
    })
    
    try {
      setViewingAttachment(prev => new Set(prev).add(announcementId))
      
      // Fetch attachment on-demand (DB-first, then TrueData)
      const blob = await announcementsAPI.getAttachment(announcementId)
      
      // Create blob URL and open in new tab
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Note: URL will be revoked when tab closes or after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to view attachment'
      setAttachmentErrors(prev => new Map(prev).set(announcementId, errorMsg))
      console.error('Error viewing attachment:', err)
    } finally {
      setViewingAttachment(prev => {
        const newSet = new Set(prev)
        newSet.delete(announcementId)
        return newSet
      })
    }
  }

  const toggleExpand = (id: string, description: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      const wasExpanded = newSet.has(id)
      if (wasExpanded) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      
      // Re-check overflow after state update
      setTimeout(() => {
        if (!wasExpanded) {
          // Just expanded, no need to check (it's now fully visible)
          setNeedsExpansionMap(prev => {
            const newMap = new Map(prev)
            newMap.set(id, true) // Keep expander visible for collapse button
            return newMap
          })
        } else {
          // Just collapsed, re-check if overflow still exists
          checkDescriptionOverflow(id, description)
        }
      }, 0)
      
      return newSet
    })
  }


  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1) // Reset to first page
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (page <= 3) {
        for (let i = 2; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (page >= totalPages - 2) {
        pages.push('ellipsis')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push('ellipsis')
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }

    return pages
  }


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-sans font-semibold text-text-primary">
              Corporate Announcements
            </h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-success/10 rounded-full">
              <Radio className="w-3 h-3 text-success animate-pulse" />
              <span className="text-[10px] font-sans text-success font-medium uppercase tracking-wider">LIVE</span>
            </div>
          </div>
          <p className="text-xs font-sans text-text-secondary">
            Real-time corporate announcements
            {lastRefresh && (
              <span className="ml-2">
                • Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Announcements Table */}
      <Card compact>
        <Table>
          <TableHeader>
            <TableHeaderCell>Date / Time</TableHeaderCell>
            <TableHeaderCell>Symbol</TableHeaderCell>
            <TableHeaderCell>Company Name</TableHeaderCell>
            <TableHeaderCell>Headline</TableHeaderCell>
            <TableHeaderCell>Links & Attachments</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow index={0}>
                <TableCell colSpan={6} className="text-center py-8 text-error">
                  {error}
                </TableCell>
              </TableRow>
            ) : loading && announcements.length === 0 ? (
              <TableRow index={0}>
                <TableCell colSpan={6} className="px-3 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-text-secondary">Loading announcements...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : announcements.length === 0 ? (
              <TableRow index={0}>
                <TableCell colSpan={6} className="text-center py-8 text-text-secondary">
                  {`No data (Total: ${total})`}
                </TableCell>
              </TableRow>
            ) : announcements.map((ann, index) => {
                const dateTime = formatDate(ann.trade_date)
                const symbol = formatSymbol(ann)
                const isExpanded = expandedRows.has(ann.id)
                const shouldShowExpand = needsExpansionMap.get(ann.id) || false
                const headline = ann.news_headline || 'N/A'
                const description = ann.news_body || ''
                const announcementHasLinks = hasLinks(ann)
                const links = ann.links || []
                
                return (
                  <TableRow
                    key={ann.id}
                    index={index}
                    className="hover:bg-panel-hover"
                  >
                    {/* Date / Time - Two lines */}
                    <TableCell className="text-text-secondary align-top py-2">
                      <div className="text-xs leading-tight">
                        <div>{dateTime.date}</div>
                        {dateTime.time && <div className="text-[10px] mt-0.5">{dateTime.time}</div>}
                      </div>
                    </TableCell>
                    
                    {/* Symbol - Stacked NSE/BSE */}
                    <TableCell className="align-top py-2">
                      <div className="text-xs leading-tight">
                        {symbol.nse && <div>NSE: {symbol.nse}</div>}
                        {symbol.bse && <div className="mt-0.5">BSE: {symbol.bse}</div>}
                        {!symbol.nse && !symbol.bse && <div className="text-text-secondary">N/A</div>}
                      </div>
                    </TableCell>
                    
                    {/* Company Name */}
                    <TableCell className="align-top py-2">
                      <div className="text-xs text-text-primary break-words max-w-[150px]">
                        {ann.company_name || ''}
                      </div>
                    </TableCell>
                    
                    {/* Headline + Description - Description-only expansion */}
                    <TableCell className="align-top py-2 max-w-md">
                      <div className="text-sm">
                        {/* Headline - Always fully visible */}
                        <div className="font-semibold break-words mb-1">{headline}</div>
                        
                        {/* Description */}
                        {description ? (
                          <>
                            {isExpanded ? (
                              <>
                                <div className="text-xs text-text-secondary whitespace-pre-wrap break-words">
                                  {description}
                                </div>
                                {shouldShowExpand && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleExpand(ann.id, description)
                                    }}
                                    className="mt-1 text-xs text-primary hover:text-primary-dark flex items-center gap-1"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                    Collapse
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <div
                                  ref={(el) => {
                                    if (el) {
                                      descriptionRefs.current.set(ann.id, el)
                                      // Check overflow after ref is set
                                      setTimeout(() => {
                                        checkDescriptionOverflow(ann.id, description)
                                      }, 0)
                                    } else {
                                      descriptionRefs.current.delete(ann.id)
                                    }
                                  }}
                                  className="text-xs text-text-secondary whitespace-pre-wrap break-words"
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: MAX_VISIBLE_LINES,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {description}
                                </div>
                                {shouldShowExpand && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleExpand(ann.id, description)
                                    }}
                                    className="mt-1 text-xs text-primary hover:text-primary-dark flex items-center gap-1"
                                  >
                                    <ChevronRightIcon className="w-3 h-3" />
                                    Expand
                                  </button>
                                )}
                              </>
                            )}
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                    
                    {/* Links & Attachments */}
                    <TableCell className="align-top py-2">
                      <div className="flex flex-col gap-1">
                        {/* Links - always show if available */}
                        {announcementHasLinks ? (
                          <div className="relative links-menu-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenLinksMenu(openLinksMenu === ann.id ? null : ann.id)
                              }}
                              className="text-xs text-primary hover:text-primary-dark flex items-center gap-1"
                            >
                              Links ({links.filter(l => l.url).length})
                            </button>
                            
                            {openLinksMenu === ann.id && (
                              <div 
                                className="absolute right-0 mt-1 bg-panel border border-border rounded shadow-lg z-50 min-w-[200px] max-w-[300px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="p-2 max-h-64 overflow-y-auto">
                                  {links.filter(l => l.url).map((link, idx) => (
                                    <a
                                      key={idx}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block py-1.5 px-2 text-xs text-text-primary hover:bg-panel-hover rounded break-words"
                                    >
                                      {link.title || link.url}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                        
                        {/* Attachments - always show, fetch on-demand */}
                        <div className="flex flex-col gap-1">
                          {attachmentErrors.has(ann.id) ? (
                            <div className="text-xs text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span className="max-w-[150px] truncate" title={attachmentErrors.get(ann.id)}>
                                {attachmentErrors.get(ann.id)}
                              </span>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewAttachment(ann.id)
                                }}
                                disabled={viewingAttachment.has(ann.id) || downloadingAttachment.has(ann.id)}
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                                title="View attachment in new tab"
                              >
                                {viewingAttachment.has(ann.id) ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                                    <span className="text-blue-400">View</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownloadAttachment(ann.id)
                                }}
                                disabled={downloadingAttachment.has(ann.id) || viewingAttachment.has(ann.id)}
                                className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                                title="Download attachment"
                              >
                                {downloadingAttachment.has(ann.id) ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                    Downloading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-green-400">Download</span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    {/* Type */}
                    <TableCell className="align-top py-2 text-xs text-text-secondary">
                      {ann.announcement_type || 'N/A'}
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        {total > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 text-sm border border-border rounded bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={loading}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={loading || page === 1}
                  className="px-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                {getPageNumbers().map((pageNum, idx) => {
                  if (pageNum === 'ellipsis') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 text-text-secondary">
                        ...
                      </span>
                    )
                  }
                  const pageNumValue = pageNum as number
                  return (
                    <Button
                      key={pageNumValue}
                      variant={pageNumValue === page ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => handlePageChange(pageNumValue)}
                      disabled={loading}
                      className="min-w-[2rem] px-2"
                    >
                      {pageNumValue}
                    </Button>
                  )
                })}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={loading || page === totalPages}
                  className="px-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="text-sm text-text-secondary">
              Showing{' '}
              <span className="font-semibold text-text-primary">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-text-primary">
                {total.toLocaleString()}
              </span>{' '}
              announcements
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
