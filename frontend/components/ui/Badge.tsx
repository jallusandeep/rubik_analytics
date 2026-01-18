import React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'destructive'
}

export function Badge({
    className,
    variant = 'default',
    ...props
}: BadgeProps) {
    const variants = {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'text-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
    }

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent",
                variants[variant],
                className
            )}
            {...props}
        />
    )
}
