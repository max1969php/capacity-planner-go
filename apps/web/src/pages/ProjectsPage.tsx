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
import { ApiError, type Project } from '../api.ts'
import { useNotify } from '../notify.ts'
import { useCreateProject, useProjects } from '../queries.ts'

export function ProjectsPage() {
  const { data = [], isLoading, error } = useProjects()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <Table<Project>
        variant="full-page"
        items={data}
        loading={isLoading}
        loadingText="Loading projects"
        trackBy="id"
        header={
          <Header
            variant="h1"
            counter={`(${data.length})`}
            actions={<Button variant="primary" onClick={() => setCreating(true)}>Add project</Button>}
          >
            Projects
          </Header>
        }
        empty={
          error ? <StatusIndicator type="error">{error.message}</StatusIndicator> : <Box textAlign="center">No projects yet</Box>
        }
        columnDefinitions={[
          { id: 'id', header: 'ID', cell: (p) => p.id },
          { id: 'name', header: 'Name', cell: (p) => p.name },
        ]}
      />
      {creating && <CreateProjectModal onClose={() => setCreating(false)} />}
    </>
  )
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const notify = useNotify()
  const create = useCreateProject()
  const [name, setName] = useState('')

  // 409 comes from the UNIQUE constraint on projects.name.
  const errorText =
    create.error instanceof ApiError && create.error.status === 409
      ? 'A project with this name already exists.'
      : create.error?.message

  const submit = () =>
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: (p) => {
          notify('success', `Added ${p.name}`)
          onClose()
        },
      },
    )

  return (
    <Modal visible onDismiss={onClose} header="Add project">
      <form onSubmit={(e) => (e.preventDefault(), submit())}>
        <Form
          errorText={errorText}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link" onClick={onClose}>Cancel</Button>
              <Button variant="primary" loading={create.isPending} disabled={!name.trim()}>
                Add
              </Button>
            </SpaceBetween>
          }
        >
          <FormField label="Name">
            <Input value={name} onChange={({ detail }) => setName(detail.value)} autoFocus />
          </FormField>
        </Form>
      </form>
    </Modal>
  )
}
