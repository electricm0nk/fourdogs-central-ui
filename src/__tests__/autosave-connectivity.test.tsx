import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrder } from '@/hooks/use_order'
import { useOrderItems } from '@/hooks/use_order_items'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import type { Order } from '@/types/order'
import type { OrderItem } from '@/types/order_item'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))
vi.mock('@/hooks/use_patch_order_item', () => ({ usePatchOrderItem: vi.fn() }))

const mockOrder: Order = {
  id: '00000000-0000-0000-0000-000000000001',
  vendor_adapter_id: '00000000-0000-0000-0000-000000000002',
  vendor_name: 'Southeast Pet',
  created_by: 'test-sub',
  order_date: '2026-04-12',
  submitted: false,
  archived: false,
  created_at: '2026-04-12T00:00:00Z',
}

const mustHaveItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000010',
  order_id: mockOrder.id,
  item_id: 'SKU-001',
  item_name: 'Bark Biscuits',
  category: null,
  current_stock_qty: 0,
  velocity_tier: null,
  must_have: true,
  final_qty: 3,
  ghost_qty: null,
  confidence_tier: null,
}

const lowQtyMustHave: OrderItem = {
  ...mustHaveItem,
  id: '00000000-0000-0000-0000-000000000011',
  final_qty: 1,
  item_name: 'Cat Treats',
  item_id: 'SKU-002',
}

function wrapper(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/orders/${id}?tab=floorwalk`]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Autosave & Connectivity', () => {
  const mockPatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrder).mockReturnValue({
      data: mockOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useSubmitOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSubmitOrder>)
    vi.mocked(useArchiveOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useArchiveOrder>)
    vi.mocked(usePatchOrderItem).mockReturnValue({
      mutate: mockPatch,
      isPending: false,
    } as unknown as ReturnType<typeof usePatchOrderItem>)
  })

  describe('Debounce', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('collapses rapid increments into a single PATCH', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      vi.mocked(useOrderItems).mockReturnValue({
        data: [mustHaveItem],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      const plusButtons = screen.getAllByRole('button', { name: /\+/ })

      fireEvent.click(plusButtons[0])
      fireEvent.click(plusButtons[0])
      fireEvent.click(plusButtons[0])

      // No patch fired yet — debounce window not elapsed
      expect(mockPatch).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(350)
      })

      // Exactly one patch, with the final accumulated value (3 + 3 = 6)
      expect(mockPatch).toHaveBeenCalledTimes(1)
      expect(mockPatch).toHaveBeenCalledWith(
        expect.objectContaining({ final_qty: 6 })
      )
    })

    it('resets debounce timer on each change within the window', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      vi.mocked(useOrderItems).mockReturnValue({
        data: [mustHaveItem],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      const plusButtons = screen.getAllByRole('button', { name: /\+/ })

      fireEvent.click(plusButtons[0])
      act(() => { vi.advanceTimersByTime(200) })
      // Still within debounce window after another click
      fireEvent.click(plusButtons[0])
      act(() => { vi.advanceTimersByTime(200) })

      // Only 200ms since last click — still not fired
      expect(mockPatch).not.toHaveBeenCalled()

      act(() => { vi.advanceTimersByTime(150) })
      // Now 350ms since last click — should fire
      expect(mockPatch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Connectivity indicator', () => {
    afterEach(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      })
    })

    it('shows no alert when online', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      })
      vi.mocked(useOrderItems).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows offline banner immediately when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      })
      vi.mocked(useOrderItems).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/you're offline/i)).toBeInTheDocument()
    })

    it('shows offline banner after offline event fires', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      })
      vi.mocked(useOrderItems).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          value: false,
          writable: true,
          configurable: true,
        })
        window.dispatchEvent(new Event('offline'))
      })

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('hides offline banner after online event fires', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      })
      vi.mocked(useOrderItems).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      expect(screen.getByRole('alert')).toBeInTheDocument()

      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          value: true,
          writable: true,
          configurable: true,
        })
        window.dispatchEvent(new Event('online'))
      })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows syncing indicator when isPending is true', () => {
      vi.mocked(usePatchOrderItem).mockReturnValue({
        mutate: mockPatch,
        isPending: true,
      } as unknown as ReturnType<typeof usePatchOrderItem>)
      vi.mocked(useOrderItems).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      expect(screen.getByText(/saving/i)).toBeInTheDocument()
    })
  })

  describe('Must-have zero protection', () => {
    it('shows confirmation dialog when decrementing must-have item to 0', () => {
      vi.mocked(useOrderItems).mockReturnValue({
        data: [lowQtyMustHave],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      const minusButtons = screen.getAllByRole('button', { name: /-/ })
      fireEvent.click(minusButtons[0])

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/this is a must-have item/i)).toBeInTheDocument()
    })

    it('fires PATCH with 0 when operator confirms', () => {
      vi.mocked(useOrderItems).mockReturnValue({
        data: [lowQtyMustHave],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      const minusButtons = screen.getAllByRole('button', { name: /-/ })
      fireEvent.click(minusButtons[0])

      fireEvent.click(screen.getByRole('button', { name: /yes, set to 0/i }))

      expect(mockPatch).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: lowQtyMustHave.id, final_qty: 0 })
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('reverts qty and fires no PATCH when operator cancels', () => {
      vi.mocked(useOrderItems).mockReturnValue({
        data: [lowQtyMustHave],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      const minusButtons = screen.getAllByRole('button', { name: /-/ })
      fireEvent.click(minusButtons[0])

      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

      expect(mockPatch).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      // Qty should revert to original value
      expect(screen.getByDisplayValue('1')).toBeInTheDocument()
    })

    it('does not show dialog for regular (non-must-have) items at 0', () => {
      const regularItem: OrderItem = {
        ...lowQtyMustHave,
        must_have: false,
      }
      vi.mocked(useOrderItems).mockReturnValue({
        data: [regularItem],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrderItems>)

      render(wrapper(mockOrder.id))
      const minusButtons = screen.getAllByRole('button', { name: /-/ })
      fireEvent.click(minusButtons[0])

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(mockPatch).not.toHaveBeenCalled() // debounce not yet elapsed
    })
  })
})
