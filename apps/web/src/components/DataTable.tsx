import { useCollection } from '@cloudscape-design/collection-hooks'
import Box from '@cloudscape-design/components/box'
import ButtonDropdown from '@cloudscape-design/components/button-dropdown'
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences'
import Header, { type HeaderProps } from '@cloudscape-design/components/header'
import Pagination from '@cloudscape-design/components/pagination'
import PropertyFilter from '@cloudscape-design/components/property-filter'
import SpaceBetween from '@cloudscape-design/components/space-between'
import StatusIndicator from '@cloudscape-design/components/status-indicator'
import Table, { type TableProps } from '@cloudscape-design/components/table'
import { type ReactNode, useState } from 'react'
import { toISODate } from '../dates.ts'
import { downloadCsv, downloadXlsx, type ExportSheet, type ExportValue } from '../export.ts'
import { useNotify } from '../notify.ts'

export interface DataColumn<T> {
  key: Extract<keyof T, string>
  header: string
  // text: exact match or contains. number and date: comparisons too. enum: exact match.
  type: 'text' | 'number' | 'date' | 'enum'
  cell?: (row: T) => ReactNode
  // Readable label for an enum value, in filter suggestions and tokens.
  format?: (value: string) => string
  exportHeader?: string
  exportValue?: (row: T) => ExportValue
}

interface DataTableProps<T> {
  // Names the saved preferences and the downloaded files.
  id: string
  title: string
  headerVariant?: HeaderProps['variant']
  columns: DataColumn<T>[]
  items: readonly T[]
  trackBy: TableProps<T>['trackBy']
  loading: boolean
  loadingText: string
  error: Error | null
  emptyText: string
  defaultSort?: Extract<keyof T, string>
  actions?: ReactNode
}

const operators = {
  text: ['=', '!=', ':', '!:'],
  number: ['=', '!=', '>', '>=', '<', '<='],
  date: ['=', '!=', '>', '>=', '<', '<='],
  enum: ['=', '!='],
} as const

const pageSizes = [10, 25, 50, 100]

function loadPreferences(
  id: string,
  defaults: CollectionPreferencesProps.Preferences,
): CollectionPreferencesProps.Preferences {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(`table-preferences:${id}`) ?? '{}') }
  } catch {
    return defaults
  }
}

export function DataTable<T extends object>({
  id,
  title,
  headerVariant,
  columns,
  items: allItems,
  trackBy,
  loading,
  loadingText,
  error,
  emptyText,
  defaultSort,
  actions,
}: DataTableProps<T>) {
  const notify = useNotify()
  const [exporting, setExporting] = useState(false)
  const [preferences, setPreferences] = useState(() =>
    loadPreferences(id, {
      pageSize: 25,
      wrapLines: false,
      stripedRows: false,
      contentDensity: 'comfortable',
      stickyColumns: { first: 0, last: 0 },
      contentDisplay: columns.map((c) => ({ id: c.key, visible: true })),
    }),
  )

  const { items, collectionProps, propertyFilterProps, paginationProps, filteredItemsCount } =
    useCollection(allItems, {
      propertyFiltering: {
        filteringProperties: columns.map((c) => ({
          key: c.key,
          propertyLabel: c.header,
          groupValuesLabel: `${c.header} values`,
          operators: operators[c.type].map((operator) => ({ operator, format: c.format })),
        })),
        empty: <Box textAlign="center">{emptyText}</Box>,
        noMatch: <Box textAlign="center">No records match the filter.</Box>,
      },
      sorting: defaultSort ? { defaultState: { sortingColumn: { sortingField: defaultSort } } } : {},
      pagination: { pageSize: preferences.pageSize },
    })

  const savePreferences = (next: CollectionPreferencesProps.Preferences) => {
    setPreferences(next)
    localStorage.setItem(`table-preferences:${id}`, JSON.stringify(next))
  }

  // Always every downloaded record and column: filters, pages and hidden
  // columns only change what's on screen.
  const download = async (format: string) => {
    const sheet: ExportSheet = {
      headers: columns.map((c) => c.exportHeader ?? c.header),
      rows: allItems.map((row) => columns.map((c) => c.exportValue?.(row) ?? (row[c.key] as ExportValue))),
    }
    const fileName = `${id}-${toISODate(new Date())}.${format}`
    setExporting(true)
    try {
      if (format === 'csv') downloadCsv(sheet, fileName)
      else await downloadXlsx(sheet, fileName)
    } catch (e) {
      notify('error', `Download failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
    }
  }

  const isFiltered = filteredItemsCount !== undefined && filteredItemsCount !== allItems.length

  return (
    <Table<T>
      {...collectionProps}
      variant="full-page"
      stickyHeader
      items={items}
      loading={loading}
      loadingText={loadingText}
      trackBy={trackBy}
      wrapLines={preferences.wrapLines}
      stripedRows={preferences.stripedRows}
      contentDensity={preferences.contentDensity}
      stickyColumns={preferences.stickyColumns}
      columnDisplay={preferences.contentDisplay}
      empty={error ? <StatusIndicator type="error">{error.message}</StatusIndicator> : collectionProps.empty}
      header={
        <Header
          variant={headerVariant}
          counter={isFiltered ? `(${filteredItemsCount}/${allItems.length})` : `(${allItems.length})`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown
                disabled={allItems.length === 0}
                loading={exporting}
                onItemClick={({ detail }) => download(detail.id)}
                items={[
                  { id: 'csv', text: `CSV, all ${allItems.length} records` },
                  { id: 'xlsx', text: `Excel (XLSX), all ${allItems.length} records` },
                ]}
              >
                Download
              </ButtonDropdown>
              {actions}
            </SpaceBetween>
          }
        >
          {title}
        </Header>
      }
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          filteringOptions={propertyFilterProps.filteringOptions.map((option) => ({
            ...option,
            label: columns.find((c) => c.key === option.propertyKey)?.format?.(option.value),
          }))}
          filteringPlaceholder="Filter records"
          countText={`${filteredItemsCount} matches`}
          expandToViewport
        />
      }
      pagination={<Pagination {...paginationProps} />}
      preferences={
        <CollectionPreferences
          title="Preferences"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          preferences={preferences}
          onConfirm={({ detail }) => savePreferences(detail)}
          pageSizePreference={{
            title: 'Page size',
            options: pageSizes.map((value) => ({ value, label: `${value} records` })),
          }}
          wrapLinesPreference={{ label: 'Wrap lines', description: 'Show long values on several lines' }}
          stripedRowsPreference={{ label: 'Striped rows', description: 'Alternate the row background' }}
          contentDensityPreference={{ label: 'Compact mode', description: 'Show more rows on screen' }}
          stickyColumnsPreference={{
            firstColumns: {
              title: 'Stick first columns',
              description: 'Keep the first columns visible while scrolling sideways',
              options: [
                { label: 'None', value: 0 },
                { label: 'First column', value: 1 },
              ],
            },
          }}
          contentDisplayPreference={{
            title: 'Column preferences',
            description: 'Choose which columns to show and in what order',
            options: columns.map((c) => ({ id: c.key, label: c.header })),
          }}
        />
      }
      columnDefinitions={columns.map((c) => ({
        id: c.key,
        header: c.header,
        cell: c.cell ?? ((row) => String(row[c.key])),
        sortingField: c.key,
      }))}
    />
  )
}
