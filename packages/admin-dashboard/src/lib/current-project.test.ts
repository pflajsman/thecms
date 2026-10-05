import { getCurrentProjectId, projectHeaders, setCurrentProjectId } from './current-project'

it('remembers the project and turns it into the X-Project-Id header', () => {
  setCurrentProjectId('p1')
  expect(getCurrentProjectId()).toBe('p1')
  expect(localStorage.getItem('current_project')).toBe('p1')
  expect(projectHeaders()).toEqual({ 'X-Project-Id': 'p1' })
  setCurrentProjectId(null)
  expect(projectHeaders()).toEqual({})
  expect(localStorage.getItem('current_project')).toBeNull()
})
