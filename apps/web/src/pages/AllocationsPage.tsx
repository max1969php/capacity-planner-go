import Button from '@cloudscape-design/components/button'
import Container from '@cloudscape-design/components/container'
import DatePicker from '@cloudscape-design/components/date-picker'
import Form from '@cloudscape-design/components/form'
import FormField from '@cloudscape-design/components/form-field'
import Header from '@cloudscape-design/components/header'
import Input from '@cloudscape-design/components/input'
import type { SelectProps } from '@cloudscape-design/components/select'
import SpaceBetween from '@cloudscape-design/components/space-between'
import { useState } from 'react'
import { PersonProjectFields } from '../components/PersonProjectFields.tsx'
import { useNotify } from '../notify.ts'
import { useCreateAllocation } from '../queries.ts'

export function AllocationsPage() {
  const notify = useNotify()
  const create = useCreateAllocation()
  const [person, setPerson] = useState<SelectProps.Option | null>(null)
  const [project, setProject] = useState<SelectProps.Option | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [hoursPerWeek, setHoursPerWeek] = useState('20')

  const hours = Number(hoursPerWeek)
  const hoursError = hoursPerWeek !== '' && (hours <= 0 || hours > 168) ? 'More than 0, at most 168' : undefined
  const endError = start && end && end < start ? 'End must be on or after start' : undefined
  const valid = person && project && start && end && hoursPerWeek && !hoursError && !endError

  const submit = () => {
    if (!valid) return
    create.mutate(
      { personId: Number(person.value), projectId: Number(project.value), start, end, hoursPerWeek: hours },
      {
        onSuccess: () => {
          notify('success', `Planned ${hours} h/week of ${project.label} for ${person.label}, ${start} to ${end}`)
          create.reset()
        },
      },
    )
  }

  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Form
        header={
          <Header variant="h1" description="Weeks that start or end mid-week are pro-rated on working days.">
            Plan work
          </Header>
        }
        errorText={create.error?.message}
        actions={
          <Button variant="primary" loading={create.isPending} disabled={!valid}>
            Create allocation
          </Button>
        }
      >
        <Container>
          <SpaceBetween size="m">
            <PersonProjectFields person={person} project={project} onPerson={setPerson} onProject={setProject} />
            <FormField label="Start" description="Inclusive">
              <DatePicker value={start} onChange={({ detail }) => setStart(detail.value)} placeholder="YYYY/MM/DD" />
            </FormField>
            <FormField label="End" description="Inclusive" errorText={endError}>
              <DatePicker value={end} onChange={({ detail }) => setEnd(detail.value)} placeholder="YYYY/MM/DD" />
            </FormField>
            <FormField label="Hours per week" errorText={hoursError}>
              <Input type="number" value={hoursPerWeek} onChange={({ detail }) => setHoursPerWeek(detail.value)} />
            </FormField>
          </SpaceBetween>
        </Container>
      </Form>
    </form>
  )
}
