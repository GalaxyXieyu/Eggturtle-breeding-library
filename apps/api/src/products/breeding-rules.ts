const CHANGE_MATE_RE = /(?:^|\n)\s*\d{1,2}\.\d{1,2}\s*更换配偶为\s*([^\s\n]+)/g
const CHANGE_MATE_LINE_RE = /^\s*\d{1,2}\.\d{1,2}\s*更换配偶为\s*[^\s\n]+/
const CHANGE_MATE_KEY_RE = /^\s*(\d{1,2}\.\d{1,2})\s*更换配偶为\s*([^\s\n#]+)/
const EGG_EVENT_LINE_RE = /^\s*\d{1,2}\.\d{1,2}\s*产\s*\d+\s*蛋\b/

const PAIR_TRANSITION_SUFFIX = '-换公过渡期'
const PAIR_TRANSITION_TAG_RE = /#TA_PAIR_TRANSITION=(\d+)\b/

export function normalizeCodeUpper(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }

  return normalized.toUpperCase()
}

export function canonicalMateCodeCandidates(code: string | null | undefined): string[] {
  const normalized = code?.trim()
  if (!normalized) {
    return []
  }

  const candidates = normalized.endsWith('公')
    ? [normalized, normalized.slice(0, -1)]
    : [normalized, `${normalized}公`]

  return Array.from(new Set(candidates.filter((item) => item.trim().length > 0)))
}

export function parseCurrentMateCode(description: string | null | undefined): string | null {
  if (!description) {
    return null
  }

  const matches = Array.from(description.matchAll(CHANGE_MATE_RE))
  if (matches.length === 0) {
    return null
  }

  let raw = matches[matches.length - 1]?.[1]?.trim() ?? ''
  if (!raw) {
    return null
  }

  if (raw.endsWith('公') && raw.length > 1) {
    raw = raw.slice(0, -1).trim()
  }

  return raw || null
}

function splitLines(text: string): { lines: string[]; trailingNewline: boolean } {
  const normalized = text.replace(/\r\n/g, '\n')
  const trailingNewline = normalized.endsWith('\n')
  const lines = normalized.split('\n')

  if (trailingNewline) {
    lines.pop()
  }

  return {
    lines,
    trailingNewline
  }
}

function joinLines(lines: string[], trailingNewline: boolean): string {
  const out = lines.join('\n')
  if (trailingNewline) {
    return `${out}\n`
  }

  return out
}

function changeMateKey(line: string): [string, string] | null {
  const match = line.match(CHANGE_MATE_KEY_RE)
  if (!match) {
    return null
  }

  return [match[1], match[2]]
}

function parseTransitionRemaining(line: string): number | null {
  const match = line.match(PAIR_TRANSITION_TAG_RE)
  if (!match) {
    return null
  }

  const parsed = Number.parseInt(match[1], 10)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

function setTransitionRemaining(line: string, remaining: number): string {
  const safeRemaining = Math.max(0, Math.floor(remaining))
  if (PAIR_TRANSITION_TAG_RE.test(line)) {
    return line.replace(PAIR_TRANSITION_TAG_RE, `#TA_PAIR_TRANSITION=${safeRemaining}`)
  }

  return `${line.trimEnd()} #TA_PAIR_TRANSITION=${safeRemaining}`
}

function countEggEventsAfterChange(lines: string[], changeIndex: number): number {
  let count = 0
  for (const line of lines.slice(changeIndex + 1)) {
    if (CHANGE_MATE_LINE_RE.test(line)) {
      break
    }

    if (EGG_EVENT_LINE_RE.test(line)) {
      count += 1
    }
  }

  return count
}

function computeNewLineIndices(oldLines: string[], newLines: string[]): Set<number> {
  if (oldLines.length <= newLines.length) {
    const oldJoined = oldLines.join('\u0000')
    const newPrefixJoined = newLines.slice(0, oldLines.length).join('\u0000')
    if (oldJoined === newPrefixJoined) {
      return new Set(Array.from({ length: newLines.length - oldLines.length }, (_, index) => oldLines.length + index))
    }
  }

  const oldCounts = new Map<string, number>()
  for (const line of oldLines) {
    const key = line.trimEnd()
    oldCounts.set(key, (oldCounts.get(key) ?? 0) + 1)
  }

  const newIndices = new Set<number>()
  newLines.forEach((line, index) => {
    const key = line.trimEnd()
    const current = oldCounts.get(key) ?? 0
    if (current > 0) {
      oldCounts.set(key, current - 1)
    } else {
      newIndices.add(index)
    }
  })

  return newIndices
}

export function processPairTransitionDescription(
  oldDescription: string | null | undefined,
  newDescription: string | null | undefined
): string | null {
  if (newDescription === null || typeof newDescription === 'undefined') {
    return null
  }

  const { lines: oldLines } = splitLines(oldDescription ?? '')
  const { lines: newLines, trailingNewline } = splitLines(newDescription)

  let changeIndex: number | null = null
  newLines.forEach((line, index) => {
    if (CHANGE_MATE_LINE_RE.test(line)) {
      changeIndex = index
    }
  })

  if (changeIndex === null) {
    return newDescription
  }

  const latestChangeIndex = changeIndex
  const lineAtChange = newLines[latestChangeIndex]
  let remaining = parseTransitionRemaining(lineAtChange)

  const newIndices = computeNewLineIndices(oldLines, newLines)
  const newEggIndices = Array.from(newIndices)
    .filter((index) => index > latestChangeIndex && EGG_EVENT_LINE_RE.test(newLines[index] ?? ''))
    .sort((left, right) => left - right)

  const shouldActivate =
    remaining !== null ||
    newIndices.has(latestChangeIndex) ||
    newEggIndices.length > 0

  if (remaining === null && !shouldActivate) {
    return newDescription
  }

  if (remaining === null) {
    const key = changeMateKey(lineAtChange)
    let oldChangeIndex: number | null = null

    if (key) {
      oldLines.forEach((line, index) => {
        if (oldChangeIndex !== null) {
          return
        }

        const currentKey = changeMateKey(line)
        if (currentKey && currentKey[0] === key[0] && currentKey[1] === key[1]) {
          oldChangeIndex = index
        }
      })
    }

    const existingEggCount = oldChangeIndex === null ? 0 : countEggEventsAfterChange(oldLines, oldChangeIndex)
    remaining = Math.max(0, 2 - existingEggCount)
  }

  for (const index of newEggIndices) {
    if (remaining <= 0) {
      break
    }

    const line = newLines[index] ?? ''
    if (!line.includes(PAIR_TRANSITION_SUFFIX)) {
      newLines[index] = `${line.trimEnd()}${PAIR_TRANSITION_SUFFIX}`
    }
    remaining -= 1
  }

  newLines[latestChangeIndex] = setTransitionRemaining(newLines[latestChangeIndex] ?? '', remaining)

  return joinLines(newLines, trailingNewline)
}

export function parseEventDateInput(input: string, referenceDate = new Date()): Date {
  const value = input.trim()
  if (!value) {
    throw new Error('event_date is required')
  }

  const shortMatch = value.match(/^(\d{1,2})\.(\d{1,2})$/)
  if (shortMatch) {
    const month = Number.parseInt(shortMatch[1], 10)
    const day = Number.parseInt(shortMatch[2], 10)
    if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error('Invalid mm.dd date')
    }

    const year = Number.isFinite(referenceDate.getTime()) ? referenceDate.getUTCFullYear() : new Date().getUTCFullYear()
    const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

    if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
      throw new Error('Invalid mm.dd date')
    }

    return parsed
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid event_date format')
  }

  return parsed
}

export function buildTaggedNote(
  note: string | null | undefined,
  tags: Record<string, string | number | null | undefined>
): string | null {
  const lines: string[] = []
  const base = note?.trim()
  if (base) {
    lines.push(base)
  }

  for (const [key, value] of Object.entries(tags)) {
    if (value === null || typeof value === 'undefined') {
      continue
    }

    const normalizedValue = String(value).trim()
    if (!normalizedValue) {
      continue
    }

    lines.push(`#${key}=${normalizedValue}`)
  }

  if (lines.length === 0) {
    return null
  }

  return lines.join('\n')
}

export function extractTaggedValue(note: string | null | undefined, key: string): string | null {
  if (!note) {
    return null
  }

  const normalizedKey = key.trim().toLowerCase()
  if (!normalizedKey) {
    return null
  }

  for (const rawLine of note.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('#') || !line.includes('=')) {
      continue
    }

    const [rawTag, ...rest] = line.slice(1).split('=')
    const tag = rawTag.trim().toLowerCase()
    if (tag !== normalizedKey) {
      continue
    }

    const value = rest.join('=').trim()
    return value.length > 0 ? value : null
  }

  return null
}
