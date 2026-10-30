import Button from '@cloudscape-design/components/button'
import Form from '@cloudscape-design/components/form'
import FormField from '@cloudscape-design/components/form-field'
import Input from '@cloudscape-design/components/input'
import Modal from '@cloudscape-design/components/modal'
import SpaceBetween from '@cloudscape-design/components/space-between'
import { useState } from 'react'
import type { Person } from '../api.ts'
import { type DataColumn, DataTable } from '../components/DataTable.tsx'
import { useNotify } from '../notify.ts'
import { useCreatePerson, usePeople } from '../queries.ts'

const columns: DataColumn<Person>[] = [
  { key: 'id', header: 'ID', type: 'number' },
  { key: 'name', header: 'Name', type: 'text' },
  {
    key: 'weeklyCapacity',
    header: 'Weekly capacity',
    type: 'number',
    cell: (p) => `${p.weeklyCapacity} h`,
    exportHeader: 'Weekly capacity (h)',
  },
]

export function PeoplePage() {
  const { data = [], isLoading, error } = usePeople()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DataTable
        id="people"
        title="People"
        headerVariant="h1"
        columns={columns}
        items={data}
        loading={isLoading}
        loadingText="Loading people"
        error={error}
        emptyText="No people yet"
        trackBy="id"
        actions={<Button variant="primary" onClick={() => setCreating(true)}>Add person</Button>}
      />
      {creating && <CreatePersonModal onClose={() => setCreating(false)} />}
    </>
  )
}

function CreatePersonModal({ onClose }: { onClose: () => void }) {
  const notify = useNotify()
  const create = useCreatePerson()
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('40')

  const capacityNum = Number(capacity)
  const capacityError = capacity === '' || capacityNum < 0 || capacityNum > 168 ? 'Between 0 and 168 hours' : undefined

  const submit = () =>
    create.mutate(
      { name: name.trim(), weeklyCapacity: capacityNum },
      {
        onSuccess: (p) => {
          notify('success', `Added ${p.name}`)
          onClose()
        },
      },
    )

  return (
    <Modal visible onDismiss={onClose} header="Add person">
      <form onSubmit={(e) => (e.preventDefault(), submit())}>
        <Form
          errorText={create.error?.message}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link" onClick={onClose}>Cancel</Button>
              <Button variant="primary" loading={create.isPending} disabled={!name.trim() || !!capacityError}>
                Add
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <FormField label="Name">
              <Input value={name} onChange={({ detail }) => setName(detail.value)} autoFocus />
            </FormField>
            <FormField label="Weekly capacity (hours)" errorText={capacityError}>
              <Input type="number" value={capacity} onChange={({ detail }) => setCapacity(detail.value)} />
            </FormField>
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  )
}
