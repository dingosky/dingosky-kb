import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('example', () => {
  it('renders a heading', () => {
    render(<h1>Hello</h1>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
