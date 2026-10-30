import AppLayout from '@cloudscape-design/components/app-layout'
import Flashbar from '@cloudscape-design/components/flashbar'
import SideNavigation from '@cloudscape-design/components/side-navigation'
import TopNavigation from '@cloudscape-design/components/top-navigation'
import { useEffect, useState } from 'react'
import { NotifyContext, useFlashItems } from './notify.ts'
import { AllocationsPage } from './pages/AllocationsPage.tsx'
import { CapacityPage } from './pages/CapacityPage.tsx'
import { PeoplePage } from './pages/PeoplePage.tsx'
import { ProjectsPage } from './pages/ProjectsPage.tsx'
import { TimeEntriesPage } from './pages/TimeEntriesPage.tsx'
import { useColorPreference, type ColorPreference } from './theme.ts'

const colorOptions: { id: ColorPreference; text: string }[] = [
  { id: 'system', text: 'Same as system' },
  { id: 'light', text: 'Light' },
  { id: 'dark', text: 'Dark' },
]

const pages = {
  '#/capacity': { title: 'Capacity', component: CapacityPage },
  '#/people': { title: 'People', component: PeoplePage },
  '#/projects': { title: 'Projects', component: ProjectsPage },
  '#/allocations': { title: 'Plan work', component: AllocationsPage },
  '#/time-entries': { title: 'Track time', component: TimeEntriesPage },
} as const

type Route = keyof typeof pages

const isRoute = (hash: string): hash is Route => hash in pages

// useHashRoute is a minimal router: five pages don't need react-router.
function useHashRoute(): Route {
  const read = () => (isRoute(window.location.hash) ? window.location.hash : '#/capacity')
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export default function App() {
  const route = useHashRoute()
  const [flashItems, notify] = useFlashItems()
  const [colorPref, setColorPref] = useColorPreference()
  const Page = pages[route].component

  return (
    <NotifyContext.Provider value={notify}>
      <div id="top-nav">
        <TopNavigation
          identity={{ href: '#/capacity', title: 'Capacity Planner' }}
          utilities={[
            {
              type: 'menu-dropdown',
              iconName: 'settings',
              ariaLabel: 'Appearance',
              title: 'Appearance',
              items: colorOptions.map(({ id, text }) => ({
                id,
                text,
                itemType: 'checkbox',
                checked: colorPref === id,
              })),
              onItemClick: ({ detail }) => setColorPref(detail.id as ColorPreference),
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#top-nav"
        toolsHide
        notifications={<Flashbar items={flashItems} stackItems />}
        navigation={
          <SideNavigation
            activeHref={route}
            header={{ href: '#/capacity', text: 'Capacity Planner' }}
            items={[
              { type: 'link', text: 'Capacity', href: '#/capacity' },
              { type: 'divider' },
              {
                type: 'section',
                text: 'Manage',
                items: [
                  { type: 'link', text: 'People', href: '#/people' },
                  { type: 'link', text: 'Projects', href: '#/projects' },
                ],
              },
              {
                type: 'section',
                text: 'Work',
                items: [
                  { type: 'link', text: 'Plan work', href: '#/allocations' },
                  { type: 'link', text: 'Track time', href: '#/time-entries' },
                ],
              },
            ]}
          />
        }
        content={<Page />}
      />
    </NotifyContext.Provider>
  )
}
