import { useState, type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string
  alt?: string
  /** Shown when `src` is absent or fails to load. */
  name?: string
  size?: AvatarSize
}

const SIZES: Record<AvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/** Image avatar that falls back to initials on a missing `src` or a load error. */
export function Avatar({ src, alt, name, size = 'md', className, ...rest }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-surface-raised font-medium text-text-muted select-none',
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt ?? name ?? ''}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden={Boolean(alt)}>{name ? initials(name) : null}</span>
      )}
    </span>
  )
}
