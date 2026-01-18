'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { adminAPI } from '@/lib/api'
import {
    ArrowLeft,
    RefreshCw,
    Play,
    Loader2,
    Calendar,
    FileText,
    TrendingUp,
    Search,
    X,
    Plus,
    Trash2,
    Settings
} from 'lucide-react'
import Link from 'next/link'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Button } from '@/components/ui/Button'

export default function IpoDetailsPage() {
    const [activeTab, setActiveTab] = useState<'nse' | 'bse' | 'gmp'>('nse')
    const [tableData, setTableData] = useState<any[]>([])
    const [dataLoading, setDataLoading] = useState(false)
    const [running, setRunning] = useState(false)
    const [statusMsg, setStatusMsg] = useState('')
    const [selectedIpo, setSelectedIpo] = useState<any | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSchedulerOpen, setIsSchedulerOpen] = useState(false)

    const loadData = async () => {
        try {
            setDataLoading(true)
            let type = 'ipo'
            if (activeTab === 'bse') type = 'bse-ipo'
            if (activeTab === 'gmp') type = 'gmp-ipo'

            const res = await adminAPI.getProcessorData(type)
            setTableData(res || [])
        } catch (e) {
            console.error(`Failed to load ${activeTab} data`, e)
        } finally {
            setDataLoading(false)
        }
    }

    // Reset state when changing tabs
    useEffect(() => {
        setTableData([])
        setStatusMsg('')
        setRunning(false)
        setSearchQuery('')
        loadData()
    }, [activeTab])

    const handleRunScraper = async () => {
        try {
            setRunning(true)
            setStatusMsg('Starting...')

            if (activeTab === 'nse') {
                await adminAPI.runIpoScraper()
            } else if (activeTab === 'bse') {
                await adminAPI.runBseScraper()
            } else if (activeTab === 'gmp') {
                await adminAPI.runGmpScraper()
            }

            // Poll for status
            const pollInterval = setInterval(async () => {
                try {
                    let status;
                    if (activeTab === 'nse') status = await adminAPI.getIpoScraperStatus()
                    else if (activeTab === 'bse') status = await adminAPI.getBseScraperStatus()
                    else if (activeTab === 'gmp') status = await adminAPI.getGmpScraperStatus()

                    if (status.is_running) {
                        // Map backend steps to readable messages
                        const stepMap: Record<string, string> = {
                            'INITIALIZING': 'Initializing...',
                            'LOADING': 'Loading Page...',
                            'SCRAPING': 'Scraping Data...',
                            'SCRAPING_CURRENT': 'Scraping Current...',
                            'SCRAPING_UPCOMING': 'Scraping Upcoming...',
                            'SAVING': 'Saving Data...',
                        }
                        setStatusMsg(stepMap[status.current_step] || 'Running...')
                    } else {
                        // Scraper finished (or error/idle)
                        clearInterval(pollInterval)

                        if (status.current_step === 'ERROR') {
                            setStatusMsg('Failed')
                            setRunning(false)
                            setTimeout(() => setStatusMsg(''), 3000)
                        } else {
                            setStatusMsg('Done')
                            setRunning(false)

                            // Refresh data
                            await loadData()
                            setTimeout(() => setStatusMsg(''), 2000)
                        }
                    }
                } catch (e) {
                    console.error('Poll error', e)
                }
            }, 1000)

            // Safety timeout - stop polling after 2 minutes
            setTimeout(() => {
                clearInterval(pollInterval)
                if (running) {
                    setRunning(false)
                    setStatusMsg('Timeout')
                }
            }, 120000)

        } catch (e) {
            console.error('Failed to run scraper', e)
            setRunning(false)
            setStatusMsg('Failed')
            setTimeout(() => setStatusMsg(''), 3000)
        }
    }

    const filteredData = tableData.filter(item => {
        const query = searchQuery.toLowerCase()
        if (activeTab === 'nse') {
            return item.company_name?.toLowerCase().includes(query) ||
                item.symbol?.toLowerCase().includes(query)
        } else if (activeTab === 'bse') {
            return item.security_name?.toLowerCase().includes(query) ||
                item.issue_type?.toLowerCase().includes(query)
        } else if (activeTab === 'gmp') {
            return item.ipo_name?.toLowerCase().includes(query)
        }
        return false
    })

    const getButtonColor = () => {
        if (activeTab === 'bse') return 'bg-orange-600 hover:bg-orange-700'
        if (activeTab === 'gmp') return 'bg-purple-600 hover:bg-purple-700'
        return ''
    }

    // Simplified Search Logic
    const handleSearchChange = (val: string) => {
        setSearchQuery(val)
    }

    return (
        <div className="space-y-6">
            {/* Sticky Header Container */}
            <div className="sticky top-0 z-50 bg-page-bg dark:bg-[#0e1628] -mx-4 -mt-4 px-4 pt-4 border-b border-[#1f2a44] mb-6 space-y-4 shadow-sm">
                {/* Top Row: Title & Actions */}
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/processors" className="p-2 hover:bg-[#1f2a44] rounded-lg transition-colors text-text-secondary hover:text-text-primary">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold font-sans text-text-primary dark:text-[#e5e7eb] mb-1">
                                IPO Scrapers
                            </h1>
                            <p className="text-sm font-sans text-text-secondary dark:text-[#9ca3af]">
                                Manage and view data from NSE, BSE, and GMP scrapers
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Run Scraper Split Button */}
                        <div className="flex items-center">
                            <Button
                                onClick={handleRunScraper}
                                variant="primary"
                                size="sm"
                                disabled={running}
                                className={`gap-2 rounded-r-none border-r-2 border-white/30 min-w-[120px] justify-center text-white ${getButtonColor()}`}
                            >
                                {running ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4" />
                                )}
                                {statusMsg && !running ? statusMsg : 'Run Scraper'}
                            </Button>
                            <Button
                                onClick={() => setIsSchedulerOpen(true)}
                                variant="primary"
                                size="sm"
                                className={`rounded-l-none px-2 text-white/80 hover:text-white ${getButtonColor()}`}
                            >
                                <Settings className="w-4 h-4" />
                            </Button>
                        </div>
                        <RefreshButton
                            onClick={async () => await loadData()}
                            disabled={dataLoading}
                        />
                    </div>
                </div >

                {/* Bottom Row: Tabs & Search */}
                < div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4" >
                    {/* Tabs */}
                    < div className="flex gap-6 overflow-x-auto no-scrollbar -mb-px" >
                        <button
                            onClick={() => setActiveTab('nse')}
                            className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${activeTab === 'nse'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-text-secondary/20'
                                }`}
                        >
                            1. NSE IPOs
                        </button>
                        <button
                            onClick={() => setActiveTab('bse')}
                            className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${activeTab === 'bse'
                                ? 'border-orange-500 text-orange-500'
                                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-text-secondary/20'
                                }`}
                        >
                            2. BSE Public Issues
                        </button>
                        <button
                            onClick={() => setActiveTab('gmp')}
                            className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${activeTab === 'gmp'
                                ? 'border-purple-500 text-purple-500'
                                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-text-secondary/20'
                                }`}
                        >
                            3. IPO GMP
                        </button>
                    </div >

                    {/* Search */}
                    < div className="relative max-w-sm w-full mb-2" >
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-text-tertiary" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search IPOs..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full bg-panel/50 dark:bg-panel/20 border border-border/50 rounded-xl py-2 pl-10 pr-10 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-text-tertiary font-medium"
                        />
                        {
                            searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-3 flex items-center text-text-tertiary hover:text-text-primary transition-colors"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )
                        }
                    </div >
                </div >
            </div >

            {/* Data Tables Section */}
            < div className="space-y-4" >
                <Card className="bg-[#121b2f] border-[#1f2a44] overflow-hidden p-0">
                    {dataLoading ? (
                        <div className="p-8 text-center text-text-secondary">Loading Data...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                {activeTab === 'nse' && (
                                    <>
                                        <TableHeader>
                                            <TableHeaderCell>Type</TableHeaderCell>
                                            <TableHeaderCell>Company</TableHeaderCell>
                                            <TableHeaderCell>Symbol</TableHeaderCell>
                                            <TableHeaderCell>Dates</TableHeaderCell>
                                            <TableHeaderCell>Price Range</TableHeaderCell>
                                            <TableHeaderCell>Issue Size</TableHeaderCell>
                                            <TableHeaderCell>Status</TableHeaderCell>
                                            <TableHeaderCell>Subs.</TableHeaderCell>
                                            <TableHeaderCell>Scraped At</TableHeaderCell>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredData.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={9} className="text-center text-text-secondary">No recent data found.</TableCell>
                                                </TableRow>
                                            ) : filteredData.map((row: any, idx) => (
                                                <TableRow key={idx} index={idx} onClick={() => setSelectedIpo(row)} className="cursor-pointer hover:bg-white/5">
                                                    <TableCell>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.type === 'CURRENT' ? 'bg-success/10 text-success' : 'bg-purple-500/10 text-purple-500'}`}>
                                                            {row.type}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-text-primary dark:text-[#e5e7eb] text-xs">{row.company_name}</TableCell>
                                                    <TableCell className="font-mono text-xs text-text-secondary">{row.symbol}</TableCell>
                                                    <TableCell className="text-xs text-text-secondary">
                                                        {row.issue_start_date} - {row.issue_end_date}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-text-primary font-mono">{row.price_range}</TableCell>
                                                    <TableCell className="text-xs text-text-secondary">{row.issue_size}</TableCell>
                                                    <TableCell className="text-xs text-text-primary">{row.status}</TableCell>
                                                    <TableCell className="text-xs text-text-secondary font-mono">{row.subscription}</TableCell>
                                                    <TableCell className="text-xs text-text-secondary opacity-75">{row.scraped_at}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </>
                                )}
                                {activeTab === 'bse' && (
                                    <>
                                        <TableHeader>
                                            <TableHeaderCell>Security Name</TableHeaderCell>
                                            <TableHeaderCell>Platform</TableHeaderCell>
                                            <TableHeaderCell>Open/Close</TableHeaderCell>
                                            <TableHeaderCell>Price & Value</TableHeaderCell>
                                            <TableHeaderCell>Type</TableHeaderCell>
                                            <TableHeaderCell>Status</TableHeaderCell>
                                            <TableHeaderCell>Scraped At</TableHeaderCell>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredData.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center text-text-secondary">No recent data found.</TableCell>
                                                </TableRow>
                                            ) : filteredData.map((item: any, idx) => (
                                                <TableRow key={idx} index={idx} onClick={() => setSelectedIpo(item)} className="cursor-pointer hover:bg-white/5">
                                                    <TableCell className="font-medium text-text-primary dark:text-[#e5e7eb] text-xs">
                                                        {item.security_name}
                                                    </TableCell>
                                                    <TableCell className="text-text-secondary dark:text-[#9ca3af] text-xs">
                                                        {item.exchange_platform}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col text-xs">
                                                            <span className="text-text-primary dark:text-[#e5e7eb] flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 text-green-500" /> {item.start_date}
                                                            </span>
                                                            <span className="text-text-secondary dark:text-[#9ca3af] flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 text-red-400" /> {item.end_date}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col text-xs">
                                                            <span className="text-text-primary dark:text-[#e5e7eb]">
                                                                Price: {item.offer_price}
                                                            </span>
                                                            <span className="text-text-secondary dark:text-[#9ca3af]">
                                                                FV: {item.face_value}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-foreground border-border/50">
                                                            {item.issue_type}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span
                                                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ${item.status?.toLowerCase().includes('open')
                                                                ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                                                : 'bg-text-secondary/10 text-text-secondary'
                                                                }`}
                                                        >
                                                            {item.status}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-text-secondary dark:text-[#9ca3af] whitespace-nowrap">
                                                        {item.scraped_at}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </>
                                )}
                                {activeTab === 'gmp' && (
                                    <>
                                        <TableHeader>
                                            <TableHeaderCell>IPO Name</TableHeaderCell>
                                            <TableHeaderCell>GMP</TableHeaderCell>
                                            <TableHeaderCell>Price</TableHeaderCell>
                                            <TableHeaderCell>Exp. Gain</TableHeaderCell>
                                            <TableHeaderCell>Updated</TableHeaderCell>
                                            <TableHeaderCell>Type</TableHeaderCell>
                                            <TableHeaderCell>Scraped At</TableHeaderCell>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredData.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center text-text-secondary">No recent data found.</TableCell>
                                                </TableRow>
                                            ) : filteredData.map((item: any, idx) => (
                                                <TableRow key={idx} index={idx} onClick={() => setSelectedIpo(item)} className="cursor-pointer hover:bg-white/5">
                                                    <TableCell className="font-semibold text-text-primary dark:text-[#e5e7eb] text-xs">
                                                        {item.ipo_name}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-green-500 text-xs">
                                                        ₹{item.gmp?.toString().replace(/[₹,]/g, '')}
                                                    </TableCell>
                                                    <TableCell className="text-text-secondary text-xs">
                                                        ₹{item.ipo_price?.toString().replace(/[₹,]/g, '')}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-text-primary">
                                                        {item.expected_listing_gain?.toString().replace(/%/g, '')}%
                                                    </TableCell>
                                                    <TableCell className="text-xs text-text-secondary">
                                                        {item.gmp_updated_date}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent text-foreground border-border/50">
                                                            {item.ipo_type}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-text-secondary opacity-75">
                                                        {item.scraped_at}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </>
                                )}
                            </Table>
                        </div>
                    )}
                </Card>
            </div >

            <Modal
                isOpen={!!selectedIpo}
                onClose={() => setSelectedIpo(null)}
                title={selectedIpo?.company_name || selectedIpo?.security_name || selectedIpo?.ipo_name || 'Details'}
            >
                <div className="space-y-4 text-sm text-text-secondary">
                    <div className="grid grid-cols-2 gap-4">
                        {activeTab === 'nse' && (
                            <>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Symbol</label><div className="text-text-primary">{selectedIpo?.symbol}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Type</label><div className="text-text-primary">{selectedIpo?.type}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Issue Period</label><div className="text-text-primary">{selectedIpo?.issue_start_date} to {selectedIpo?.issue_end_date}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Price Range</label><div className="text-text-primary">{selectedIpo?.price_range}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Status</label><div className="text-text-primary">{selectedIpo?.status}</div></div>
                            </>
                        )}
                        {activeTab === 'bse' && (
                            <>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Platform</label><div className="text-text-primary">{selectedIpo?.exchange_platform}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Type</label><div className="text-text-primary">{selectedIpo?.issue_type}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Period</label><div className="text-text-primary">{selectedIpo?.start_date} to {selectedIpo?.end_date}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Price</label><div className="text-text-primary">{selectedIpo?.offer_price}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Status</label><div className="text-text-primary">{selectedIpo?.status}</div></div>
                            </>
                        )}
                        {activeTab === 'gmp' && (
                            <>
                                <div><label className="text-xs font-semibold text-text-secondary/70">GMP</label><div className="text-green-500 font-mono">₹{selectedIpo?.gmp?.toString().replace(/[₹,]/g, '')}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Price</label><div className="text-text-primary">₹{selectedIpo?.ipo_price?.toString().replace(/[₹,]/g, '')}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Type</label><div className="text-text-primary">{selectedIpo?.ipo_type}</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Gain</label><div className="text-text-primary">{selectedIpo?.expected_listing_gain?.toString().replace(/%/g, '')}%</div></div>
                                <div><label className="text-xs font-semibold text-text-secondary/70">Review</label><div className="text-text-primary">{selectedIpo?.review}</div></div>
                            </>
                        )}
                        <div><label className="text-xs font-semibold text-text-secondary/70">Scraped At</label><div className="text-text-primary">{selectedIpo?.scraped_at}</div></div>
                    </div>
                </div>
            </Modal>

            <SchedulerModal
                isOpen={isSchedulerOpen}
                onClose={() => setIsSchedulerOpen(false)}
                activeTab={activeTab}
            />
        </div >
    )
}

function SchedulerModal({ isOpen, onClose, activeTab }: { isOpen: boolean, onClose: () => void, activeTab: string }) {
    const [scheduleType, setScheduleType] = useState<'interval' | 'cron'>('interval')
    const [interval, setInterval] = useState('24')
    const [customInterval, setCustomInterval] = useState('')
    const [time, setTime] = useState('10:00')
    const [selectedDays, setSelectedDays] = useState<string[]>([])
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
    const [schedules, setSchedules] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)

    const days = [
        { value: 'mon', label: 'Mon' },
        { value: 'tue', label: 'Tue' },
        { value: 'wed', label: 'Wed' },
        { value: 'thu', label: 'Thu' },
        { value: 'fri', label: 'Fri' },
        { value: 'sat', label: 'Sat' },
        { value: 'sun', label: 'Sun' }
    ]

    // Load all schedules when modal opens
    const loadSchedules = () => {
        setLoading(true)
        const scraperType = activeTab === 'nse' ? 'ipo' : activeTab
        adminAPI.getSchedule(scraperType)
            .then(res => {
                if (res.status === 'active' && res.schedules) {
                    setSchedules(res.schedules)
                } else {
                    setSchedules([])
                }
            })
            .catch(() => setSchedules([]))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        if (isOpen) {
            loadSchedules()
            setShowAddForm(false)
        }
    }, [isOpen, activeTab])

    const toggleDay = (day: string) => {
        if (selectedDays.includes(day)) {
            setSelectedDays(selectedDays.filter(d => d !== day))
        } else {
            setSelectedDays([...selectedDays, day])
        }
    }

    const resetForm = () => {
        setScheduleType('interval')
        setInterval('24')
        setCustomInterval('')
        setTime('10:00')
        setSelectedDays([])
    }

    const formatSchedule = (trigger: string) => {
        // Parse the trigger string to make it human-readable
        // Example: "cron[day_of_week='mon,tue,wed,thu,fri', hour='10', minute='0']"
        // Example: "interval[0:24:00:00]"

        if (trigger.startsWith('cron')) {
            const match = trigger.match(/hour='(\d+)'.*minute='(\d+)'/)
            const daysMatch = trigger.match(/day_of_week='([^']+)'/)

            if (match) {
                const hour = match[1].padStart(2, '0')
                const minute = match[2].padStart(2, '0')
                const time = `${hour}:${minute}`

                if (daysMatch) {
                    const days = daysMatch[1].split(',').map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
                    return `Daily at ${time} on ${days}`
                }
                return `Daily at ${time}`
            }
        } else if (trigger.startsWith('interval')) {
            const match = trigger.match(/interval\[(\d+):(\d+):(\d+):(\d+)\]/)
            if (match) {
                const days = parseInt(match[1])
                const hours = parseInt(match[2])
                const minutes = parseInt(match[3])

                if (days > 0) return `Every ${days} day${days > 1 ? 's' : ''}`
                if (hours > 0) return `Every ${hours} hour${hours > 1 ? 's' : ''}`
                if (minutes > 0) return `Every ${minutes} minute${minutes > 1 ? 's' : ''}`
            }
        }

        return trigger // Fallback to raw string
    }

    const handleAddSchedule = async () => {
        setStatus('saving')
        try {
            // Map frontend tab names to backend scraper types
            const scraperType = activeTab === 'nse' ? 'ipo' : activeTab
            let payload: any = { type: scraperType, schedule_type: scheduleType }

            if (scheduleType === 'interval') {
                const hrs = interval === 'custom' ? parseInt(customInterval) : parseInt(interval)
                if (!hrs || hrs <= 0) {
                    setStatus('error')
                    return
                }
                payload.hours = hrs
            } else {
                payload.time = time
                if (selectedDays.length > 0) {
                    payload.days = selectedDays
                }
            }

            await adminAPI.setSchedule(scraperType, payload.hours, payload)
            setStatus('success')

            // Reload schedules
            loadSchedules()
            resetForm()
            setShowAddForm(false)

            setTimeout(() => {
                setStatus('idle')
            }, 1000)
        } catch (e) {
            console.error(e)
            setStatus('error')
        }
    }

    const handleDeleteSchedule = async (jobId: string) => {
        try {
            const scraperType = activeTab === 'nse' ? 'ipo' : activeTab
            await adminAPI.cancelSchedule(scraperType, jobId)
            loadSchedules()
        } catch (e) {
            console.error(e)
        }
    }

    const handleDeleteAll = async () => {
        setStatus('saving')
        try {
            const scraperType = activeTab === 'nse' ? 'ipo' : activeTab
            await adminAPI.cancelSchedule(scraperType)
            setStatus('success')
            loadSchedules()
            setTimeout(() => {
                setStatus('idle')
                onClose()
            }, 1000)
        } catch (e) {
            console.error(e)
            setStatus('error')
        }
    }

    const getTitle = () => {
        if (activeTab === 'nse') return 'Schedule NSE IPO Scraper'
        if (activeTab === 'bse') return 'Schedule BSE IPO Scraper'
        if (activeTab === 'gmp') return 'Schedule GMP Scraper'
        return 'Scheduler'
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
            <div className="space-y-6">
                <div className="text-sm text-text-secondary">
                    Configure when this scraper should run automatically. You can create up to 5 schedules.
                </div>

                {loading ? (
                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>
                ) : (
                    <>
                        {/* Existing Schedules List */}
                        {schedules.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-text-secondary uppercase">Active Schedules ({schedules.length}/5)</label>
                                <div className="space-y-2">
                                    {schedules.map((schedule) => (
                                        <div
                                            key={schedule.id}
                                            className="bg-panel border border-border rounded-lg p-3 flex items-start justify-between transition-all duration-200 hover:shadow-md"
                                        >
                                            <div className="flex-1">
                                                <p className="text-sm text-text-primary font-medium">{formatSchedule(schedule.trigger)}</p>
                                                <p className="text-xs text-text-tertiary mt-0.5">
                                                    Next run: {new Date(schedule.next_run_time).toLocaleString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteSchedule(schedule.id)}
                                                className="ml-3 p-1.5 text-red-500 rounded transition-all duration-200 hover:scale-125"
                                                title="Delete schedule"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add Schedule Button / Form */}
                        {!showAddForm && schedules.length < 5 && (
                            <Button
                                onClick={() => setShowAddForm(true)}
                                variant="secondary"
                                className="w-full justify-center"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Schedule
                            </Button>
                        )}

                        {/* Add Schedule Form */}
                        {showAddForm && (
                            <>
                                {/* Schedule Type Toggle */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-text-secondary uppercase">Schedule Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setScheduleType('interval')}
                                            className={`px-4 py-2 rounded-lg text-sm border transition-all duration-200 hover:scale-105 hover:shadow-md ${scheduleType === 'interval'
                                                ? 'bg-primary/10 border-primary text-primary'
                                                : 'bg-panel border-border hover:border-primary/50 text-text-secondary'
                                                }`}
                                        >
                                            Interval
                                        </button>
                                        <button
                                            onClick={() => setScheduleType('cron')}
                                            className={`px-4 py-2 rounded-lg text-sm border transition-all duration-200 hover:scale-105 hover:shadow-md ${scheduleType === 'cron'
                                                ? 'bg-primary/10 border-primary text-primary'
                                                : 'bg-panel border-border hover:border-primary/50 text-text-secondary'
                                                }`}
                                        >
                                            Specific Time
                                        </button>
                                    </div>
                                </div>

                                {/* Interval Options */}
                                {scheduleType === 'interval' && (
                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-text-secondary uppercase">Run Every</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['1', '4', '6', '12', '24'].map((hr) => (
                                                <button
                                                    key={hr}
                                                    onClick={() => setInterval(hr)}
                                                    className={`px-4 py-2 rounded-lg text-sm border transition-all duration-200 hover:scale-105 hover:shadow-md ${interval === hr
                                                        ? 'bg-primary/10 border-primary text-primary'
                                                        : 'bg-panel border-border hover:border-primary/50 text-text-secondary'
                                                        }`}
                                                >
                                                    {hr}h
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setInterval('custom')}
                                                className={`px-4 py-2 rounded-lg text-sm border transition-all duration-200 hover:scale-105 hover:shadow-md ${interval === 'custom'
                                                    ? 'bg-primary/10 border-primary text-primary'
                                                    : 'bg-panel border-border hover:border-primary/50 text-text-secondary'
                                                    }`}
                                            >
                                                Custom
                                            </button>
                                        </div>

                                        {interval === 'custom' && (
                                            <div className="space-y-1">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="168"
                                                    value={customInterval}
                                                    onChange={(e) => setCustomInterval(e.target.value)}
                                                    placeholder="Enter hours (1-168)"
                                                    className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                                                />
                                                <p className="text-xs text-text-tertiary">Max: 168 hours (1 week)</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Cron Options */}
                                {scheduleType === 'cron' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-text-secondary uppercase">Time</label>
                                            <input
                                                type="time"
                                                value={time}
                                                onChange={(e) => setTime(e.target.value)}
                                                className="w-full bg-panel border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-text-secondary uppercase">Days (Optional)</label>
                                            <div className="grid grid-cols-7 gap-1">
                                                {days.map((day) => (
                                                    <button
                                                        key={day.value}
                                                        onClick={() => toggleDay(day.value)}
                                                        className={`px-2 py-2 rounded-lg text-xs border transition-all duration-200 hover:scale-105 hover:shadow-md ${selectedDays.includes(day.value)
                                                            ? 'bg-primary/10 border-primary text-primary'
                                                            : 'bg-panel border-border hover:border-primary/50 text-text-secondary'
                                                            }`}
                                                    >
                                                        {day.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-xs text-text-tertiary">Leave all unselected to run every day</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleAddSchedule}
                                        disabled={status === 'saving'}
                                        className="flex-1 justify-center"
                                    >
                                        {status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                            status === 'success' ? 'Added!' : 'Add Schedule'}
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setShowAddForm(false)
                                            resetForm()
                                        }}
                                        variant="secondary"
                                        className="px-4"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* Delete All Button */}
                        {schedules.length > 0 && !showAddForm && (
                            <Button
                                onClick={handleDeleteAll}
                                disabled={status === 'saving'}
                                variant="danger"
                                className="w-full justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete All Schedules
                            </Button>
                        )}
                    </>
                )}
            </div>
        </Modal>
    )
}
