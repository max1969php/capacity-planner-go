import FormField from '@cloudscape-design/components/form-field'
import Select, { type SelectProps } from '@cloudscape-design/components/select'
import { usePeople, useProjects } from '../queries.ts'

interface Props {
  person: SelectProps.Option | null
  project: SelectProps.Option | null
  onPerson: (o: SelectProps.Option) => void
  onProject: (o: SelectProps.Option) => void
}

// PersonProjectFields renders the two selects shared by the allocation and
// time entry forms. Option values are the numeric IDs as strings.
export function PersonProjectFields({ person, project, onPerson, onProject }: Props) {
  const people = usePeople()
  const projects = useProjects()

  return (
    <>
      <FormField label="Person">
        <Select
          selectedOption={person}
          onChange={({ detail }) => onPerson(detail.selectedOption)}
          options={(people.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
          statusType={people.isLoading ? 'loading' : people.error ? 'error' : 'finished'}
          placeholder="Choose a person"
          empty="No people yet"
          filteringType="auto"
        />
      </FormField>
      <FormField label="Project">
        <Select
          selectedOption={project}
          onChange={({ detail }) => onProject(detail.selectedOption)}
          options={(projects.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
          statusType={projects.isLoading ? 'loading' : projects.error ? 'error' : 'finished'}
          placeholder="Choose a project"
          empty="No projects yet"
          filteringType="auto"
        />
      </FormField>
    </>
  )
}
