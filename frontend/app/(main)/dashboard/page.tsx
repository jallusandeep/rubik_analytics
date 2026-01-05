'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { announcementsAPI } from '@/lib/api'
import { RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, X, Download } from 'lucide-react'

interface Announcement {
  announcement_id: string
  symbol: string
  symbol_nse: string
  symbol_bse: string
  exchange: string
  headline: string
  description: string
  category: string
  announcement_datetime: string
  received_at: string
  attachment_id: string | null
  company_name: string | null
  price?: number
  price_change?: number
}


export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'announcements'>('overview')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  
  // Search state
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Fetch announcements from DuckDB
  const fetchAnnouncements = useCallback(async (currentPage: number = page, currentPageSize: number = pageSize, searchTerm?: string) => {
    setLoading(true)
    try {
      const offset = (currentPage - 1) * currentPageSize
      const response = await announcementsAPI.getAnnouncements(currentPageSize, offset, searchTerm || searchQuery)
      setAnnouncements(response.announcements || [])
      setTotal(response.total || 0)
      setTotalPages(Math.ceil((response.total || 0) / currentPageSize))
    } catch (error) {
      console.error('Error fetching announcements:', error)
      setAnnouncements([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery])

  // Initial load when announcements tab is active
  useEffect(() => {
    if (activeTab === 'announcements') {
      fetchAnnouncements(1, pageSize)
    }
  }, [activeTab])

  // Handle search
  const handleSearchChange = (val: string) => {
    setSearch(val)
  }

  const handleSearchClick = () => {
    setSearchQuery(search)
    setPage(1)
    fetchAnnouncements(1, pageSize, search)
  }

  const handleClearSearch = () => {
    setSearch('')
    setSearchQuery('')
    setPage(1)
    fetchAnnouncements(1, pageSize, '')
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearchClick()
    }
  }

  // Handle attachment download
  const handleDownloadAttachment = async (announcementId: string) => {
    try {
      const blob = await announcementsAPI.downloadAttachment(announcementId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `announcement_${announcementId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading attachment:', error)
      alert('Failed to download attachment. Please try again.')
    }
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
      fetchAnnouncements(newPage, pageSize)
    }
  }

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
    fetchAnnouncements(1, newPageSize)
  }

  // Toggle row expansion
  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Generate page numbers with ellipsis (same as symbols page)
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (page <= 3) {
        // Near the start
        for (let i = 2; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (page >= totalPages - 2) {
        // Near the end
        pages.push('ellipsis')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // In the middle
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


  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return null
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return null
    }
  }

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return null
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sans font-semibold text-text-primary mb-1">
            Dashboard
          </h1>
          <p className="text-xs font-sans text-text-secondary">
            System overview and analytics metrics
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[#1f2a44] mb-6">
        <button
          className={`pb-2 px-1 text-sm font-medium transition-colors ${
            activeTab === 'overview' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium transition-colors ${
            activeTab === 'announcements' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('announcements')}
        >
          Latest Corporate Announcements
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card compact>
          <div className="space-y-1">
            <p className="text-xs font-sans text-text-secondary uppercase tracking-wider">Total Symbols</p>
            <p className="text-xl font-sans font-semibold text-text-primary">1,234</p>
            <p className="text-[10px] font-sans text-success">+12% from last month</p>
          </div>
        </Card>

        <Card compact>
          <div className="space-y-1">
            <p className="text-xs font-sans text-text-secondary uppercase tracking-wider">Active Signals</p>
            <p className="text-xl font-sans font-semibold text-text-primary">89</p>
            <p className="text-[10px] font-sans text-success">+5 new today</p>
          </div>
        </Card>

        <Card compact>
          <div className="space-y-1">
            <p className="text-xs font-sans text-text-secondary uppercase tracking-wider">ML Models</p>
            <p className="text-xl font-sans font-semibold text-text-primary">12</p>
            <p className="text-[10px] font-sans text-text-secondary">All active</p>
          </div>
        </Card>

        <Card compact>
          <div className="space-y-1">
            <p className="text-xs font-sans text-text-secondary uppercase tracking-wider">Accuracy</p>
            <p className="text-xl font-sans font-semibold text-text-primary">87.5%</p>
            <p className="text-[10px] font-sans text-success">+2.3% improvement</p>
          </div>
        </Card>
      </div>

      {/* Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Recent Activity" compact>
          <Table>
            <TableHeader>
              <TableHeaderCell>Event</TableHeaderCell>
              <TableHeaderCell className="text-right">Time</TableHeaderCell>
            </TableHeader>
            <TableBody>
              <TableRow index={0}>
                <TableCell>New signal generated</TableCell>
                <TableCell numeric className="text-text-secondary">2h ago</TableCell>
              </TableRow>
              <TableRow index={1}>
                <TableCell>AAPL - Buy signal</TableCell>
                <TableCell numeric className="text-text-secondary">2h ago</TableCell>
              </TableRow>
              <TableRow index={2}>
                <TableCell>Model updated</TableCell>
                <TableCell numeric className="text-text-secondary">5h ago</TableCell>
              </TableRow>
              <TableRow index={3}>
                <TableCell>RSI Indicator v2.1</TableCell>
                <TableCell numeric className="text-text-secondary">5h ago</TableCell>
              </TableRow>
              <TableRow index={4}>
                <TableCell>Data sync completed</TableCell>
                <TableCell numeric className="text-text-secondary">1d ago</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        <Card title="System Status" compact>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-xs font-sans text-text-secondary">Backend API</span>
              <span className="text-xs font-sans text-success">ONLINE</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-xs font-sans text-text-secondary">Database</span>
              <span className="text-xs font-sans text-success">CONNECTED</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-xs font-sans text-text-secondary">Analytics Engine</span>
              <span className="text-xs font-sans text-success">ACTIVE</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs font-sans text-text-secondary">Last Sync</span>
              <span className="text-xs font-sans text-text-secondary">12:34:56</span>
            </div>
          </div>
        </Card>
      </div>
        </>
      )}

      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {/* Header with Refresh Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-sans font-semibold text-text-primary">
                Latest Corporate Announcements
              </h2>
            </div>
            <RefreshButton
              variant="secondary"
              onClick={async () => {
                await fetchAnnouncements(page, pageSize, searchQuery)
              }}
              size="sm"
              disabled={loading}
            />
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Input
                type="text"
                placeholder="Search by symbol, company name, or headline..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10 pr-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
              {search && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSearchClick}
              disabled={loading}
            >
              Search
            </Button>
          </div>

          <Card compact>
            {loading && announcements.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-text-secondary" />
                <span className="ml-2 text-sm text-text-secondary">Loading announcements...</span>
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <p>No announcements available</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableHeaderCell className="w-36">Date & Time</TableHeaderCell>
                      <TableHeaderCell className="w-40">Company</TableHeaderCell>
                      <TableHeaderCell className="w-32">Symbol</TableHeaderCell>
                      <TableHeaderCell className="min-w-[400px]">Headline</TableHeaderCell>
                      <TableHeaderCell className="w-32">Category</TableHeaderCell>
                      <TableHeaderCell className="w-24">Actions</TableHeaderCell>
                    </TableHeader>
                    <TableBody>
                      {announcements.map((announcement, index) => {
                        const isExpanded = expandedRows.has(announcement.announcement_id)
                        const isFirstRow = index === 0
                        return (
                          <TableRow key={announcement.announcement_id} index={index}>
                            <TableCell className="text-sm">
                              {(() => {
                                const annDate = formatDateTime(announcement.announcement_datetime || announcement.received_at)
                                const receivedDate = formatDateTime(announcement.received_at)
                                
                                if (annDate || receivedDate) {
                                  return (
                                    <div>
                                      {annDate && (
                                        <div className="font-medium text-text-primary">
                                          {annDate}
                                        </div>
                                      )}
                                      {receivedDate && receivedDate !== annDate && (
                                        <div className="text-xs text-text-secondary mt-0.5">
                                          Received: {receivedDate}
                                        </div>
                                      )}
                                    </div>
                                  )
                                }
                                return null
                              })()}
                            </TableCell>
                            <TableCell className="text-sm text-text-primary">
                              <div>
                                <div className="font-medium">{announcement.company_name || '-'}</div>
                                {isFirstRow && (announcement.price !== undefined || announcement.price_change !== undefined) && (
                                  <div className="text-xs mt-1">
                                    {announcement.price !== undefined && (
                                      <span className="text-text-primary">₹{announcement.price.toFixed(2)}</span>
                                    )}
                                    {announcement.price_change !== undefined && (
                                      <span className={`ml-2 ${announcement.price_change >= 0 ? 'text-success' : 'text-error'}`}>
                                        {announcement.price_change >= 0 ? '+' : ''}{announcement.price_change.toFixed(2)}%
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col gap-1">
                                {announcement.symbol_nse && (
                                  <span className="font-mono text-xs text-primary">NSE: {announcement.symbol_nse}</span>
                                )}
                                {announcement.symbol_bse && (
                                  <span className="font-mono text-xs text-primary">BSE: {announcement.symbol_bse}</span>
                                )}
                                {!announcement.symbol_nse && !announcement.symbol_bse && (
                                  <span className="text-xs text-text-secondary">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-text-primary">
                              <div className="font-medium">{announcement.headline || '-'}</div>
                              {announcement.description && (
                                <div className="text-xs text-text-secondary mt-1 line-clamp-2">{announcement.description}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-text-secondary">
                              {announcement.category || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {announcement.description && (
                                  <button
                                    onClick={() => toggleRowExpansion(announcement.announcement_id)}
                                    className="p-1 hover:bg-background/50 rounded transition-colors"
                                    title={isExpanded ? 'Collapse' : 'Expand'}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-text-secondary" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-text-secondary" />
                                    )}
                                  </button>
                                )}
                                {announcement.attachment_id && (
                                  <button
                                    onClick={() => handleDownloadAttachment(announcement.announcement_id)}
                                    className="p-1 hover:bg-background/50 rounded transition-colors"
                                    title="Download attachment"
                                  >
                                    <Download className="w-4 h-4 text-text-secondary" />
                                  </button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Expanded content */}
                {announcements.map((announcement) => {
                  if (!expandedRows.has(announcement.announcement_id) || !announcement.description) return null
                  return (
                    <div
                      key={`expanded-${announcement.announcement_id}`}
                      className="border-t border-border bg-background/30 p-4"
                    >
                      <div className="text-sm text-text-secondary whitespace-pre-wrap">
                        {announcement.description}
                      </div>
                    </div>
                  )
                })}

                {/* Pagination Controls */}
                {totalPages > 0 && (
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-4">
                    {/* Rows per page selector */}
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

                    {/* Page navigation */}
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

                      {/* Page numbers */}
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

                    {/* Page summary */}
                    <div className="text-sm text-text-secondary">
                      {total > 0 ? (
                        <>
                          Showing{' '}
                          <span className="font-semibold text-text-primary">
                            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
                          </span>{' '}
                          of <span className="font-semibold text-text-primary">{total}</span>
                        </>
                      ) : (
                        'No results'
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
