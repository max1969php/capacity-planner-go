import Box from '@cloudscape-design/components/box'
import ColumnLayout from '@cloudscape-design/components/column-layout'
import Container from '@cloudscape-design/components/container'
import DatePicker from '@cloudscape-design/components/date-picker'
import FormField from '@cloudscape-design/components/form-field'
import Header from '@cloudscape-design/components/header'
import SpaceBetween from '@cloudscape-design/components/space-between'
import StatusIndicator, { type StatusIndicatorProps } from '@cloudscape-design/components/status-indicator'
import { useState } from 'react'
import type { Status, WeekLoad } from '../api.ts'
import { type DataColumn, DataTable } from '../components/DataTable.tsx'
import { addDays, toISODate, weekStart } from '../dates.ts'
import { useCapacity } from '../queries.ts'

const statusView: Record<Status, { type: StatusIndicatorProps.Type; label: string }> = {
  under: { type: 'info', label: 'Under 80%' },
  ok: { type: 'success', label: 'OK' },
  over: { type: 'error', label: 'Over 100%' },
}

const hours = (h: number) => `${h} h`

const columns: DataColumn<WeekLoad>[] = [
  { key: 'weekStart', header: 'Week of', type: 'date' },
  { key: 'personName', header: 'Person', type: 'text' },
  { key: 'capacity', header: 'Capacity', type: 'number', cell: (r) => hours(r.capacity), exportHeader: 'Capacity (h)' },
  { key: 'planned', header: 'Planned', type: 'number', cell: (r) => hours(r.planned), exportHeader: 'Planned (h)' },
  { key: 'tracked', header: 'Tracked', type: 'number', cell: (r) => hours(r.tracked), exportHeader: 'Tracked (h)' },
  {
    key: 'utilisation',
    header: 'Utilisation',
    type: 'number',
    cell: (r) => `${Math.round(r.utilisation * 100)}%`,
    exportHeader: 'Utilisation (%)',
    exportValue: (r) => Math.round(r.utilisation * 100),
  },
  {
    key: 'status',
    header: 'Status',
    type: 'enum',
    cell: (r) => <StatusIndicator type={statusView[r.status].type}>{statusView[r.status].label}</StatusIndicator>,
    format: (s) => statusView[s as Status]?.label ?? s,
    exportValue: (r) => statusView[r.status].label,
  },
]

export function CapacityPage() {
  // Default range: the current week and the next three.
  const [from, setFrom] = useState(() => toISODate(weekStart(new Date())))
  const [to, setTo] = useState(() => toISODate(addDays(weekStart(new Date()), 27)))

  const { data, isLoading, error } = useCapacity(from, to)
  const rows = data?.rows ?? []

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

      <DataTable
        id="capacity"
        title={data ? `Weeks ${data.from} – ${data.to}` : 'Report'}
        columns={columns}
        items={rows}
        loading={isLoading}
        loadingText="Loading report"
        error={error}
        emptyText="No people yet. Add them from the People page."
        trackBy={(r) => `${r.personId}-${r.weekStart}`}
        defaultSort="weekStart"
      />
    </SpaceBetween>
  )
}
