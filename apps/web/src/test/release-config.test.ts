import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('release configuration', () => {
  it('.env.local.example exists at the expected path', () => {
    const filePath = path.join(process.cwd(), '.env.local.example')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('.env.local.example contains NEXT_PUBLIC_API_URL', () => {
    const filePath = path.join(process.cwd(), '.env.local.example')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('NEXT_PUBLIC_API_URL')
  })

  it('next.config.mjs exists', () => {
    const filePath = path.join(process.cwd(), 'next.config.mjs')
    expect(fs.existsSync(filePath)).toBe(true)
  })
})
