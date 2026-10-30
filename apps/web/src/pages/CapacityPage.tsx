import { useCollection } from '@cloudscape-design/collection-hooks'
import Box from '@cloudscape-design/components/box'
import ColumnLayout from '@cloudscape-design/components/column-layout'
import Container from '@cloudscape-design/components/container'
import DatePicker from '@cloudscape-design/components/date-picker'
import FormField from '@cloudscape-design/components/form-field'
import Header from '@cloudscape-design/components/header'
import Pagination from '@cloudscape-design/components/pagination'
import SpaceBetween from '@cloudscape-design/components/space-between'
import StatusIndicator, { type StatusIndicatorProps } from '@cloudscape-design/components/status-indicator'
import Table from '@cloudscape-design/components/table'
import TextFilter from '@cloudscape-design/components/text-filter'
import { useState } from 'react'
import type { Status, WeekLoad } from '../api.ts'
import { addDays, toISODate, weekStart } from '../dates.ts'
import { useCapacity } from '../queries.ts'

const statusView: Record<Status, { type: StatusIndicatorProps.Type; label: string }> = {
  under: { type: 'info', label: 'Under 80%' },
  ok: { type: 'success', label: 'OK' },
  over: { type: 'error', label: 'Over 100%' },
}

const hours = (h: number) => `${h} h`

export function CapacityPage() {
  // Default range: the current week and the next three.
  const [from, setFrom] = useState(() => toISODate(weekStart(new Date())))
  const [to, setTo] = useState(() => toISODate(addDays(weekStart(new Date()), 27)))

  const { data, isLoading, error } = useCapacity(from, to)
  const rows = data?.rows ?? []

  const { items, collectionProps, filterProps, paginationProps, filteredItemsCount } = useCollection(rows, {
    filtering: {
      filteringFunction: (row, text) => row.personName.toLowerCase().includes(text.toLowerCase()),
      empty: <Box textAlign="center">No people yet. Add them from the People page.</Box>,
      noMatch: <Box textAlign="center">No person matches the filter.</Box>,
    },
    sorting: { defaultState: { sortingColumn: { sortingField: 'weekStart' } } },
    pagination: { pageSize: 25 },
  })

  const count = (s: Status) => rows.filter((r) => r.status === s).length

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description="Planned hours against capacity, and tracked time, per person and ISO week."
      >
        Capacity
      </Header>

      <Container>
        <ColumnLayout columns={4} variant="text-grid">
          <FormField label="From">
            <DatePicker value={from} onChange={({ detail }) => setFrom(detail.value)} placeholder="YYYY/MM/DD" />
          </FormField>
          <FormField label="To" description="The range is widened to whole weeks, at most 26.">
            <DatePicker value={to} onChange={({ detail }) => setTo(detail.value)} placeholder="YYYY/MM/DD" />
          </FormField>
          <div>
            <Box variant="awsui-key-label">Overbooked person-weeks</Box>
            <Box variant="awsui-value-large">{count('over')}</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Person-weeks with room</Box>
            <Box variant="awsui-value-large">{count('under')}</Box>
          </div>
        </ColumnLayout>
      </Container>

      <Table<WeekLoad>
        {...collectionProps}
        variant="full-page"
        items={items}
        loading={isLoading}
        loadingText="Loading report"
        trackBy={(r) => `${r.personId}-${r.weekStart}`}
        header={
          <Header counter={data ? `(${rows.length})` : undefined}>
            {data ? `Weeks ${data.from} – ${data.to}` : 'Report'}
          </Header>
        }
        empty={
          error ? (
            <StatusIndicator type="error">{error.message}</StatusIndicator>
          ) : (
            <Box textAlign="center">No data</Box>
          )
        }
        filter={
          <TextFilter
            {...filterProps}
            filteringPlaceholder="Filter by person"
            countText={`${filteredItemsCount} matches`}
          />
        }
        pagination={<Pagination {...paginationProps} />}
        columnDefinitions={[
          { id: 'week', header: 'Week of', cell: (r) => r.weekStart, sortingField: 'weekStart' },
          { id: 'person', header: 'Person', cell: (r) => r.personName, sortingField: 'personName' },
          { id: 'capacity', header: 'Capacity', cell: (r) => hours(r.capacity), sortingField: 'capacity' },
          { id: 'planned', header: 'Planned', cell: (r) => hours(r.planned), sortingField: 'planned' },
          { id: 'tracked', header: 'Tracked', cell: (r) => hours(r.tracked), sortingField: 'tracked' },
          {
            id: 'utilisation',
            header: 'Utilisation',
            cell: (r) => `${Math.round(r.utilisation * 100)}%`,
            sortingField: 'utilisation',
          },
          {
            id: 'status',
            header: 'Status',
            cell: (r) => <StatusIndicator type={statusView[r.status].type}>{statusView[r.status].label}</StatusIndicator>,
            sortingField: 'status',
          },
        ]}
      />
    </SpaceBetween>
  )
}
