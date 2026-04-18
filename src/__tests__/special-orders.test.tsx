import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SpecialOrders } from '@/pages/SpecialOrders'
import {
  useImportSpecialOrders,
  useSpecialOrdersStaging,
  useConfirmSpecialOrder,
  useDiscardSpecialOrder,
} from '@/hooks/use_special_orders'
import type { ImportState } from '@/hooks/use_special_orders'
import type { SpecialOrdersStaging } from '@/types/special_order'

vi.mock('@/hooks/use_special_orders', () => ({
  useImportSpecialOrders: vi.fn(),
  useSpecialOrdersStaging: vi.fn(),
  useConfirmSpecialOrder: vi.fn(),
  useDiscardSpecialOrder: vi.fn(),
}))

const pendingRow: SpecialOrdersStaging = {
  id: 'staging-1',
  item_id: 'SKU-001',
  item_name: 'Fancy Cat Food',
  requested_qty: 2,
  vendor_notes: 'grain-free',
  status: 'pending',
  imported_by: 'user-sub',
  imported_at: '2026-04-13T00:00:00Z',
}

const confirmedRow: SpecialOrdersStaging = {
  ...pendingRow,
  id: 'staging-2',
  item_id: 'SKU-002',
  status: 'confirmed',
}

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SpecialOrders />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function setupDefaultMocks(
  stagingRows: SpecialOrdersStaging[] = [],
  uploadState: ImportState = { status: 'idle' }
) {
  vi.mocked(useImportSpecialOrders).mockReturnValue({
    upload: vi.fn(),
    state: uploadState,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useImportSpecialOrders>)

  vi.mocked(useSpecialOrdersStaging).mockReturnValue({
    data: stagingRows,
    isLoading: false,
  } as unknown as ReturnType<typeof useSpecialOrdersStaging>)

  vi.mocked(useConfirmSpecialOrder).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useConfirmSpecialOrder>)

  vi.mocked(useDiscardSpecialOrder).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useDiscardSpecialOrder>)
}

describe('SpecialOrders page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders CSV upload control', () => {
    render(wrapper())
    expect(screen.getByLabelText(/upload csv file/i)).toBeInTheDocument()
  })

  it('shows "Uploading…" label while upload is in progress', () => {
    setupDefaultMocks([], { status: 'uploading' })
    render(wrapper())
    expect(screen.getByRole('button', { name: /uploading/i })).toBeDisabled()
  })

  it('renders staging table after successful upload', () => {
    setupDefaultMocks([pendingRow], {
      status: 'success',
      result: { imported: 1, staging_ids: ['staging-1'] },
    })
    render(wrapper())

    expect(screen.getByText('SKU-001')).toBeInTheDocument()
    expect(screen.getByText('Fancy Cat Food')).toBeInTheDocument()
    expect(screen.getByText('grain-free')).toBeInTheDocument()
  })

  it('shows row-level errors on 400 validation failure', () => {
    setupDefaultMocks([], {
      status: 'error',
      rowErrors: [
        { row: 3, message: 'requested_qty must be a positive integer' },
        { row: 7, message: 'item_id is required' },
      ],
    })
    render(wrapper())

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/row 3/i)).toBeInTheDocument()
    expect(screen.getByText(/row 7/i)).toBeInTheDocument()
    // Table not shown when there are errors
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows client-side error for non-CSV file', async () => {
    const uploadFn = vi.fn()
    vi.mocked(useImportSpecialOrders).mockReturnValue({
      upload: uploadFn,
      state: { status: 'idle' },
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useImportSpecialOrders>)

    render(wrapper())

    const input = screen.getByLabelText(/upload csv file/i) as HTMLInputElement
    const xlsxFile = new File(['data'], 'orders.xlsx', { type: 'application/vnd.ms-excel' })

    await act(async () => {
      fireEvent.change(input, { target: { files: [xlsxFile] } })
    })

    // upload should NOT be called for non-CSV files
    expect(uploadFn).not.toHaveBeenCalled()
  })

  it('calls upload with CSV file', async () => {
    const uploadFn = vi.fn()
    vi.mocked(useImportSpecialOrders).mockReturnValue({
      upload: uploadFn,
      state: { status: 'idle' },
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useImportSpecialOrders>)

    render(wrapper())

    const input = screen.getByLabelText(/upload csv file/i)
    const csvFile = new File(['item_id,item_name,requested_qty\nSKU-1,Dog Food,2'], 'orders.csv', {
      type: 'text/csv',
    })

    await act(async () => {
      fireEvent.change(input, { target: { files: [csvFile] } })
    })

    expect(uploadFn).toHaveBeenCalledWith(csvFile)
  })

  describe('Confirm / Discard buttons', () => {
    it('Confirm and Discard are enabled for pending row', () => {
      setupDefaultMocks([pendingRow])
      render(wrapper())

      const confirmBtn = screen.getByRole('button', { name: /confirm/i })
      const discardBtn = screen.getByRole('button', { name: /discard/i })
      expect(confirmBtn).not.toBeDisabled()
      expect(discardBtn).not.toBeDisabled()
    })

    it('Confirm and Discard are disabled for confirmed row', () => {
      setupDefaultMocks([confirmedRow])
      render(wrapper())

      const buttons = screen.getAllByRole('button')
      const confirmBtn = buttons.find((b) => b.textContent === 'Confirm')
      const discardBtn = buttons.find((b) => b.textContent === 'Discard')

      expect(confirmBtn).toBeDisabled()
      expect(discardBtn).toBeDisabled()
    })

    it('calls confirm mutation when Confirm is clicked', async () => {
      const confirmMutate = vi.fn()
      setupDefaultMocks([pendingRow])
      // Override confirm after setupDefaultMocks so we can assert on this specific fn
      vi.mocked(useConfirmSpecialOrder).mockReturnValue({
        mutate: confirmMutate,
        isPending: false,
      } as unknown as ReturnType<typeof useConfirmSpecialOrder>)

      render(wrapper())

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
      })

      expect(confirmMutate).toHaveBeenCalledWith('staging-1')
    })
  })
})
