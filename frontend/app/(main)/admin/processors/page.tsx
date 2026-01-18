'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { adminAPI } from '@/lib/api'
import { FileText, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function ProcessorsPage() {
    const [stats, setStats] = useState({
        total: 0,
        processed: 0,
        pending: 0,
        duplicates: 0,
        total_enriched: 0,
        pending_enrichment: 0,
        ipo_current: 0,
        ipo_upcoming: 0,
        bse_total: 0,
        bse_open: 0,
        gmp_total: 0
    })
    const [loading, setLoading] = useState(true)

    const loadStats = async () => {
        try {
            const data = await adminAPI.getProcessorStats()
            if (data) {
                setStats({
                    total: data.total || 0,
                    processed: data.processed || 0,
                    pending: data.pending || 0,
                    duplicates: data.duplicates || 0,
                    total_enriched: data.total_enriched || 0,
                    pending_enrichment: data.pending_enrichment || 0,
                    ipo_current: data.ipo_current || 0,
                    ipo_upcoming: data.ipo_upcoming || 0,
                    bse_total: data.bse_total || 0,
                    bse_open: data.bse_open || 0,
                    gmp_total: data.gmp_total || 0
                })
            }

        } catch (e) {
            console.error('Error loading stats:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadStats()
        const interval = setInterval(loadStats, 5000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-sans font-semibold text-text-primary dark:text-[#e5e7eb] mb-1">
                    Processors
                </h1>
                <p className="text-xs font-sans text-text-secondary dark:text-[#9ca3af]">
                    Manage data processing pipelines
                </p>
            </div>

            <div className="flex flex-wrap justify-center gap-6 items-stretch mb-6">
                {/* News Processed Card */}
                <Card className="hover:shadow-lg transition-all duration-200 flex flex-col w-full max-w-sm">
                    <div className="p-6 flex flex-col h-full">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-primary/10">
                                    <FileText className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-sans font-semibold text-text-primary dark:text-[#e5e7eb]">
                                        News Processed
                                    </h3>
                                    <p className="text-xs font-sans text-text-secondary dark:text-[#9ca3af] mt-0.5">
                                        Telegram Extraction Pipeline
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stats List */}
                        {loading ? (
                            <div className="py-8 text-center text-text-secondary">Loading...</div>
                        ) : (
                            <div className="space-y-1 mb-6">
                                <div className="flex justify-between items-center p-1.5 bg-background/50 dark:bg-[#121b2f]/50 rounded text-sm">
                                    <span className="text-text-secondary dark:text-[#9ca3af]">Total Extracted</span>
                                    <span className="font-bold text-text-primary dark:text-[#e5e7eb]">{stats.total}</span>
                                </div>
                                <div className="flex justify-between items-center p-1.5 bg-success/5 rounded text-sm">
                                    <span className="text-success">Processed</span>
                                    <span className="font-bold text-success">{stats.processed}</span>
                                </div>
                                <div className="flex justify-between items-center p-1.5 bg-warning/5 rounded text-sm">
                                    <span className="text-warning">Pending</span>
                                    <span className="font-bold text-warning">{stats.pending}</span>
                                </div>
                                <div className="flex justify-between items-center p-1.5 bg-blue-500/5 rounded text-sm">
                                    <span className="text-blue-500">Pending to AI</span>
                                    <span className="font-bold text-blue-500">{stats.pending_enrichment}</span>
                                </div>
                                <div className="flex justify-between items-center p-1.5 bg-text-secondary/5 rounded text-sm">
                                    <span className="text-text-secondary dark:text-[#9ca3af]">Duplicates Removed</span>
                                    <span className="font-bold text-text-secondary dark:text-[#9ca3af]">{stats.duplicates}</span>
                                </div>
                            </div>
                        )}

                        <div className="mt-auto pt-4 flex items-center justify-between">
                            <p className="text-[10px] font-sans text-text-secondary dark:text-[#9ca3af]">
                                Tracks raw messages status.
                            </p>
                            <Link href="/admin/processors/details" className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1">
                                View Data Tables <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>
                </Card>

                {/* IPO Data Card */}
                <Card className="hover:shadow-lg transition-all duration-200 flex flex-col w-full max-w-sm">
                    <div className="p-6 flex flex-col h-full">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-purple-500/10">
                                    <FileText className="w-6 h-6 text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-sans font-semibold text-text-primary dark:text-[#e5e7eb]">
                                        IPO Data
                                    </h3>
                                    <p className="text-xs font-sans text-text-secondary dark:text-[#9ca3af] mt-0.5">
                                        NSE & BSE Public Issues
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stats List */}
                        {loading ? (
                            <div className="py-8 text-center text-text-secondary">Loading...</div>
                        ) : (
                            <div className="space-y-1 mb-6">
                                <div className="flex justify-between items-center p-1.5 bg-background/50 dark:bg-[#121b2f]/50 rounded text-sm">
                                    <span className="text-text-secondary dark:text-[#9ca3af]">NSE Upcoming</span>
                                    <span className="font-bold text-text-primary dark:text-[#e5e7eb]">{stats.ipo_upcoming}</span>
                                </div>
                                <div className="flex justify-between items-center p-1.5 bg-background/50 dark:bg-[#121b2f]/50 rounded text-sm">
                                    <span className="text-text-secondary dark:text-[#9ca3af]">NSE Current</span>
                                    <span className="font-bold text-text-primary dark:text-[#e5e7eb]">{stats.ipo_current}</span>
                                </div>
                                <div className="flex justify-between items-center p-1.5 bg-orange-500/5 rounded text-sm">
                                    <span className="text-orange-500">BSE Current</span>
                                    <span className="font-bold text-orange-500">{stats.bse_open}</span>
                                </div>
                                <div className="flex justify-between items-center p-1.5 bg-purple-500/5 rounded text-sm">
                                    <span className="text-purple-500">GMP Records</span>
                                    <span className="font-bold text-purple-500">{stats.gmp_total}</span>
                                </div>
                                <div className="flex justify-between items-center p-1.5 bg-background/50 dark:bg-[#121b2f]/50 rounded text-sm opacity-50">
                                    <span className="text-text-secondary dark:text-[#9ca3af]">Total Scraped</span>
                                    <span className="font-bold text-text-primary dark:text-[#e5e7eb]">
                                        {(stats.ipo_current || 0) + (stats.ipo_upcoming || 0) + (stats.bse_total || 0) + (stats.gmp_total || 0)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="mt-auto pt-4 flex items-center justify-between">
                            <p className="text-[10px] font-sans text-text-secondary dark:text-[#9ca3af]">
                                Tracks NSE and BSE IPO data.
                            </p>
                            <Link href="/admin/processors/ipo" className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1">
                                View Data Tables <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}
