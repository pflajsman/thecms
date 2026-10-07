import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderSite } from '../test/render';
import { mockApi, ok } from '../test/api-mock';
import { entry, list } from '../test/fixtures';

describe('Project page', () => {
  it('shows the project with its facts and links, and links to the other language', async () => {
    mockApi({
      'GET /content/project': () => list([]),
      'GET /content/project/:id': (_b, url) =>
        ok(entry('p1', { title: 'TheCMS', summary: 'Headless CMS', body: '<p>Long story</p>', tags: 'React, Node', year: 2026, role: 'Autor', liveUrl: 'https://thecms.test', cover: 'm1' }, url.searchParams.get('language')!)),
    });
    renderSite('/cs/projekty/p1');

    expect(await screen.findByRole('heading', { level: 1, name: 'TheCMS' })).toBeInTheDocument();
    expect(screen.getByText('Long story')).toBeInTheDocument();
    expect(screen.getByText('React, Node')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Otevřít web' })).toHaveAttribute('href', 'https://thecms.test');
    expect(screen.getByRole('link', { name: 'Switch to English' })).toHaveAttribute('href', '/en/projects/p1');
    expect(await screen.findByRole('img', { name: 'TheCMS' })).toHaveAttribute('src', 'http://cdn.test/img.png');
  });

  it('says when the project does not exist', async () => {
    mockApi({
      'GET /content/project': () => list([]),
      'GET /content/project/:id': () => ({ status: 404, body: { success: false, error: 'Entry not found' } }),
    });
    renderSite('/en/projects/missing');
    expect(await screen.findByText('This project does not exist or is no longer published.')).toBeInTheDocument();
  });
});
