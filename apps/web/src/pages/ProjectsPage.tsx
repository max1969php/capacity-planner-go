import Button from '@cloudscape-design/components/button'
import Form from '@cloudscape-design/components/form'
import FormField from '@cloudscape-design/components/form-field'
import Input from '@cloudscape-design/components/input'
import Modal from '@cloudscape-design/components/modal'
import SpaceBetween from '@cloudscape-design/components/space-between'
import { useState } from 'react'
import { ApiError, type Project } from '../api.ts'
import { type DataColumn, DataTable } from '../components/DataTable.tsx'
import { useNotify } from '../notify.ts'
import { useCreateProject, useProjects } from '../queries.ts'

const columns: DataColumn<Project>[] = [
  { key: 'id', header: 'ID', type: 'number' },
  { key: 'name', header: 'Name', type: 'text' },
]

export function ProjectsPage() {
  const { data = [], isLoading, error } = useProjects()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DataTable
        id="projects"
        title="Projects"
        headerVariant="h1"
        columns={columns}
        items={data}
        loading={isLoading}
        loadingText="Loading projects"
        error={error}
        emptyText="No projects yet"
        trackBy="id"
        actions={<Button variant="primary" onClick={() => setCreating(true)}>Add project</Button>}
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
