import Box from '@cloudscape-design/components/box'
import Button from '@cloudscape-design/components/button'
import Form from '@cloudscape-design/components/form'
import FormField from '@cloudscape-design/components/form-field'
import Header from '@cloudscape-design/components/header'
import Input from '@cloudscape-design/components/input'
import Modal from '@cloudscape-design/components/modal'
import SpaceBetween from '@cloudscape-design/components/space-between'
import StatusIndicator from '@cloudscape-design/components/status-indicator'
import Table from '@cloudscape-design/components/table'
import { useState } from 'react'
import type { Person } from '../api.ts'
import { useNotify } from '../notify.ts'
import { useCreatePerson, usePeople } from '../queries.ts'

export function PeoplePage() {
  const { data = [], isLoading, error } = usePeople()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <Table<Person>
        variant="full-page"
        items={data}
        loading={isLoading}
        loadingText="Loading people"
        trackBy="id"
        header={
          <Header
            variant="h1"
            counter={`(${data.length})`}
            actions={<Button variant="primary" onClick={() => setCreating(true)}>Add person</Button>}
          >
            People
          </Header>
        }
        empty={
          error ? <StatusIndicator type="error">{error.message}</StatusIndicator> : <Box textAlign="center">No people yet</Box>
        }
        columnDefinitions={[
          { id: 'id', header: 'ID', cell: (p) => p.id },
          { id: 'name', header: 'Name', cell: (p) => p.name },
          { id: 'capacity', header: 'Weekly capacity', cell: (p) => `${p.weeklyCapacity} h` },
        ]}
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
