import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSite } from '../test/render';
import { mockApi } from '../test/api-mock';
import { entry, list } from '../test/fixtures';

const projects = (lang: string) =>
  list([
    entry('p1', { title: lang === 'cs' ? 'Kolo a mapy' : 'Bikes and maps', tags: 'React, Leaflet', year: 2025 }, lang),
    entry('p2', { title: 'TheCMS', tags: 'React, Node', year: 2026 }, lang),
  ]);

describe('Projects page', () => {
  it('lists projects in the language of the URL with built-in hero copy', async () => {
    const { calls } = mockApi({ 'GET /content/project': (_b, url) => projects(url.searchParams.get('language')!) });
    renderSite('/cs');

    expect(await screen.findByRole('link', { name: 'Kolo a mapy' })).toHaveAttribute('href', '/cs/projekty/p1');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Věci, které stavím a zkouším.');
    expect(calls.find((c) => c.key === 'GET /content/project')!.url.searchParams.get('language')).toBe('cs');
    expect(document.documentElement.lang).toBe('cs');
  });

  it('filters by technology', async () => {
    mockApi({ 'GET /content/project': (_b, url) => projects(url.searchParams.get('language')!) });
    renderSite('/en');
    await screen.findByRole('link', { name: 'TheCMS' });

    const filter = screen.getByRole('navigation', { name: 'Filter by technology' });
    await userEvent.click(within(filter).getByRole('link', { name: 'Node' }));

    expect(screen.getByRole('link', { name: 'TheCMS' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bikes and maps' })).not.toBeInTheDocument();
  });

  it('switches language and keeps the page', async () => {
    mockApi({ 'GET /content/project': (_b, url) => projects(url.searchParams.get('language')!) });
    renderSite('/en');
    await screen.findByRole('link', { name: 'Bikes and maps' });

    await userEvent.click(screen.getByRole('link', { name: 'Přepnout do češtiny' }));

    expect(await screen.findByRole('link', { name: 'Kolo a mapy' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('cs');
  });

  it('uses hero copy from the CMS when there is a home page', async () => {
    mockApi({
      'GET /content/project': () => list([]),
      'GET /content/page': () => list([entry('h', { key: 'home', title: 'Ahoj z laboratoře', subtitle: 'Podtitul' })]),
    });
    renderSite('/cs');
    expect(await screen.findByRole('heading', { level: 1, name: 'Ahoj z laboratoře' })).toBeInTheDocument();
    expect(await screen.findByText('Zatím tu nejsou žádné projekty.')).toBeInTheDocument();
  });

  it('redirects / to a language', async () => {
    mockApi({ 'GET /content/project': () => list([]) });
    const { router } = renderSite('/');
    expect(['/cs', '/en']).toContain(router.state.location.pathname);
  });

  it('shows not found for an unknown language', async () => {
    mockApi({});
    renderSite('/de');
    expect(await screen.findByText('404')).toBeInTheDocument();
  });
});
