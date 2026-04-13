import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { LoginPage } from '@/pages/LoginPage'

describe('LoginPage', () => {
  it('renders the Sign in with Google button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: /sign in with google/i })
    expect(link).toBeInTheDocument()
  })

  it('Google sign-in link points to /auth/google', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: /sign in with google/i })
    expect(link).toHaveAttribute('href', '/auth/google')
  })

  it('uses an anchor tag (not a button) for redirect-only OAuth', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: /sign in with google/i })
    expect(link.tagName).toBe('A')
  })
})
