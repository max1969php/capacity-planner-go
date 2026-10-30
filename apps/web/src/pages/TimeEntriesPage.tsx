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
import { toISODate } from '../dates.ts'
import { useNotify } from '../notify.ts'
import { useCreateTimeEntry } from '../queries.ts'

export function TimeEntriesPage() {
  const notify = useNotify()
  const create = useCreateTimeEntry()
  const [person, setPerson] = useState<SelectProps.Option | null>(null)
  const [project, setProject] = useState<SelectProps.Option | null>(null)
  const [date, setDate] = useState(() => toISODate(new Date()))
  const [hours, setHours] = useState('1')

  // The API stores minutes; the form takes hours because people think in hours.
  const minutes = Math.round(Number(hours) * 60)
  const hoursError = hours !== '' && (minutes <= 0 || minutes > 24 * 60) ? 'More than 0, at most 24' : undefined
  const valid = person && project && date && hours && !hoursError

  const submit = () => {
    if (!valid) return
    create.mutate(
      { personId: Number(person.value), projectId: Number(project.value), date, minutes },
      {
        onSuccess: () => {
          notify('success', `Tracked ${hours} h on ${project.label} for ${person.label} on ${date}`)
          create.reset()
        },
      },
    )
  }

  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <Form
        header={<Header variant="h1">Track time</Header>}
        errorText={create.error?.message}
        actions={
          <Button variant="primary" loading={create.isPending} disabled={!valid}>
            Add time entry
          </Button>
        }
      >
        <Container>
          <SpaceBetween size="m">
            <PersonProjectFields person={person} project={project} onPerson={setPerson} onProject={setProject} />
            <FormField label="Date">
              <DatePicker value={date} onChange={({ detail }) => setDate(detail.value)} placeholder="YYYY/MM/DD" />
            </FormField>
            <FormField label="Hours" errorText={hoursError} constraintText="Decimals allowed, e.g. 1.5">
              <Input type="number" inputMode="decimal" value={hours} onChange={({ detail }) => setHours(detail.value)} />
            </FormField>
          </SpaceBetween>
        </Container>
      </Form>
    </form>
  )
}
